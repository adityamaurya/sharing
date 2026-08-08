import { POLICY } from '../policy.js';

/**
 * Credit Days, not cash refunds.
 *
 * "That person who is not going will get one day plus in the application" —
 * exactly. A credit day is better than a refund for everybody: the passenger
 * keeps a day of travel rather than getting ₹49 back, the relationship extends
 * instead of ending, no payment-gateway refund fees, and the fraud surface is
 * near zero because credits are non-transferable and expire.
 *
 * Credits are shown to users as a **date**, never as a balance.
 * "Your pass now runs to 12 Sept" is concrete. "You have 2.5 credits" is a
 * video game.
 */

const MS_PER_DAY = 86_400_000;

export interface CreditGrant {
  readonly days: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export function issueCredit(days: number, issuedAt: number): CreditGrant {
  if (days < 0) throw new RangeError('Credit days cannot be negative');
  return {
    days,
    issuedAt,
    expiresAt: issuedAt + POLICY.credits.EXPIRY_DAYS * MS_PER_DAY,
  };
}

export function isExpired(grant: CreditGrant, now: number): boolean {
  return now >= grant.expiresAt;
}

export function usableCreditDays(grants: readonly CreditGrant[], now: number): number {
  return grants
    .filter((g) => !isExpired(g, now))
    .reduce((total, g) => total + g.days, 0);
}

// ── Applying credits to a pass ──────────────────────────────────────────────

/** Parse a `YYYY-MM-DD` date string into a UTC-midnight epoch. */
export function parseServiceDate(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, received "${date}"`);
  const [, y, m, d] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

export function formatServiceDate(epoch: number): string {
  const iso = new Date(epoch).toISOString();
  return iso.slice(0, 10);
}

/**
 * Move a pass's end date forward by whole credit days, skipping non-service
 * weekdays. A Mon–Sat pass with one credit day, ending on a Saturday, extends to
 * the following Monday — not to Sunday, when the pass doesn't run anyway.
 */
export function extendPassEndDate(
  endDate: string,
  wholeDays: number,
  serviceWeekdays: readonly number[],
): string {
  if (!Number.isInteger(wholeDays) || wholeDays < 0) {
    throw new RangeError(`wholeDays must be a non-negative integer, got ${wholeDays}`);
  }
  if (serviceWeekdays.length === 0) {
    throw new RangeError('A pass must run on at least one weekday');
  }

  let cursor = parseServiceDate(endDate);
  let added = 0;
  // Bounded: with at least one service weekday, we advance at most 7 days per credit.
  let safety = wholeDays * 7 + 7;

  while (added < wholeDays && safety-- > 0) {
    cursor += MS_PER_DAY;
    const isoWeekday = ((new Date(cursor).getUTCDay() + 6) % 7) + 1; // 1 = Mon … 7 = Sun
    if (serviceWeekdays.includes(isoWeekday)) added++;
  }

  return formatServiceDate(cursor);
}

export interface CreditApplication {
  readonly newEndDate: string;
  /** Fractional remainder carried forward. Two halves make a whole day. */
  readonly bankedRemainder: number;
  readonly wholeDaysApplied: number;
  /** Plain-language line for the UI. */
  readonly message: string;
}

/**
 * Apply a credit award to a pass, banking any fractional remainder.
 * Half-days accumulate: two 0.5 awards become one extra day of travel.
 */
export function applyCreditToPass(
  endDate: string,
  serviceWeekdays: readonly number[],
  awardDays: number,
  alreadyBanked: number,
): CreditApplication {
  const pool = awardDays + alreadyBanked;
  const wholeDays = Math.floor(pool + 1e-9); // tolerate float dust from 0.75 + 0.25
  const remainder = Number((pool - wholeDays).toFixed(4));
  const newEndDate = extendPassEndDate(endDate, wholeDays, serviceWeekdays);

  const message =
    wholeDays > 0
      ? `Your pass now runs to ${prettyDate(newEndDate)}.`
      : `Half a day banked — one more and you get a full day back.`;

  return { newEndDate, bankedRemainder: remainder, wholeDaysApplied: wholeDays, message };
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** `2026-09-05` → `5 Sep`. Short, unambiguous, fits on one line at 24sp. */
export function prettyDate(date: string): string {
  const epoch = parseServiceDate(date);
  const d = new Date(epoch);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? '?'}`;
}

// ── Over-buying guardrails ──────────────────────────────────────────────────

export type PassHealthAdvice =
  | { readonly kind: 'ok' }
  | { readonly kind: 'cap_reached'; readonly message: string }
  | { readonly kind: 'suggest_downgrade'; readonly message: string };

/**
 * Selling somebody a plan they don't use is how you get churn and a bad name in
 * a neighbourhood. When someone is clearly over-buying, say so.
 */
export function assessPassHealth(
  bankedCreditDays: number,
  ridesScheduled: number,
  ridesCancelled: number,
): PassHealthAdvice {
  if (bankedCreditDays >= POLICY.credits.MAX_BANKED_DAYS) {
    return {
      kind: 'cap_reached',
      message:
        `You've banked ${Math.floor(bankedCreditDays)} unused days. ` +
        `Want to switch to a weekly pass, or pause this one? You'd pay less.`,
    };
  }

  if (
    ridesScheduled >= POLICY.grace.ABUSE_MIN_RIDES &&
    ridesCancelled / ridesScheduled > POLICY.credits.DOWNGRADE_SUGGESTION_THRESHOLD
  ) {
    return {
      kind: 'suggest_downgrade',
      message:
        `You rode ${ridesScheduled - ridesCancelled} of ${ridesScheduled} days. ` +
        `A weekly pass might fit your schedule better.`,
    };
  }

  return { kind: 'ok' };
}
