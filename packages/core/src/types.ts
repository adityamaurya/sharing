import type { Paise } from './money.js';

// ── Identity ────────────────────────────────────────────────────────────────

export type UserId = string;
export type DriverId = string;
export type HotspotId = string;
export type CorridorId = string;
export type PoolId = string;
export type SeatId = string;
export type PassId = string;

export type Role = 'passenger' | 'driver';

/** Reliability is shown as a badge, never as a raw number. Raw numbers get gamed. */
export type ReliabilityBadge = 'new' | 'silver' | 'gold';

// ── Geography ───────────────────────────────────────────────────────────────

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/**
 * A curated pickup/drop point — a society gate, a station auto stand, a college
 * gate. Deliberately *not* a free-text address: curated points mean no geocoding
 * bill on the hot path, no "which gate did you mean", and a shared vocabulary
 * that drivers and passengers both already use.
 */
export interface Hotspot {
  readonly id: HotspotId;
  readonly name: string;
  readonly nameHi?: string;
  readonly nameMr?: string;
  readonly centre: LatLng;
  /** Metres. A passenger inside this radius is "at" the hotspot. */
  readonly geofenceRadiusM: number;
  readonly kind: 'station' | 'society' | 'college' | 'office' | 'market' | 'other';
}

/** An ordered pair of hotspots with a published, fixed fare. */
export interface Corridor {
  readonly id: CorridorId;
  readonly fromHotspotId: HotspotId;
  readonly toHotspotId: HotspotId;
  /** The full rickshaw fare for the whole trip, as one solo passenger would pay. */
  readonly fullFare: Paise;
  readonly distanceKm: number;
  readonly typicalDurationMin: number;
  readonly active: boolean;
  /** Corridors below the driver floor are visible but not bookable. */
  readonly committedDrivers: number;
}

// ── Rides ───────────────────────────────────────────────────────────────────

export type RideMode = 'now' | 'later' | 'daily';

export type PoolStatus =
  | 'forming' // accepting seats
  | 'locked' // full or past deadline, driver being assigned
  | 'assigned' // driver confirmed
  | 'boarding' // driver at pickup, scanning
  | 'running'
  | 'completed'
  | 'cancelled';

export interface Pool {
  readonly id: PoolId;
  readonly corridorId: CorridorId;
  /** Epoch ms. The moment the rickshaw leaves. */
  readonly departureAt: number;
  readonly status: PoolStatus;
  readonly seatsTaken: number;
  readonly driverId?: DriverId;
  readonly womenOnly: boolean;
}

export type SeatStatus =
  | 'held' // 90s hold while confirming
  | 'booked'
  | 'cancelled'
  | 'reseated' // cancelled and successfully sold on
  | 'boarded'
  | 'completed'
  | 'no_show';

export interface Seat {
  readonly id: SeatId;
  readonly poolId: PoolId;
  readonly passengerId: UserId;
  readonly status: SeatStatus;
  readonly mode: RideMode;
  /** Present when this seat came from a Pass rather than a one-off booking. */
  readonly passId?: PassId;
  readonly farePaid: Paise;
}

// ── Passes ──────────────────────────────────────────────────────────────────

export type PassPlan = 'weekly' | 'monthly';

export interface Pass {
  readonly id: PassId;
  readonly passengerId: UserId;
  readonly corridorId: CorridorId;
  readonly plan: PassPlan;
  /** Minutes past local midnight, e.g. 555 for 09:15. */
  readonly departureMinute: number;
  /** ISO weekday numbers the pass covers. 1 = Monday … 7 = Sunday. */
  readonly serviceWeekdays: readonly number[];
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string; // YYYY-MM-DD, moves forward as credits accrue
  readonly seatFare: Paise; // locked for the life of the pass
  readonly graceDaysTotal: number;
  readonly graceDaysUsed: number;
  /** Half-days are possible, so this is fractional. */
  readonly creditDaysBanked: number;
  readonly womenOnly: boolean;
  readonly status: 'active' | 'paused' | 'expired' | 'cancelled';
}

// ── Fairness ────────────────────────────────────────────────────────────────

export type CancellationActor = 'passenger' | 'driver' | 'system';

export interface CancellationRequest {
  readonly seatFare: Paise;
  /** Epoch ms when the cancellation was submitted. */
  readonly cancelledAt: number;
  /** Epoch ms the pool departs. */
  readonly departureAt: number;
  readonly graceDaysRemaining: number;
  /** Did the reseat market find a replacement? Decided before this runs. */
  readonly reseated: boolean;
  readonly actor: CancellationActor;
}

export type FundingSource = 'replacement_rider' | 'guarantee_fund' | 'forfeited_fare';

export interface CancellationOutcome {
  /** 1.0 = a whole day back. 0.5 = half. */
  readonly creditDays: number;
  /** Always the full seat fare. There is no branch where the driver eats it. */
  readonly driverPayout: Paise;
  readonly graceDayConsumed: boolean;
  readonly fundOutflow: Paise;
  readonly passengerForfeit: Paise;
  readonly noticeTier: string;
  readonly noticeHours: number;
  readonly funding: readonly { readonly source: FundingSource; readonly amount: Paise }[];
  /** Plain-language line shown to the passenger *before* they confirm. */
  readonly explanation: string;
}

// ── Fuel ────────────────────────────────────────────────────────────────────

export type FuelType = 'cng' | 'petrol' | 'electric';

export interface FuelLogSubmission {
  readonly driverId: DriverId;
  readonly stationId: string;
  readonly fuelType: FuelType;
  /** kg for CNG, litres for petrol, kWh for electric. */
  readonly quantity: number;
  readonly amountPaid: Paise;
  readonly submittedAt: number;
  /** Plate read by OCR from the driver's photo. */
  readonly ocrPlate: string | null;
  readonly registeredPlate: string;
  readonly substituteVehicleDeclared: boolean;
  readonly dwellSeconds: number;
  readonly onShift: boolean;
  readonly tripsSinceLastLog: number;
}

export interface DriverFuelHistory {
  readonly rewardedLogTimestamps: readonly number[];
  readonly substituteLogTimestampsThisMonth: readonly number[];
}

export type FuelRejectionCode =
  | 'insufficient_dwell'
  | 'not_on_shift'
  | 'no_trips_since_last_log'
  | 'weekly_limit_reached'
  | 'too_soon_after_last_log'
  | 'implausible_quantity'
  | 'substitute_limit_reached'
  | 'plate_mismatch_undeclared';

export interface FuelLogDecision {
  /** Logs are almost always *accepted* as data even when they pay nothing. */
  readonly accepted: boolean;
  readonly reward: Paise;
  /** Accepted, but the reward waits for a human or for a price median. */
  readonly heldForReview: boolean;
  readonly rejectionCodes: readonly FuelRejectionCode[];
  readonly reason: string;
}
