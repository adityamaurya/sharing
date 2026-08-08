/**
 * settle-cancellation — the authoritative, server-side settlement.
 *
 * The client shows the passenger what will happen before they tap. This
 * function decides what *actually* happens, and it is the only thing that may
 * write to the ledger. Same code, one source of truth: it imports the very
 * functions the app used for the preview, from `@sharing/core`.
 *
 * Never trust a client for money. The preview is a courtesy; this is the record.
 *
 * Deploy:  supabase functions deploy settle-cancellation
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  applyCreditToPass,
  assertFundingBalances,
  resolveCancellation,
  type CancellationOutcome,
} from '../../../packages/core/src/index.ts';

interface Body {
  seatId: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in' }, 401);

  // Two clients on purpose: one bound to the caller, used to prove they own the
  // seat; one service-role, used to write. The caller's token can never write
  // to the ledger even if this function has a bug in its authorisation check.
  const asUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const asService = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: auth } = await asUser.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return json({ error: 'Not signed in' }, 401);

  const { seatId } = (await req.json()) as Body;

  // RLS on `asUser` means this returns nothing unless the seat is theirs.
  const { data: seat, error: seatErr } = await asUser
    .from('seats')
    .select('id, pool_id, passenger_id, pass_id, fare_paid, status, pools(departure_at, driver_id)')
    .eq('id', seatId)
    .single();

  if (seatErr || !seat) return json({ error: 'Seat not found' }, 404);
  if (seat.status === 'cancelled' || seat.status === 'reseated') {
    return json({ error: 'Already cancelled' }, 409);
  }

  const pool = seat.pools as unknown as { departure_at: string; driver_id: string | null };
  const departureAt = new Date(pool.departure_at).getTime();
  const cancelledAt = Date.now();

  // Pass state, when this seat came from a pass.
  let pass: {
    id: string;
    seat_fare: number;
    grace_days_total: number;
    grace_days_used: number;
    credit_days_banked: number;
    end_date: string;
    service_weekdays: number[];
  } | null = null;

  if (seat.pass_id) {
    const { data } = await asService
      .from('passes')
      .select('id, seat_fare, grace_days_total, grace_days_used, credit_days_banked, end_date, service_weekdays')
      .eq('id', seat.pass_id)
      .single();
    pass = data;
  }

  const graceRemaining = pass ? pass.grace_days_total - pass.grace_days_used : 0;
  const seatFare = (pass?.seat_fare ?? seat.fare_paid) as number;

  // Reseat first — always, before a grace day is spent. A well-organised
  // passenger should keep their grace for the emergency they'll actually need.
  const reseated = await tryReseat(asService, seat.pool_id, departureAt);

  const outcome: CancellationOutcome = resolveCancellation({
    seatFare: seatFare as never,
    cancelledAt,
    departureAt,
    graceDaysRemaining: graceRemaining,
    reseated,
    actor: 'passenger',
  });

  // Refuse to write anything that would leave the driver short. This should be
  // impossible — it is asserted in the core tests — so if it fires, something
  // is badly wrong and failing loudly beats paying incorrectly.
  assertFundingBalances(outcome);

  const entryGroup = crypto.randomUUID();

  await asService.from('seats').update({ status: reseated ? 'reseated' : 'cancelled' }).eq('id', seat.id);

  await asService.from('cancellations').insert({
    seat_id: seat.id,
    pass_id: seat.pass_id,
    actor: 'passenger',
    departure_at: new Date(departureAt).toISOString(),
    notice_hours: outcome.noticeHours,
    notice_tier: outcome.noticeTier,
    reseated,
    grace_day_used: outcome.graceDayConsumed,
    credit_days: outcome.creditDays,
    driver_payout: outcome.driverPayout,
    fund_outflow: outcome.fundOutflow,
    passenger_forfeit: outcome.passengerForfeit,
    // No reason column. We never ask, so there is nothing to store.
  });

  // Double-entry: credit the driver, debit whoever is funding it.
  const rows = [
    {
      entry_group: entryGroup,
      account: 'driver' as const,
      subject_id: pool.driver_id,
      direction: 'credit' as const,
      amount_paise: outcome.driverPayout,
      seat_id: seat.id,
      pool_id: seat.pool_id,
      reason: `Trip fare honoured after passenger cancellation (${outcome.noticeTier})`,
    },
    ...outcome.funding.map((f) => ({
      entry_group: entryGroup,
      account:
        f.source === 'guarantee_fund'
          ? ('guarantee_fund' as const)
          : ('passenger' as const),
      subject_id: f.source === 'guarantee_fund' ? null : seat.passenger_id,
      direction: 'debit' as const,
      amount_paise: f.amount,
      seat_id: seat.id,
      pool_id: seat.pool_id,
      reason: f.source,
    })),
  ];

  await asService.from('ledger').insert(rows);
  await asService.rpc('assert_ledger_balanced', { group_id: entryGroup });

  if (outcome.fundOutflow > 0) {
    await asService.rpc('adjust_fund_balance', { delta: -outcome.fundOutflow });
  }

  // Apply the credit to the pass and move its end date forward.
  let newEndDate: string | null = null;
  if (pass && outcome.creditDays > 0) {
    const applied = applyCreditToPass(
      pass.end_date,
      pass.service_weekdays,
      outcome.creditDays,
      Number(pass.credit_days_banked),
    );
    newEndDate = applied.newEndDate;

    await asService
      .from('passes')
      .update({
        end_date: applied.newEndDate,
        credit_days_banked: applied.bankedRemainder,
        grace_days_used: pass.grace_days_used + (outcome.graceDayConsumed ? 1 : 0),
      })
      .eq('id', pass.id);
  }

  return json({
    ok: true,
    reseated,
    creditDays: outcome.creditDays,
    graceDayUsed: outcome.graceDayConsumed,
    newEndDate,
    // The passenger-facing sentence, generated by the same code that generated
    // the preview — so what they were promised is what they are told.
    message: outcome.explanation,
  });
});

/**
 * Offer the seat to riders wanting this corridor and window.
 *
 * Stubbed to `false` until the reseat market ships. Returning false is the
 * safe default: the passenger still gets a grace day or the notice ladder, and
 * the driver is still paid — we just pay it from the fund instead of from a
 * replacement rider. Nobody is harmed by this being conservative.
 */
async function tryReseat(
  _client: ReturnType<typeof createClient>,
  _poolId: string,
  _departureAt: number,
): Promise<boolean> {
  return false;
}
