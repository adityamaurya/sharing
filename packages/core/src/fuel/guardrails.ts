import { POLICY } from '../policy.js';
import { rupees, ZERO, type Paise } from '../money.js';
import type {
  DriverFuelHistory,
  FuelLogDecision,
  FuelLogSubmission,
  FuelRejectionCode,
  FuelType,
} from '../types.js';

/**
 * Fuel logging guardrails.
 *
 * Drivers log fuel fills and earn ₹20 in **platform credit** — never cash.
 * Cash-out is how these programmes get farmed; credit redeemable against
 * platform fees is worth real money to a driver and worth nothing to a fraudster
 * with twelve burner accounts.
 *
 * The design principle throughout: **accept the data, gate the reward.** A log
 * that fails a plausibility check is still useful signal (and may be perfectly
 * honest), so we store it and simply don't pay for it. Rejecting the data as
 * well would teach drivers to stop logging, which is the one outcome that makes
 * the programme worthless.
 */

const MS_PER_HOUR = 3_600_000;
const MS_PER_WEEK = 604_800_000;

function normalisePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * OCR is imperfect on a dusty plate at a petrol pump. Allow one character of
 * slack rather than punishing a driver for our camera's eyesight.
 */
export function platesMatch(ocr: string | null, registered: string): boolean {
  if (ocr === null) return false;
  const a = normalisePlate(ocr);
  const b = normalisePlate(registered);
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  // Levenshtein distance ≤ 1.
  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function quantityIsPlausible(fuelType: FuelType, quantity: number): boolean {
  switch (fuelType) {
    case 'cng':
      return quantity >= POLICY.fuel.CNG_MIN_KG && quantity <= POLICY.fuel.CNG_MAX_KG;
    case 'petrol':
      return quantity >= POLICY.fuel.PETROL_MIN_L && quantity <= POLICY.fuel.PETROL_MAX_L;
    case 'electric':
      // A 3-wheeler pack is 4–12 kWh; a partial charge can be small.
      return quantity > 0 && quantity <= 15;
  }
}

/**
 * Does the implied unit price sit within tolerance of the station's median?
 * Returns `null` when we have no median yet — the first driver at a new station
 * shouldn't be penalised for being first.
 */
export function priceWithinTolerance(
  amountPaid: Paise,
  quantity: number,
  stationMedianPerUnit: Paise | null,
): boolean | null {
  if (stationMedianPerUnit === null || quantity <= 0) return null;
  const implied = amountPaid / quantity;
  const deviation = Math.abs(implied - stationMedianPerUnit) / stationMedianPerUnit;
  return deviation <= POLICY.fuel.PRICE_DEVIATION_TOLERANCE;
}

function countWithin(timestamps: readonly number[], now: number, windowMs: number): number {
  return timestamps.filter((t) => now - t <= windowMs && t <= now).length;
}

function mostRecent(timestamps: readonly number[]): number | null {
  if (timestamps.length === 0) return null;
  return timestamps.reduce((max, t) => (t > max ? t : max), timestamps[0] ?? 0);
}

function startOfMonthUtc(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/**
 * Decide whether a fuel log earns a reward.
 *
 * The rate limits you specified — two a week — are the load-bearing ones. Every
 * other check here catches a specific way somebody could turn a fuel-data
 * programme into an income stream: idling at a pump without buying anything,
 * logging the same fill twice, inventing quantities, or running one rickshaw
 * across several driver accounts.
 */
export function evaluateFuelLog(
  submission: FuelLogSubmission,
  history: DriverFuelHistory,
  stationMedianPerUnit: Paise | null,
): FuelLogDecision {
  const codes: FuelRejectionCode[] = [];
  const now = submission.submittedAt;

  // ── Presence checks: was the driver actually refuelling? ──────────────────
  if (submission.dwellSeconds < POLICY.fuel.GEOFENCE_DWELL_SECONDS) {
    codes.push('insufficient_dwell');
  }
  if (!submission.onShift) {
    codes.push('not_on_shift');
  }
  if (submission.tripsSinceLastLog < 1) {
    codes.push('no_trips_since_last_log');
  }

  // ── Rate limits. ──────────────────────────────────────────────────────────
  if (
    countWithin(history.rewardedLogTimestamps, now, MS_PER_WEEK) >=
    POLICY.fuel.MAX_REWARDED_LOGS_PER_WEEK
  ) {
    codes.push('weekly_limit_reached');
  }
  const last = mostRecent(history.rewardedLogTimestamps);
  if (last !== null && now - last < POLICY.fuel.MIN_HOURS_BETWEEN_LOGS * MS_PER_HOUR) {
    codes.push('too_soon_after_last_log');
  }

  // ── Plausibility. ─────────────────────────────────────────────────────────
  if (!quantityIsPlausible(submission.fuelType, submission.quantity)) {
    codes.push('implausible_quantity');
  }

  // ── Vehicle identity. ─────────────────────────────────────────────────────
  const plateOk = platesMatch(submission.ocrPlate, submission.registeredPlate);
  let substituteVehicle = false;

  if (!plateOk) {
    if (!submission.substituteVehicleDeclared) {
      codes.push('plate_mismatch_undeclared');
    } else {
      substituteVehicle = true;
      const substitutesThisMonth = countWithin(
        history.substituteLogTimestampsThisMonth,
        now,
        now - startOfMonthUtc(now),
      );
      if (substitutesThisMonth >= POLICY.fuel.MAX_SUBSTITUTE_LOGS_PER_MONTH) {
        codes.push('substitute_limit_reached');
      }
    }
  }

  // ── Price sanity: held, not rejected. ─────────────────────────────────────
  const priceOk = priceWithinTolerance(
    submission.amountPaid,
    submission.quantity,
    stationMedianPerUnit,
  );
  const heldForReview = priceOk === false && codes.length === 0;

  if (codes.length > 0) {
    return {
      accepted: true, // data is kept; only the reward is withheld
      reward: ZERO,
      heldForReview: false,
      rejectionCodes: codes,
      reason: explain(codes),
    };
  }

  if (heldForReview) {
    return {
      accepted: true,
      reward: ZERO,
      heldForReview: true,
      rejectionCodes: [],
      reason:
        'Thanks — this price looks different from others at this pump today, so ' +
        'the reward is under review. It will be credited within 24 hours if it checks out.',
    };
  }

  const reward = substituteVehicle
    ? rupees(POLICY.fuel.SUBSTITUTE_VEHICLE_REWARD_RUPEES)
    : rupees(POLICY.fuel.REWARD_RUPEES);

  return {
    accepted: true,
    reward,
    heldForReview: false,
    rejectionCodes: [],
    reason: substituteVehicle
      ? 'Logged against a substitute vehicle — half reward credited.'
      : 'Fuel logged. Reward credited to your account.',
  };
}

const MESSAGES: Record<FuelRejectionCode, string> = {
  insufficient_dwell: 'We could not confirm you stopped at the pump long enough.',
  not_on_shift: 'Fuel logs earn a reward only while you are on shift.',
  no_trips_since_last_log: 'Complete at least one trip between fuel logs.',
  weekly_limit_reached: `You have already earned ${POLICY.fuel.MAX_REWARDED_LOGS_PER_WEEK} fuel rewards this week. Log anyway — it still helps — but this one is unpaid.`,
  too_soon_after_last_log: `Fuel rewards are at least ${POLICY.fuel.MIN_HOURS_BETWEEN_LOGS} hours apart.`,
  implausible_quantity: 'That quantity looks outside the normal range for a three-wheeler. Please check and resubmit.',
  substitute_limit_reached: `You have logged the maximum ${POLICY.fuel.MAX_SUBSTITUTE_LOGS_PER_MONTH} substitute-vehicle fills this month.`,
  plate_mismatch_undeclared:
    'The number plate does not match your registered rickshaw. If you are driving another vehicle today, tick "different rickshaw" and try again.',
};

function explain(codes: readonly FuelRejectionCode[]): string {
  return codes.map((c) => MESSAGES[c]).join(' ');
}

/**
 * Same (device + plate) seen under two driver accounts — one rickshaw farming
 * two identities. Blocks the reward and flags both accounts for review.
 */
export function detectVehicleSharingAbuse(
  deviceId: string,
  plate: string,
  seen: readonly { readonly deviceId: string; readonly plate: string; readonly driverId: string }[],
  currentDriverId: string,
): boolean {
  const normalised = normalisePlate(plate);
  return seen.some(
    (s) =>
      s.deviceId === deviceId &&
      normalisePlate(s.plate) === normalised &&
      s.driverId !== currentDriverId,
  );
}
