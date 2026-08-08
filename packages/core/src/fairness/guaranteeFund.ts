import { POLICY } from '../policy.js';
import { paise, rupees, scale, type Paise } from '../money.js';

/**
 * The Guarantee Fund — a 4% levy on every seat fare that pays the driver
 * whenever a seat goes unsold and the passenger wasn't charged.
 *
 * This is the thing that turns a generous policy into a solvent one, and it is
 * the answer to "the rickshaw guy's livelihood depends on this — if one person
 * doesn't come, his ₹120 is gone." It isn't gone. It comes from the pool that
 * every rider paid into, which is what insurance is.
 */

export interface FundProjection {
  readonly seatsPerPeriod: number;
  readonly income: Paise;
  readonly cancellationOutflow: Paise;
  readonly shortFillOutflow: Paise;
  readonly totalOutflow: Paise;
  readonly net: Paise;
  readonly solvent: boolean;
  /** Subsidy needed per seat while the fund runs a deficit. */
  readonly subsidyPerSeat: Paise;
}

export interface FundAssumptions {
  readonly cancelRate: number;
  readonly reseatRate: number;
  readonly shortFillRate: number;
  /** Average fund contribution per under-filled pool. */
  readonly avgShortFillSubsidy: Paise;
}

export function defaultAssumptions(avgShortFillSubsidy: Paise): FundAssumptions {
  return {
    cancelRate: POLICY.guaranteeFund.ASSUMED_CANCEL_RATE,
    reseatRate: POLICY.guaranteeFund.ASSUMED_RESEAT_RATE,
    shortFillRate: POLICY.guaranteeFund.ASSUMED_SHORT_FILL_RATE,
    avgShortFillSubsidy,
  };
}

/**
 * Project fund health over a period.
 *
 * Run this before launching a corridor. At launch assumptions the fund runs a
 * deficit — that is expected and should be a budgeted line, not a surprise in
 * month four. The two levers that close it are reseat rate and short-fill rate,
 * and both improve for free as density grows. Raising the levy is the last
 * resort, not the first.
 */
export function projectFund(
  seatsPerPeriod: number,
  seatFare: Paise,
  assumptions: FundAssumptions,
): FundProjection {
  const income = scale(paise(seatFare * seatsPerPeriod), POLICY.pricing.GUARANTEE_LEVY_RATE);

  const unreseatedCancels =
    seatsPerPeriod * assumptions.cancelRate * (1 - assumptions.reseatRate);
  const cancellationOutflow = paise(Math.round(unreseatedCancels * seatFare));

  const pools = seatsPerPeriod / POLICY.SEATS_PER_POOL;
  const shortFillOutflow = paise(
    Math.round(pools * assumptions.shortFillRate * assumptions.avgShortFillSubsidy),
  );

  const totalOutflow = paise(cancellationOutflow + shortFillOutflow);
  const net = paise(income - totalOutflow);

  return {
    seatsPerPeriod,
    income,
    cancellationOutflow,
    shortFillOutflow,
    totalOutflow,
    net,
    solvent: net >= 0,
    subsidyPerSeat: net >= 0 ? rupees(0) : paise(Math.ceil(-net / seatsPerPeriod)),
  };
}

// ── Reserve protection ──────────────────────────────────────────────────────

export type FundHealth = 'healthy' | 'watch' | 'shedding';

export interface ReserveStatus {
  readonly health: FundHealth;
  readonly daysOfCover: number;
  /** When shedding, NOW mode is disabled on the weakest corridors, in code. */
  readonly disableNowMode: boolean;
  readonly message: string;
}

/**
 * Degrade gracefully, never insolvently.
 *
 * If the reserve can't cover 14 days of projected outflow, NOW mode — the
 * highest-variance, most-subsidised mode — is switched off on the weakest
 * corridors automatically. LATER and DAILY keep running, because their fill
 * rates are predictable. Better to offer less than to fail a driver's payout.
 */
export function reserveStatus(balance: Paise, dailyOutflow: Paise): ReserveStatus {
  if (dailyOutflow <= 0) {
    return {
      health: 'healthy',
      daysOfCover: Infinity,
      disableNowMode: false,
      message: 'No outflow projected.',
    };
  }

  const daysOfCover = balance / dailyOutflow;
  const floor = POLICY.guaranteeFund.MIN_RESERVE_DAYS;

  if (daysOfCover >= floor * 2) {
    return {
      health: 'healthy',
      daysOfCover,
      disableNowMode: false,
      message: `Fund covers ${Math.floor(daysOfCover)} days of payouts.`,
    };
  }
  if (daysOfCover >= floor) {
    return {
      health: 'watch',
      daysOfCover,
      disableNowMode: false,
      message:
        `Fund covers ${Math.floor(daysOfCover)} days. Below ${floor * 2} — ` +
        `stop launching thin corridors until reseat rate improves.`,
    };
  }
  return {
    health: 'shedding',
    daysOfCover,
    disableNowMode: true,
    message:
      `Fund covers only ${daysOfCover.toFixed(1)} days. Instant (NOW) pooling is ` +
      `suspended on low-density corridors until the reserve recovers. ` +
      `Passes and scheduled rides are unaffected.`,
  };
}

/**
 * Rank corridors for shedding: worst fill rate and highest subsidy burn first.
 * Returns corridor ids in the order they should lose NOW mode.
 */
export function shedOrder(
  corridors: readonly {
    readonly corridorId: string;
    readonly fillRate: number;
    readonly monthlySubsidy: Paise;
  }[],
): readonly string[] {
  return [...corridors]
    .sort((a, b) => {
      const burnA = a.monthlySubsidy * (1 - a.fillRate);
      const burnB = b.monthlySubsidy * (1 - b.fillRate);
      return burnB - burnA;
    })
    .map((c) => c.corridorId);
}
