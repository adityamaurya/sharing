import { POLICY } from '../policy.js';
import {
  add,
  clamp,
  paise,
  rupees,
  scale,
  scaleToWholeRupeeUp,
  splitCeilToRupee,
  subtract,
  ZERO,
  type Paise,
} from '../money.js';

/**
 * Fare maths. Fixed, published, never surged.
 *
 * Surge would earn more per ride and destroy the product: the whole promise to
 * the passenger is "you never get fare-shocked again". See docs/00-product-spec.md §6.3.
 */

export interface SeatQuote {
  /** The share of the trip fare. This is what reaches the driver. */
  readonly seatFare: Paise;
  readonly platformFee: Paise;
  readonly guaranteeLevy: Paise;
  /** What the passenger's card/UPI is actually debited. */
  readonly total: Paise;
}

/**
 * Quote one seat on a corridor.
 *
 * The driver receives the full corridor fare (3 × seatFare); the platform's cut
 * is charged to the passenger on top, disclosed separately. That structure is a
 * deliberate MVAG 2025 choice — the guidelines require the driver to keep ≥80%
 * of the fare on their own vehicle, and "100% of the ride fare, our fee is the
 * passenger's" is also the version you can explain to a driver in 20 seconds.
 */
export function quoteSeat(corridorFullFare: Paise, discountRate = 0): SeatQuote {
  if (corridorFullFare < 0) {
    throw new RangeError('Corridor fare cannot be negative');
  }
  if (discountRate < 0 || discountRate >= 1) {
    throw new RangeError(`Discount must be in [0, 1), received ${discountRate}`);
  }

  const baseSeat = splitCeilToRupee(corridorFullFare, POLICY.SEATS_PER_POOL);
  const seatFare =
    discountRate === 0 ? baseSeat : scaleToWholeRupeeUp(baseSeat, 1 - discountRate);

  const platformFee = scale(seatFare, POLICY.pricing.PLATFORM_FEE_RATE);
  const guaranteeLevy = scale(seatFare, POLICY.pricing.GUARANTEE_LEVY_RATE);

  return {
    seatFare,
    platformFee,
    guaranteeLevy,
    total: add(seatFare, platformFee, guaranteeLevy),
  };
}

/**
 * What the driver is owed for running a full spot-fare pool.
 *
 * By construction this equals three spot seat fares — the driver keeps the whole
 * trip fare and the platform's cut is charged to passengers on top.
 */
export function driverPayoutForPool(corridorFullFare: Paise): Paise {
  return corridorFullFare;
}

/**
 * The general rule, and the one the ledger actually uses: **the driver receives
 * the sum of the seat fares sold on the trip.**
 *
 * For a spot pool that is the full corridor fare. For a pool of pass holders it
 * is slightly less, because a pass seat carries a volume discount the driver
 * granted in exchange for guaranteed prepaid income (see POLICY.pricing).
 * One rule covers both cases, which is why the payout ledger has no special
 * cases in it.
 */
export function driverPayoutForSeats(seatFares: readonly Paise[]): Paise {
  return paise(seatFares.reduce<number>((sum, f) => sum + f, 0));
}

// ── Short-fill ──────────────────────────────────────────────────────────────

export interface ShortFillOffer {
  readonly seatsFilled: number;
  /** What each remaining passenger pays in total, including their top-up. */
  readonly perPassengerTotal: Paise;
  readonly topUpPerPassenger: Paise;
  /** What the Guarantee Fund contributes to make the driver whole. */
  readonly fundSubsidy: Paise;
  readonly driverPayout: Paise;
  /** Declining is always free. Always. This is never false. */
  readonly declineIsFree: true;
  readonly message: string;
}

/**
 * A pool reached its departure deadline under-filled. Work out what we ask of
 * the people who *did* show up.
 *
 * The rule that matters is the cap: a passenger is never silently charged 3×
 * because two strangers didn't book. The fund absorbs the gap up to a limit,
 * and past that limit we would rather lose the ride than betray the promise.
 */
export function quoteShortFill(corridorFullFare: Paise, seatsFilled: number): ShortFillOffer {
  if (!Number.isInteger(seatsFilled) || seatsFilled < 0 || seatsFilled > POLICY.SEATS_PER_POOL) {
    throw new RangeError(`seatsFilled must be 0..${POLICY.SEATS_PER_POOL}, got ${seatsFilled}`);
  }

  const { seatFare } = quoteSeat(corridorFullFare);
  const driverPayout = driverPayoutForPool(corridorFullFare);

  if (seatsFilled === POLICY.SEATS_PER_POOL) {
    return {
      seatsFilled,
      perPassengerTotal: seatFare,
      topUpPerPassenger: ZERO,
      fundSubsidy: ZERO,
      driverPayout,
      declineIsFree: true,
      message: 'Pool is full. Normal fare.',
    };
  }

  if (seatsFilled === 0) {
    return {
      seatsFilled,
      perPassengerTotal: ZERO,
      topUpPerPassenger: ZERO,
      fundSubsidy: rupees(POLICY.shortFill.DRIVER_STANDBY_RUPEES),
      driverPayout: rupees(POLICY.shortFill.DRIVER_STANDBY_RUPEES),
      declineIsFree: true,
      message: 'No riders. Driver receives standby compensation.',
    };
  }

  const maxTopUp =
    seatsFilled === 1
      ? subtract(scaleToWholeRupeeUp(seatFare, POLICY.shortFill.SOLO_MAX_MULTIPLE), seatFare)
      : scaleToWholeRupeeUp(seatFare, POLICY.shortFill.TWO_SEAT_TOPUP_RATE);

  // What the shortfall actually is, spread across the people who turned up.
  const shortfall = subtract(driverPayout, paise(seatFare * seatsFilled));
  const naturalTopUp = splitCeilToRupee(shortfall, seatsFilled);
  const topUpPerPassenger = clamp(naturalTopUp, ZERO, maxTopUp);

  const collected = paise((seatFare + topUpPerPassenger) * seatsFilled);
  const fundSubsidy = subtract(driverPayout, collected);

  return {
    seatsFilled,
    perPassengerTotal: add(seatFare, topUpPerPassenger),
    topUpPerPassenger,
    fundSubsidy,
    driverPayout,
    declineIsFree: true,
    message:
      seatsFilled === 1
        ? 'Only you booked. Ride solo at the capped fare, or cancel free.'
        : 'One seat short. Small top-up, or cancel free.',
  };
}
