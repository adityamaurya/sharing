import { POLICY } from '../policy.js';
import { add, paise, scale, type Paise } from '../money.js';
import { quoteSeat } from './fares.js';
import type { PassPlan } from '../types.js';

/**
 * Pass pricing. A pass trades flexibility for a lower fare and a guaranteed seat,
 * and it is what turns this from an app into a business — a pass holder is
 * pre-funded income the driver can count on before the month starts.
 */

export interface PassQuote {
  readonly plan: PassPlan;
  readonly serviceDays: number;
  readonly perRideSeatFare: Paise;
  readonly perRideTotal: Paise;
  readonly upfrontTotal: Paise;
  readonly graceDays: number;
  /** Versus paying the daily rate every day. */
  readonly savingsVsDaily: Paise;
  readonly discountRate: number;
}

export function planConfig(plan: PassPlan): {
  serviceDays: number;
  discount: number;
  graceDays: number;
} {
  switch (plan) {
    case 'weekly':
      return {
        serviceDays: POLICY.pricing.WEEKLY_SERVICE_DAYS,
        discount: POLICY.pricing.WEEKLY_DISCOUNT,
        graceDays: POLICY.grace.WEEKLY_GRACE_DAYS,
      };
    case 'monthly':
      return {
        serviceDays: POLICY.pricing.MONTHLY_SERVICE_DAYS,
        discount: POLICY.pricing.MONTHLY_DISCOUNT,
        graceDays: POLICY.grace.MONTHLY_GRACE_DAYS,
      };
  }
}

export function quotePass(corridorFullFare: Paise, plan: PassPlan): PassQuote {
  const { serviceDays, discount, graceDays } = planConfig(plan);

  const passSeat = quoteSeat(corridorFullFare, discount);
  const dailySeat = quoteSeat(corridorFullFare);

  const upfrontTotal = paise(passSeat.total * serviceDays);
  const dailyEquivalent = paise(dailySeat.total * serviceDays);

  return {
    plan,
    serviceDays,
    perRideSeatFare: passSeat.seatFare,
    perRideTotal: passSeat.total,
    upfrontTotal,
    graceDays,
    savingsVsDaily: paise(dailyEquivalent - upfrontTotal),
    discountRate: discount,
  };
}

export interface RoundTripQuote {
  readonly outbound: PassQuote;
  readonly inbound: PassQuote;
  readonly bundleDiscount: Paise;
  readonly upfrontTotal: Paise;
}

/**
 * Both legs, bundled. The return leg is where the other half of a commuter's
 * money goes — ₹150 out and ₹150 back was the real shape of the problem.
 */
export function quoteRoundTripPass(
  outboundFullFare: Paise,
  inboundFullFare: Paise,
  plan: PassPlan,
): RoundTripQuote {
  const outbound = quotePass(outboundFullFare, plan);
  const inbound = quotePass(inboundFullFare, plan);
  const combined = add(outbound.upfrontTotal, inbound.upfrontTotal);
  const bundleDiscount = scale(combined, POLICY.pricing.ROUND_TRIP_DISCOUNT);

  return {
    outbound,
    inbound,
    bundleDiscount,
    upfrontTotal: paise(combined - bundleDiscount),
  };
}

/**
 * How many rupees the driver can count on from one pass holder over the cycle.
 * This number, said out loud at a rickshaw stand, is the entire driver pitch.
 */
export function driverGuaranteedEarnings(
  corridorFullFare: Paise,
  plan: PassPlan,
  passHoldersOnCorridor: number,
): Paise {
  const { serviceDays } = planConfig(plan);
  const perSeat = quoteSeat(corridorFullFare, planConfig(plan).discount).seatFare;
  return paise(perSeat * serviceDays * passHoldersOnCorridor);
}
