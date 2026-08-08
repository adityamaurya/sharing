/**
 * Every tunable number in Sharing lives here, in one file, with a comment
 * explaining what it promises to a real person.
 *
 * These are not magic constants — they are commitments to passengers earning
 * ₹30k/month and drivers earning ₹600/day. Changing one changes what somebody
 * takes home. Every value here is covered by a test in
 * `src/fairness/__tests__/worked-examples.test.ts`; if you change a number,
 * a test will fail and name the promise you just altered.
 *
 * Spec: docs/01-fairness-engine.md
 */

export const POLICY = {
  /** Passenger seats per rickshaw. Legal capacity and safety floor. Never 4. */
  SEATS_PER_POOL: 3,

  pricing: {
    /** Platform convenience fee, charged to the passenger on top of the seat fare. */
    PLATFORM_FEE_RATE: 0.08,
    /** Guarantee Fund levy, charged on top. Funds driver make-whole payouts. */
    GUARANTEE_LEVY_RATE: 0.04,
    /**
     * Pass discounts are a **volume discount granted by the driver**, not a
     * platform subsidy, and this is the one place that needs saying out loud:
     * a pass seat pays the driver less per trip than a spot seat, because the
     * driver is getting guaranteed, prepaid, pre-scheduled income instead of a
     * gamble. That is the trade real drivers already understand and already
     * make — it is exactly the lump-sum monthly deal you negotiated by hand.
     *
     * Keep these small. Every point of discount comes out of a ₹600/day income,
     * and a driver who feels squeezed leaves.
     */
    WEEKLY_DISCOUNT: 0.04,
    /** Monthly: 8% off, 26-day lock-in. */
    MONTHLY_DISCOUNT: 0.08,
    /** Extra discount when a passenger buys both legs (A→B and B→A) together. */
    ROUND_TRIP_DISCOUNT: 0.03,
    /** Service days in each plan. */
    WEEKLY_SERVICE_DAYS: 6,
    MONTHLY_SERVICE_DAYS: 26,
  },

  shortFill: {
    /**
     * When a pool departs with 2 of 3 seats, each rider tops up by at most this
     * fraction of the seat fare. The fund covers the rest.
     */
    TWO_SEAT_TOPUP_RATE: 0.4,
    /**
     * A solo rider is never asked for more than this multiple of the seat fare,
     * no matter what the trip actually costs. Beyond this we'd rather lose the ride.
     */
    SOLO_MAX_MULTIPLE: 1.7,
    /** Paid to a driver from the fund when a pool is cancelled for lack of riders. */
    DRIVER_STANDBY_RUPEES: 40,
    /** How long we hold a departure open past its deadline while asking to wait. */
    EXTENSION_MINUTES: 10,
    /** Failures within a 7-day window before a slot is pulled from the schedule. */
    SLOT_FAILURES_BEFORE_RETIRE: 3,
  },

  grace: {
    /** No-questions-asked cancellations included with each plan. */
    WEEKLY_GRACE_DAYS: 1,
    MONTHLY_GRACE_DAYS: 4,
    /** Drivers get grace too — the obligation is symmetric. */
    DRIVER_MONTHLY_GRACE_DAYS: 2,
    /**
     * A passenger cancelling more than this fraction of rides over the sampling
     * window has their next cycle's grace halved. They are told why.
     */
    ABUSE_CANCEL_RATE: 0.3,
    ABUSE_SAMPLE_WINDOW_DAYS: 14,
    ABUSE_MIN_RIDES: 6,
  },

  /**
   * The notice ladder. Reached only when a reseat failed AND no grace days remain.
   * `creditFraction` tracks our real ability to resell the seat at that notice —
   * which is why it can be explained to an angry user without embarrassment.
   */
  notice: {
    TIERS: [
      { minHours: 12, creditFraction: 1.0, label: 'night_before' },
      { minHours: 3, creditFraction: 0.75, label: 'same_day_early' },
      { minHours: 1, creditFraction: 0.5, label: 'same_day_late' },
      { minHours: 0, creditFraction: 0.0, label: 'last_minute' },
    ],
  } as const,

  credits: {
    /** Credit days expire this long after issue. */
    EXPIRY_DAYS: 60,
    /** Grace period after a pass lapses during which credits survive. */
    POST_LAPSE_GRACE_DAYS: 30,
    /** Beyond this, we stop selling and suggest a smaller plan instead. */
    MAX_BANKED_DAYS: 8,
    /** A pass with more than this fraction cancelled gets a downgrade nudge. */
    DOWNGRADE_SUGGESTION_THRESHOLD: 0.5,
  },

  driverPenalty: {
    /** Reliability points deducted, by how late the driver cancelled. */
    CANCEL_12H_PLUS: 0,
    CANCEL_3_TO_12H: 2,
    CANCEL_UNDER_3H: 5,
    NO_SHOW: 10,
    /** Paid to each stranded passenger when a driver cancels late or no-shows. */
    INCONVENIENCE_CREDIT_RUPEES: 30,
    /** Strikes before the driver is suspended from pass matching. */
    STRIKES_BEFORE_SUSPENSION: 3,
    STRIKE_WINDOW_DAYS: 30,
    SUSPENSION_DAYS: 14,
    /** Minutes past departure with no driver in the geofence before we auto-rematch. */
    NO_SHOW_DETECTION_MINUTES: 5,
  },

  matching: {
    /** Candidate density thresholds that switch the matching UI. */
    MANUAL_BELOW: 8,
    AUTO_ABOVE: 25,
    DENSITY_WINDOW_DAYS: 14,
    /** Match score weights. Must sum to 1. */
    WEIGHTS: {
      departureTime: 0.35,
      pickupProximity: 0.2,
      dropProximity: 0.15,
      reliability: 0.15,
      repeatCoRider: 0.1,
      genderPreference: 0.05,
    },
    /** Departure times within this many minutes are treated as one pool. */
    POOL_WINDOW_MINUTES: 7,
    /** Beyond this walking distance a pickup point is not a match at all. */
    MAX_PICKUP_METRES: 400,
    MAX_DROP_METRES: 800,
    /** How long a seat is held while the passenger confirms. */
    SEAT_HOLD_SECONDS: 90,
  },

  fuel: {
    /** Reward for a valid fuel log, paid as platform credit — never cash. */
    REWARD_RUPEES: 20,
    /** Halved when the driver is logging against a declared substitute vehicle. */
    SUBSTITUTE_VEHICLE_REWARD_RUPEES: 10,
    /** Rate limiting. Your suggestion: two a week, and it's the right number. */
    MAX_REWARDED_LOGS_PER_WEEK: 2,
    MIN_HOURS_BETWEEN_LOGS: 6,
    /** Substitute-vehicle declarations allowed per calendar month. */
    MAX_SUBSTITUTE_LOGS_PER_MONTH: 3,
    /** Dwell inside a fuel-station geofence before we prompt at all. */
    GEOFENCE_DWELL_SECONDS: 120,
    /** Plausible fill quantities for a three-wheeler. Outside → no reward. */
    CNG_MIN_KG: 1.5,
    CNG_MAX_KG: 9.0,
    PETROL_MIN_L: 2.0,
    PETROL_MAX_L: 10.0,
    /** Unit price must sit within this band of the station's daily median. */
    PRICE_DEVIATION_TOLERANCE: 0.15,
  },

  emissions: {
    /** kg CO2e per unit burned. Source: IPCC 2006 / India GHG Program factors. */
    CNG_KG_CO2E_PER_KG: 2.75,
    PETROL_KG_CO2E_PER_LITRE: 2.31,
    /** Typical three-wheeler efficiency, used when we lack per-vehicle data. */
    DEFAULT_CNG_KM_PER_KG: 32,
    DEFAULT_PETROL_KM_PER_LITRE: 28,
  },

  guaranteeFund: {
    /** Below this many days of projected outflow, NOW mode sheds weak corridors. */
    MIN_RESERVE_DAYS: 14,
    /** Planning assumptions. Reality replaces these once there is data. */
    ASSUMED_CANCEL_RATE: 0.08,
    ASSUMED_RESEAT_RATE: 0.55,
    ASSUMED_SHORT_FILL_RATE: 0.12,
  },

  corridor: {
    /** Never launch a corridor with fewer committed drivers than this. */
    MIN_DRIVERS_TO_LAUNCH: 6,
  },
} as const;

export type NoticeTierLabel = (typeof POLICY.notice.TIERS)[number]['label'];
