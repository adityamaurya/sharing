import { describe, expect, it } from 'vitest';

import { rupees, ZERO } from '../../money.js';
import { POLICY } from '../../policy.js';
import {
  buildRewardOffer,
  dwellSeconds,
  estimateQueueMinutes,
  evaluateCampaign,
  type StationPresence,
} from '../campaign.js';

const NOW = Date.UTC(2026, 7, 8, 3, 30); // 09:00 IST — the morning peak

function presence(over: Partial<StationPresence> = {}): StationPresence {
  return {
    stationId: 'mgl-dombivli-midc',
    stationName: 'Mahanagar Gas, Dombivli MIDC',
    enteredAt: NOW - 6 * 60_000,
    lastSeenAt: NOW,
    exitedAt: null,
    maxSpeedKmphInside: 4,
    onShift: true,
    ...over,
  };
}

describe('dwellSeconds', () => {
  it('measures to the exit when there is one', () => {
    expect(
      dwellSeconds(presence({ enteredAt: NOW - 600_000, exitedAt: NOW - 60_000, lastSeenAt: NOW })),
    ).toBe(540);
  });

  it('measures to the last fix while still inside', () => {
    expect(dwellSeconds(presence({ enteredAt: NOW - 300_000, lastSeenAt: NOW }))).toBe(300);
  });
});

describe('evaluateCampaign', () => {
  it('says nothing in the first few minutes', () => {
    const state = evaluateCampaign(presence({ enteredAt: NOW - 2 * 60_000 }), NOW);
    expect(state.stage).toBe('watching');
    expect(state.message).toBe('');
  });

  it('arms at five minutes and reserves the reward', () => {
    const state = evaluateCampaign(presence({ enteredAt: NOW - 5 * 60_000 }), NOW);
    expect(state.stage).toBe('armed');
    expect(state.queueMinutesSoFar).toBe(5);
    expect(state.message).toContain('₹20');
  });

  it('does not ask about the fill while they are still in the queue', () => {
    // The whole point of the two-stage design: at minute five the driver cannot
    // yet answer "how much did you fill", so we must not ask.
    const state = evaluateCampaign(presence({ enteredAt: NOW - 20 * 60_000 }), NOW);
    expect(state.stage).toBe('armed');
    expect(state.message).not.toContain('Did you fill');
  });

  it('asks on the way out after a real stop', () => {
    const state = evaluateCampaign(
      presence({ enteredAt: NOW - 25 * 60_000, exitedAt: NOW - 60_000, lastSeenAt: NOW - 60_000 }),
      NOW,
    );
    expect(state.stage).toBe('ask');
    expect(state.message).toBe('Did you fill gas?');
    expect(state.minutesLeftToAnswer).toBe(POLICY.fuel.ASK_WINDOW_MINUTES - 1);
  });

  it('stays quiet for a driver who only passed the pump', () => {
    const state = evaluateCampaign(
      presence({ enteredAt: NOW - 40_000, exitedAt: NOW - 10_000, lastSeenAt: NOW - 10_000 }),
      NOW,
    );
    expect(state.stage).toBe('passed_through');
    expect(state.message).toBe('');
  });

  it('treats a fast transit as a pass-through even if it takes five minutes', () => {
    // Heavy forecourt traffic can rack up dwell without anybody joining a queue.
    const state = evaluateCampaign(
      presence({ enteredAt: NOW - 8 * 60_000, maxSpeedKmphInside: 24 }),
      NOW,
    );
    expect(state.stage).toBe('passed_through');
  });

  it('expires the ask rather than nagging hours later', () => {
    const exited = NOW - (POLICY.fuel.ASK_WINDOW_MINUTES + 5) * 60_000;
    const state = evaluateCampaign(
      presence({ enteredAt: exited - 20 * 60_000, exitedAt: exited, lastSeenAt: exited }),
      NOW,
    );
    expect(state.stage).toBe('expired');
  });

  it('is silent off shift', () => {
    const state = evaluateCampaign(presence({ onShift: false }), NOW);
    expect(state.stage).toBe('ineligible');
    expect(state.message).toBe('');
  });
});

describe('estimateQueueMinutes', () => {
  it('refuses to guess from fewer than three drivers', () => {
    const estimate = estimateQueueMinutes([1_200, 1_500]);
    expect(estimate.minutes).toBeNull();
    expect(estimate.message).toContain('Not enough drivers');
  });

  it('reports the median of recent dwells', () => {
    // 10, 20, 30 minutes → 20.
    const estimate = estimateQueueMinutes([600, 1_200, 1_800]);
    expect(estimate.minutes).toBe(20);
    expect(estimate.basedOnDrivers).toBe(3);
  });

  it('is not dragged up by one driver who parked for lunch', () => {
    const estimate = estimateQueueMinutes([900, 960, 1_020, 1_080, 7_200]);
    expect(estimate.minutes).toBe(17); // median 1020s, not the 2380s mean
  });

  it('ignores pass-through dwells', () => {
    const estimate = estimateQueueMinutes([30, 45, 60, 900, 1_200, 1_500]);
    expect(estimate.basedOnDrivers).toBe(3);
    expect(estimate.minutes).toBe(20);
  });

  it('matches the reported real-world range on ordinary traffic', () => {
    // Reported Mumbai norm is 15–30 min; a plausible sample must land in it.
    const estimate = estimateQueueMinutes([840, 1_080, 1_320, 1_500, 1_620]);
    expect(estimate.minutes).toBeGreaterThanOrEqual(15);
    expect(estimate.minutes).toBeLessThanOrEqual(30);
  });
});

describe('buildRewardOffer', () => {
  const fee = rupees(4);

  it('offers the flat ₹20 with no streak', () => {
    const offer = buildRewardOffer({
      consecutiveRewardedLogs: 0,
      rewardedLogsThisWeek: 0,
      platformFeePerRide: fee,
    });
    expect(offer.total).toBe(rupees(20));
    expect(offer.streakBonus).toBe(0);
    expect(offer.logsToBonus).toBe(POLICY.fuel.STREAK_LENGTH_FOR_BONUS - 1);
  });

  it('adds the streak bonus on the qualifying log', () => {
    const offer = buildRewardOffer({
      consecutiveRewardedLogs: POLICY.fuel.STREAK_LENGTH_FOR_BONUS - 1,
      rewardedLogsThisWeek: 1,
      platformFeePerRide: fee,
    });
    expect(offer.streakBonus).toBe(rupees(POLICY.fuel.STREAK_BONUS_RUPEES));
    expect(offer.total).toBe(rupees(30));
    expect(offer.logsToBonus).toBe(0);
    expect(offer.headline).toContain('streak');
  });

  it('states the value in rides rather than in abstract credit', () => {
    const offer = buildRewardOffer({
      consecutiveRewardedLogs: 0,
      rewardedLogsThisWeek: 0,
      platformFeePerRide: fee,
    });
    expect(offer.worthLine).toBe('Covers the app fee on your next 5 rides.');
  });

  it('never advertises more logs than the weekly cap allows', () => {
    const offer = buildRewardOffer({
      consecutiveRewardedLogs: 2,
      rewardedLogsThisWeek: POLICY.fuel.MAX_REWARDED_LOGS_PER_WEEK,
      platformFeePerRide: fee,
    });
    expect(offer.logsLeftThisWeek).toBe(0);
  });

  it('degrades gracefully when the fee is unknown', () => {
    const offer = buildRewardOffer({
      consecutiveRewardedLogs: 0,
      rewardedLogsThisWeek: 0,
      platformFeePerRide: ZERO,
    });
    expect(offer.worthLine).toBe('Credited against your app fees.');
  });
});
