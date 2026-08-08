import { POLICY } from '../policy.js';

/**
 * The notice ladder.
 *
 * The credit fraction is not arbitrary — it tracks our real ability to resell
 * the seat at that much notice. At 12 hours we reseat roughly 70% of seats; at
 * one hour, roughly 15%; at five minutes, none. That correspondence is what lets
 * you explain the number to an angry user without embarrassment. An arbitrary
 * 50% cannot be explained; a 50% that means "we probably can't resell this" can.
 */

export interface NoticeTier {
  readonly label: string;
  readonly creditFraction: number;
  readonly minHours: number;
}

/** Hours of notice, floored at zero. A cancellation after departure is zero notice. */
export function noticeHours(cancelledAt: number, departureAt: number): number {
  return Math.max(0, (departureAt - cancelledAt) / 3_600_000);
}

export function tierForNotice(hours: number): NoticeTier {
  for (const tier of POLICY.notice.TIERS) {
    if (hours >= tier.minHours) {
      return { label: tier.label, creditFraction: tier.creditFraction, minHours: tier.minHours };
    }
  }
  // TIERS ends at minHours 0 and hours is floored at 0, so this is unreachable.
  // Kept as a total function rather than a non-null assertion.
  return { label: 'last_minute', creditFraction: 0, minHours: 0 };
}

/**
 * Human-readable notice, for the confirmation sheet. Deliberately rounded and
 * conversational — "tomorrow morning", not "11.6 hours".
 */
export function describeNotice(hours: number): string {
  if (hours >= 24) return `${Math.floor(hours / 24)} day${hours >= 48 ? 's' : ''} ahead`;
  if (hours >= 12) return 'the night before';
  if (hours >= 3) return `${Math.floor(hours)} hours ahead`;
  if (hours >= 1) return `${Math.floor(hours)} hour${hours >= 2 ? 's' : ''} ahead`;
  if (hours > 0) return `${Math.round(hours * 60)} minutes ahead`;
  return 'after departure';
}

/**
 * Driver-side consequences. The obligations are symmetric: a fairness engine
 * that only disciplines passengers is one passengers won't trust.
 *
 * Note that early notice is free for the driver too. We are not trying to punish
 * drivers, we're trying to make late surprises rare on both sides — a driver who
 * tells us at 9pm that tomorrow won't work has done us a favour.
 */
export interface DriverPenalty {
  readonly reliabilityDelta: number;
  readonly strike: boolean;
  readonly passengerCreditDays: number;
  readonly inconvenienceCreditRupees: number;
  readonly label: string;
}

/**
 * Penalty magnitudes are stored positive and negated here. `-0` is a real value
 * in JavaScript and it has no business in a driver's reliability ledger, so a
 * zero penalty stays exactly zero.
 */
function asDeduction(magnitude: number): number {
  return magnitude === 0 ? 0 : -magnitude;
}

export function driverCancellationPenalty(
  hoursNotice: number,
  isNoShow: boolean,
): DriverPenalty {
  const P = POLICY.driverPenalty;

  if (isNoShow) {
    return {
      reliabilityDelta: asDeduction(P.NO_SHOW),
      strike: true,
      passengerCreditDays: 1,
      inconvenienceCreditRupees: P.INCONVENIENCE_CREDIT_RUPEES,
      label: 'no_show',
    };
  }
  if (hoursNotice < 3) {
    return {
      reliabilityDelta: asDeduction(P.CANCEL_UNDER_3H),
      strike: false,
      passengerCreditDays: 1,
      inconvenienceCreditRupees: P.INCONVENIENCE_CREDIT_RUPEES,
      label: 'cancel_under_3h',
    };
  }
  if (hoursNotice < 12) {
    return {
      reliabilityDelta: asDeduction(P.CANCEL_3_TO_12H),
      strike: false,
      passengerCreditDays: 1,
      inconvenienceCreditRupees: 0,
      label: 'cancel_3_to_12h',
    };
  }
  return {
    reliabilityDelta: asDeduction(P.CANCEL_12H_PLUS),
    strike: false,
    passengerCreditDays: 0,
    inconvenienceCreditRupees: 0,
    label: 'cancel_12h_plus',
  };
}

export function isDriverSuspended(strikesInWindow: number): boolean {
  return strikesInWindow >= POLICY.driverPenalty.STRIKES_BEFORE_SUSPENSION;
}
