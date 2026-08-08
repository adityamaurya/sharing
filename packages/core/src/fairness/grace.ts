import { POLICY } from '../policy.js';
import type { PassPlan } from '../types.js';

/**
 * Grace Days: a fixed budget of no-questions-asked cancellations.
 *
 * The design commitment behind this file, from docs/01-fairness-engine.md §1:
 * **we never ask why.** No reason field, no dropdown, no proof. A reason-based
 * system can't be verified, taxes the honest, and makes us the judge of other
 * people's fevers. A visible allowance does the same job and users self-ration
 * against it, because nobody argues with a budget they can see.
 */

export function graceDaysForPlan(plan: PassPlan): number {
  return plan === 'weekly'
    ? POLICY.grace.WEEKLY_GRACE_DAYS
    : POLICY.grace.MONTHLY_GRACE_DAYS;
}

export interface GraceState {
  readonly total: number;
  readonly used: number;
  readonly remaining: number;
  /** For the dot row in the UI: `●●●○`. */
  readonly display: string;
}

export function graceState(total: number, used: number): GraceState {
  const clampedUsed = Math.min(Math.max(used, 0), total);
  const remaining = total - clampedUsed;
  return {
    total,
    used: clampedUsed,
    remaining,
    display: '●'.repeat(remaining) + '○'.repeat(clampedUsed),
  };
}

export interface AbuseSample {
  /** Rides scheduled in the sampling window. */
  readonly ridesScheduled: number;
  readonly ridesCancelled: number;
}

/**
 * Serial late-cancellers get their next cycle's grace halved — and are told why,
 * plainly. Halving rather than removing: the goal is to change behaviour, not to
 * make someone's commute impossible over a ₹49 seat.
 */
export function nextCycleGraceDays(plan: PassPlan, sample: AbuseSample): {
  graceDays: number;
  reduced: boolean;
  message: string | null;
} {
  const base = graceDaysForPlan(plan);

  if (sample.ridesScheduled < POLICY.grace.ABUSE_MIN_RIDES) {
    return { graceDays: base, reduced: false, message: null };
  }

  const cancelRate = sample.ridesCancelled / sample.ridesScheduled;
  if (cancelRate <= POLICY.grace.ABUSE_CANCEL_RATE) {
    return { graceDays: base, reduced: false, message: null };
  }

  const reducedDays = Math.max(1, Math.floor(base / 2));
  const pct = Math.round(cancelRate * 100);
  return {
    graceDays: reducedDays,
    reduced: true,
    message:
      `You cancelled ${pct}% of your rides over the last ` +
      `${POLICY.grace.ABUSE_SAMPLE_WINDOW_DAYS} days, so your next pass has ` +
      `${reducedDays} grace ${reducedDays === 1 ? 'day' : 'days'} instead of ${base}. ` +
      `A smaller pass may suit you better — you'd keep the flexibility and pay less.`,
  };
}

/**
 * Grace days do not multiply across duplicate accounts. A device, VPA, or phone
 * shared between accounts shares one allowance between them.
 */
export function clusterGraceAllowance(
  plan: PassPlan,
  accountsInCluster: number,
): number {
  const base = graceDaysForPlan(plan);
  if (accountsInCluster <= 1) return base;
  return Math.max(1, Math.floor(base / accountsInCluster));
}
