import { POLICY } from '../policy.js';
import { add, formatINR, rupees, ZERO, type Paise } from '../money.js';

/**
 * The ₹20 fuel campaign: when to ask, and how to make the ask worth answering.
 *
 * ## Why the timing is what it is
 *
 * Reported CNG waits for Mumbai auto-rickshaws are 15–30 minutes on an ordinary
 * morning, and two to four hours when supply is short. That single fact decides
 * the whole design, because it means a driver inside a station geofence for five
 * minutes has not filled anything yet — they are somewhere in a queue, engine
 * off, phone in hand, with nothing to do.
 *
 * That is the most attentive a working driver will ever be. So the campaign
 * splits in two:
 *
 *   1. **Arm** at five minutes in. We do not ask about the fill yet — they cannot
 *      answer. We tell them the reward is reserved, and we give them something
 *      useful right then: how long this queue is running today, from other
 *      drivers' dwell times. That trade is the point. An app that only ever takes
 *      data gets uninstalled; one that hands back the thing you are sitting in
 *      the queue wondering about gets opened voluntarily.
 *
 *   2. **Ask** on the way out — "did you fill gas?" — when the answer exists and
 *      is one number long.
 *
 * A driver who merely passes the pump is asked nothing at all.
 *
 * ## Why the reward is shaped the way it is
 *
 * ₹20 is not much. What makes it worth 25 seconds is being told, in the driver's
 * own units, what it buys: a day of app fees, or four rides' worth. Abstract
 * "credit" is worth nothing to somebody deciding whether to put their tea down.
 *
 * Everything here is a real thing being offered, stated plainly. No countdown
 * timers on the offer, no "3 drivers ahead of you claimed theirs", no streak that
 * silently resets to punish a day off. Those work once and cost you the driver.
 */

const SECONDS_PER_MINUTE = 60;

// ── Presence: what the device saw ───────────────────────────────────────────

export interface StationPresence {
  readonly stationId: string;
  readonly stationName: string;
  /** First fix inside the geofence. */
  readonly enteredAt: number;
  /** Most recent fix inside the geofence. */
  readonly lastSeenAt: number;
  /** First fix back outside it, or null while still inside. */
  readonly exitedAt: number | null;
  /**
   * Fastest speed observed inside the fence, km/h. A driver crawling forward in
   * a queue registers 2–6; one cutting across the forecourt registers 20+.
   */
  readonly maxSpeedKmphInside: number;
  readonly onShift: boolean;
}

export function dwellSeconds(presence: StationPresence): number {
  const end = presence.exitedAt ?? presence.lastSeenAt;
  return Math.max(0, Math.round((end - presence.enteredAt) / 1000));
}

// ── What to show ────────────────────────────────────────────────────────────

export type CampaignStage =
  /** Inside the fence, but not long enough to be sure of anything. */
  | 'watching'
  /** Inside, five minutes plus, moving at queue speed. Reward reserved. */
  | 'armed'
  /** Out of the fence after a real stop. Ask the question now. */
  | 'ask'
  /** Drove past. Say nothing. */
  | 'passed_through'
  /** Left too long ago — the ask has gone stale. */
  | 'expired'
  /** Off shift, or otherwise not eligible. */
  | 'ineligible';

export interface CampaignState {
  readonly stage: CampaignStage;
  readonly stationId: string;
  readonly stationName: string;
  readonly dwellSeconds: number;
  /** Set only while `armed` — how long they have been in the queue. */
  readonly queueMinutesSoFar: number;
  /** Set only for `ask` — minutes left to answer before it expires. */
  readonly minutesLeftToAnswer: number;
  /** Plain-language line for the banner. Empty when nothing should be shown. */
  readonly message: string;
}

export function evaluateCampaign(presence: StationPresence, now: number): CampaignState {
  const dwell = dwellSeconds(presence);
  const base = {
    stationId: presence.stationId,
    stationName: presence.stationName,
    dwellSeconds: dwell,
    queueMinutesSoFar: Math.floor(dwell / SECONDS_PER_MINUTE),
    minutesLeftToAnswer: 0,
  };

  if (!presence.onShift) {
    return { ...base, stage: 'ineligible', message: '' };
  }

  // Moving fast inside the fence: cutting through, not queueing. Checked before
  // dwell, because a slow crawl through heavy forecourt traffic can otherwise
  // accumulate five minutes without the driver ever joining a queue.
  if (presence.maxSpeedKmphInside > POLICY.fuel.QUEUE_MAX_SPEED_KMPH) {
    return { ...base, stage: 'passed_through', message: '' };
  }

  // Still there.
  if (presence.exitedAt === null) {
    if (dwell < POLICY.fuel.DWELL_TO_ARM_SECONDS) {
      return { ...base, stage: 'watching', message: '' };
    }
    return {
      ...base,
      stage: 'armed',
      message:
        `You have been at ${presence.stationName} ${base.queueMinutesSoFar} minutes. ` +
        `Tell us what you filled when you are done — ₹${POLICY.fuel.REWARD_RUPEES} is being held for you.`,
    };
  }

  // Gone. Was it a real stop?
  if (dwell <= POLICY.fuel.PASS_THROUGH_MAX_DWELL_SECONDS) {
    return { ...base, stage: 'passed_through', message: '' };
  }

  const minutesSinceExit = Math.floor((now - presence.exitedAt) / 60_000);
  const left = POLICY.fuel.ASK_WINDOW_MINUTES - minutesSinceExit;

  if (left <= 0) {
    return { ...base, stage: 'expired', message: '' };
  }

  return {
    ...base,
    stage: 'ask',
    minutesLeftToAnswer: left,
    message: 'Did you fill gas?',
  };
}

// ── Live queue estimate: the thing we give back ─────────────────────────────

export interface QueueEstimate {
  /** Null when too few drivers have been seen to say anything honest. */
  readonly minutes: number | null;
  readonly basedOnDrivers: number;
  readonly message: string;
}

/**
 * How long is the queue at this pump right now?
 *
 * Estimated from the dwell times of other Sharing drivers who have been at the
 * same station in the last couple of hours — a by-product of the campaign that
 * happens to be the single most useful thing we could tell a driver deciding
 * which pump to drive to.
 *
 * The median, not the mean: one driver who parked to eat lunch would otherwise
 * drag the estimate up by twenty minutes.
 *
 * Under three drivers we say we do not know. A confident wrong number sends
 * somebody four kilometres to a longer queue, and they will remember that.
 */
export function estimateQueueMinutes(
  completedDwellSecondsRecent: readonly number[],
): QueueEstimate {
  const usable = completedDwellSecondsRecent.filter(
    (s) => s > POLICY.fuel.PASS_THROUGH_MAX_DWELL_SECONDS,
  );

  if (usable.length < 3) {
    return {
      minutes: null,
      basedOnDrivers: usable.length,
      message: 'Not enough drivers here today to say how long the queue is.',
    };
  }

  const sorted = [...usable].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianSeconds =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  const minutes = Math.round(medianSeconds / SECONDS_PER_MINUTE);

  return {
    minutes,
    basedOnDrivers: usable.length,
    message: `About ${minutes} min right now — from ${usable.length} drivers here in the last two hours.`,
  };
}

// ── The offer ───────────────────────────────────────────────────────────────

export interface RewardOffer {
  readonly base: Paise;
  readonly streakBonus: Paise;
  readonly total: Paise;
  readonly streakLength: number;
  /** How many more consecutive logs until the bonus. 0 when already earned. */
  readonly logsToBonus: number;
  readonly logsLeftThisWeek: number;
  /** Headline for the prompt. Short, and about money. */
  readonly headline: string;
  /** What the credit actually buys, in the driver's units. */
  readonly worthLine: string;
  readonly effortLine: string;
}

/**
 * Build the offer shown on the prompt.
 *
 * The streak adds to a reward, never subtracts from one. A driver who takes
 * Sunday off does not get punished — they just have not earned the top-up yet.
 * Loss-framing works better on paper and breeds exactly the resentment you
 * cannot afford in a market where drivers talk to each other in a queue all
 * morning.
 */
export function buildRewardOffer({
  consecutiveRewardedLogs,
  rewardedLogsThisWeek,
  platformFeePerRide,
}: {
  consecutiveRewardedLogs: number;
  rewardedLogsThisWeek: number;
  /** Used to say what the credit is worth in rides, not in abstract "credit". */
  platformFeePerRide: Paise;
}): RewardOffer {
  const base = rupees(POLICY.fuel.REWARD_RUPEES);

  const streakEarned = consecutiveRewardedLogs + 1 >= POLICY.fuel.STREAK_LENGTH_FOR_BONUS;
  const streakBonus = streakEarned ? rupees(POLICY.fuel.STREAK_BONUS_RUPEES) : ZERO;
  const total = add(base, streakBonus);

  const logsToBonus = streakEarned
    ? 0
    : POLICY.fuel.STREAK_LENGTH_FOR_BONUS - (consecutiveRewardedLogs + 1);

  const logsLeftThisWeek = Math.max(
    0,
    POLICY.fuel.MAX_REWARDED_LOGS_PER_WEEK - rewardedLogsThisWeek,
  );

  const rides = platformFeePerRide > 0 ? Math.floor(total / platformFeePerRide) : 0;

  return {
    base,
    streakBonus,
    total,
    streakLength: consecutiveRewardedLogs,
    logsToBonus,
    logsLeftThisWeek,
    headline: streakEarned
      ? `Earn ${formatINR(total)} — ${formatINR(base)} plus ${formatINR(streakBonus)} streak`
      : `Earn ${formatINR(total)}`,
    worthLine:
      rides > 0
        ? `Covers the app fee on your next ${rides} ride${rides === 1 ? '' : 's'}.`
        : 'Credited against your app fees.',
    effortLine: 'Two questions. About 25 seconds.',
  };
}
