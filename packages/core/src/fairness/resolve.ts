import { add, paise, scale, subtract, ZERO, formatINR, type Paise } from '../money.js';
import { describeNotice, noticeHours, tierForNotice } from './cancellation.js';
import type { CancellationOutcome, CancellationRequest, FundingSource } from '../types.js';

/**
 * The full cancellation resolution pipeline.
 *
 * Resolution order — and the order matters:
 *
 *   1. RESEAT.  Try to sell the seat to a NOW/LATER rider on the same corridor
 *      and window. If it sells, everyone is whole and no grace day is spent.
 *   2. GRACE.   If it didn't sell and the passenger has a grace day, spend it:
 *      full credit to the passenger, driver paid from the fund.
 *   3. LADDER.  Otherwise the notice ladder decides the credit fraction, and the
 *      driver is still paid in full — part fund, part forfeited fare.
 *
 * Reseat runs *before* grace on purpose. It means a well-organised passenger who
 * cancels the night before usually keeps their grace days for the emergency they
 * will actually need. The system rewards notice without punishing crisis.
 *
 * The invariant that defines this product: **`driverPayout` is always the full
 * seat fare.** There is no branch below where the driver eats the loss. If you
 * are editing this file and that stops being true, you have changed what the
 * company is.
 */
export function resolveCancellation(req: CancellationRequest): CancellationOutcome {
  const hours = noticeHours(req.cancelledAt, req.departureAt);
  const tier = tierForNotice(hours);
  const fare = req.seatFare;

  // ── 1. Reseated: the market solved it. ────────────────────────────────────
  if (req.reseated) {
    return {
      creditDays: 1,
      driverPayout: fare,
      graceDayConsumed: false,
      fundOutflow: ZERO,
      passengerForfeit: ZERO,
      noticeTier: tier.label,
      noticeHours: hours,
      funding: [{ source: 'replacement_rider', amount: fare }],
      explanation:
        'We gave your seat to another rider, so you get the full day back and ' +
        'your grace days are untouched.',
    };
  }

  // ── 2. Grace day: no questions, no proof, no judgement. ───────────────────
  if (req.graceDaysRemaining > 0) {
    return {
      creditDays: 1,
      driverPayout: fare,
      graceDayConsumed: true,
      fundOutflow: fare,
      passengerForfeit: ZERO,
      noticeTier: tier.label,
      noticeHours: hours,
      funding: [{ source: 'guarantee_fund', amount: fare }],
      explanation:
        `Grace day used — you get the full day back. ` +
        `${req.graceDaysRemaining - 1} left this cycle.`,
    };
  }

  // ── 3. Notice ladder. ─────────────────────────────────────────────────────
  const creditValue = scale(fare, tier.creditFraction);
  const forfeit = subtract(fare, creditValue);

  const funding: { source: FundingSource; amount: Paise }[] = [];
  if (creditValue > 0) funding.push({ source: 'guarantee_fund', amount: creditValue });
  if (forfeit > 0) funding.push({ source: 'forfeited_fare', amount: forfeit });

  const explanation =
    tier.creditFraction === 0
      ? `No grace days left, and cancelling ${describeNotice(hours)} means we can't ` +
        `resell the seat. No credit this time.`
      : `No grace days left. Cancelling ${describeNotice(hours)} returns ` +
        `${Math.round(tier.creditFraction * 100)}% of the day ` +
        `(${formatINR(creditValue)} of ${formatINR(fare)}) to your pass.`;

  return {
    creditDays: tier.creditFraction,
    driverPayout: fare,
    graceDayConsumed: false,
    fundOutflow: creditValue,
    passengerForfeit: forfeit,
    noticeTier: tier.label,
    noticeHours: hours,
    funding,
    explanation,
  };
}

/**
 * Preview the outcome of a cancellation the passenger has not yet confirmed.
 *
 * This exists because of rule 1 of the cancel sheet in docs/01-fairness-engine.md §9:
 * **always show the outcome before the tap, never after.** Surprise is what
 * generates one-star reviews, not cost. A user who sees "returns half a day"
 * before confirming may be annoyed; a user who discovers it afterwards is gone.
 *
 * `reseatLikelihood` is our honest estimate, not a promise — so the preview says
 * "we'll try" rather than committing to an outcome we don't control yet.
 */
export interface CancellationPreview {
  readonly outcome: CancellationOutcome;
  readonly headline: string;
  readonly detail: string;
  readonly confirmLabel: string;
  readonly reseatLikely: boolean;
}

export function previewCancellation(
  req: CancellationRequest,
  reseatLikelihood: number,
): CancellationPreview {
  // Preview assumes no reseat: never promise a sale we haven't made.
  const outcome = resolveCancellation({ ...req, reseated: false });
  const reseatLikely = reseatLikelihood >= 0.5;

  if (reseatLikely || outcome.creditDays >= 1) {
    return {
      outcome,
      headline: 'You get a full day back.',
      detail: outcome.graceDayConsumed
        ? `Grace day used — ${req.graceDaysRemaining - 1} left. ` +
          `We'll try to give your seat to someone else first.`
        : `We'll try to give your seat to someone else first, so your grace days stay put.`,
      confirmLabel: 'Yes, skip this ride',
      reseatLikely,
    };
  }

  if (outcome.creditDays > 0) {
    return {
      outcome,
      headline: `You get ${outcome.creditDays === 0.5 ? 'half' : `${outcome.creditDays * 100}%`} of the day back.`,
      detail: outcome.explanation,
      confirmLabel: 'Cancel anyway',
      reseatLikely,
    };
  }

  return {
    outcome,
    headline: 'No credit for this one.',
    detail: outcome.explanation,
    confirmLabel: 'Cancel anyway',
    reseatLikely,
  };
}

/**
 * Sum what the fund actually pays out across a batch of resolutions — used by
 * the nightly reconciliation job and by the corridor P&L view.
 */
export function totalFundOutflow(outcomes: readonly CancellationOutcome[]): Paise {
  return paise(outcomes.reduce<number>((sum, o) => sum + o.fundOutflow, 0));
}

export function totalDriverPayout(outcomes: readonly CancellationOutcome[]): Paise {
  return paise(outcomes.reduce<number>((sum, o) => sum + o.driverPayout, 0));
}

/** Every outcome must fund the driver exactly. A failure here is a money bug. */
export function assertFundingBalances(outcome: CancellationOutcome): void {
  const funded = add(...outcome.funding.map((f) => f.amount));
  if (funded !== outcome.driverPayout) {
    throw new Error(
      `Funding does not balance: sources total ${formatINR(funded)} but driver is ` +
        `owed ${formatINR(outcome.driverPayout)}`,
    );
  }
}
