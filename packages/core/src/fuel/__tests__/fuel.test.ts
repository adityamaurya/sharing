import { describe, expect, it } from 'vitest';

import { formatINR, rupees, toRupees } from '../../money.js';
import { POLICY } from '../../policy.js';
import type { DriverFuelHistory, FuelLogSubmission } from '../../types.js';
import {
  detectVehicleSharingAbuse,
  evaluateFuelLog,
  platesMatch,
  quantityIsPlausible,
} from '../guardrails.js';
import { describeSaving, tripEmissions } from '../emissions.js';

const NOW = Date.UTC(2026, 7, 12, 9, 0);
const HOUR = 3_600_000;
const DAY = 86_400_000;

const CNG_PER_KG = rupees(80);

function submission(overrides: Partial<FuelLogSubmission> = {}): FuelLogSubmission {
  return {
    driverId: 'd1',
    stationId: 'mgl-dombivli-01',
    fuelType: 'cng',
    quantity: 4.2,
    amountPaid: rupees(336), // 4.2 kg × ₹80
    submittedAt: NOW,
    ocrPlate: 'MH 05 AB 1234',
    registeredPlate: 'MH05AB1234',
    substituteVehicleDeclared: false,
    dwellSeconds: 180,
    onShift: true,
    tripsSinceLastLog: 3,
    ...overrides,
  };
}

const NO_HISTORY: DriverFuelHistory = {
  rewardedLogTimestamps: [],
  substituteLogTimestampsThisMonth: [],
};

describe('plate matching survives a dusty plate at a petrol pump', () => {
  it('ignores spacing and case', () => {
    expect(platesMatch('mh 05 ab 1234', 'MH05AB1234')).toBe(true);
  });

  it('forgives a single OCR character, because our camera is not the driver’s fault', () => {
    expect(platesMatch('MH05AB1235', 'MH05AB1234')).toBe(true);
    expect(platesMatch('MH05AB123', 'MH05AB1234')).toBe(true);
  });

  it('does not forgive a different vehicle', () => {
    expect(platesMatch('MH05XY9999', 'MH05AB1234')).toBe(false);
    expect(platesMatch(null, 'MH05AB1234')).toBe(false);
  });
});

describe('quantity plausibility for a three-wheeler', () => {
  it('accepts a normal fill', () => {
    expect(quantityIsPlausible('cng', 4.2)).toBe(true);
    expect(quantityIsPlausible('petrol', 5)).toBe(true);
  });

  it('rejects a tank that could not fit in a rickshaw', () => {
    expect(quantityIsPlausible('cng', 40)).toBe(false);
    expect(quantityIsPlausible('petrol', 45)).toBe(false);
    expect(quantityIsPlausible('cng', 0.2)).toBe(false);
  });
});

describe('the reward path', () => {
  it('pays ₹20 in credit for a clean log', () => {
    const decision = evaluateFuelLog(submission(), NO_HISTORY, CNG_PER_KG);

    expect(decision.accepted).toBe(true);
    expect(formatINR(decision.reward)).toBe('₹20');
    expect(decision.rejectionCodes).toEqual([]);
  });

  it('pays in platform credit, never cash — cash-out is how these get farmed', () => {
    // The decision carries a rupee amount but the *type* is credit by construction:
    // there is no payout channel in this module, only a credit amount.
    const decision = evaluateFuelLog(submission(), NO_HISTORY, CNG_PER_KG);
    expect(toRupees(decision.reward)).toBe(POLICY.fuel.REWARD_RUPEES);
  });
});

describe('guardrails — each one closes a specific way to farm this', () => {
  it('will not pay someone for idling at a pump without buying anything', () => {
    const d = evaluateFuelLog(submission({ dwellSeconds: 30 }), NO_HISTORY, CNG_PER_KG);
    expect(d.reward).toBe(0);
    expect(d.rejectionCodes).toContain('insufficient_dwell');
  });

  it('will not pay twice for one fill', () => {
    const d = evaluateFuelLog(
      submission(),
      { ...NO_HISTORY, rewardedLogTimestamps: [NOW - 2 * HOUR] },
      CNG_PER_KG,
    );
    expect(d.rejectionCodes).toContain('too_soon_after_last_log');
  });

  it('stops at two rewarded logs a week, exactly as specified', () => {
    const history: DriverFuelHistory = {
      rewardedLogTimestamps: [NOW - 1 * DAY, NOW - 3 * DAY],
      substituteLogTimestampsThisMonth: [],
    };
    const d = evaluateFuelLog(submission(), history, CNG_PER_KG);
    expect(d.rejectionCodes).toContain('weekly_limit_reached');
    expect(d.reward).toBe(0);
  });

  it('lets the counter roll off after seven days', () => {
    const history: DriverFuelHistory = {
      rewardedLogTimestamps: [NOW - 8 * DAY, NOW - 9 * DAY],
      substituteLogTimestampsThisMonth: [],
    };
    expect(evaluateFuelLog(submission(), history, CNG_PER_KG).reward).toBe(rupees(20));
  });

  it('requires a trip between logs, so a parked rickshaw earns nothing', () => {
    const d = evaluateFuelLog(submission({ tripsSinceLastLog: 0 }), NO_HISTORY, CNG_PER_KG);
    expect(d.rejectionCodes).toContain('no_trips_since_last_log');
  });

  it('blocks an undeclared plate mismatch and tells the driver how to fix it', () => {
    const d = evaluateFuelLog(
      submission({ ocrPlate: 'MH05ZZ0000' }),
      NO_HISTORY,
      CNG_PER_KG,
    );
    expect(d.rejectionCodes).toContain('plate_mismatch_undeclared');
    expect(d.reason).toMatch(/different rickshaw/);
  });

  it('allows a declared friend’s rickshaw at half reward', () => {
    const d = evaluateFuelLog(
      submission({ ocrPlate: 'MH05ZZ0000', substituteVehicleDeclared: true }),
      NO_HISTORY,
      CNG_PER_KG,
    );
    expect(formatINR(d.reward)).toBe('₹10');
    expect(d.rejectionCodes).toEqual([]);
  });

  it('caps substitute-vehicle logs at three a month', () => {
    const history: DriverFuelHistory = {
      rewardedLogTimestamps: [],
      substituteLogTimestampsThisMonth: [NOW - 1 * DAY, NOW - 3 * DAY, NOW - 5 * DAY],
    };
    const d = evaluateFuelLog(
      submission({ ocrPlate: 'MH05ZZ0000', substituteVehicleDeclared: true }),
      history,
      CNG_PER_KG,
    );
    expect(d.rejectionCodes).toContain('substitute_limit_reached');
  });

  it('spots one rickshaw farming two driver accounts', () => {
    const seen = [{ deviceId: 'dev-1', plate: 'MH05AB1234', driverId: 'other-driver' }];
    expect(detectVehicleSharingAbuse('dev-1', 'MH 05 AB 1234', seen, 'd1')).toBe(true);
    expect(detectVehicleSharingAbuse('dev-2', 'MH 05 AB 1234', seen, 'd1')).toBe(false);
  });
});

describe('accept the data, gate the reward', () => {
  it('keeps the log even when it pays nothing', () => {
    const d = evaluateFuelLog(submission({ dwellSeconds: 10 }), NO_HISTORY, CNG_PER_KG);
    expect(d.accepted).toBe(true);
    expect(d.reward).toBe(0);
  });

  it('holds an odd price for review rather than accusing anyone', () => {
    // ₹336 for 4.2 kg implies ₹80/kg; tell it the station median is ₹60.
    const d = evaluateFuelLog(submission(), NO_HISTORY, rupees(60));
    expect(d.heldForReview).toBe(true);
    expect(d.rejectionCodes).toEqual([]);
    expect(d.reason).toMatch(/under review/);
  });

  it('does not penalise the first driver at a station with no price history yet', () => {
    const d = evaluateFuelLog(submission(), NO_HISTORY, null);
    expect(d.heldForReview).toBe(false);
    expect(formatINR(d.reward)).toBe('₹20');
  });
});

describe('emissions', () => {
  it('shows a two-thirds cut per passenger for a full rickshaw', () => {
    const e = tripEmissions('cng', 6.5, 3);
    expect(e.savedPercent).toBeCloseTo(66.67, 1);
    expect(e.perPassengerKgCo2e).toBeCloseTo(e.soloKgCo2e / 3, 6);
  });

  it('claims nothing for a solo ride', () => {
    expect(tripEmissions('cng', 6.5, 1).savedKgCo2e).toBe(0);
  });

  it('reports electric as tailpipe-zero rather than overclaiming on grid mix', () => {
    expect(tripEmissions('electric', 10, 3).totalKgCo2e).toBe(0);
  });

  it('phrases savings in something a person can picture', () => {
    expect(describeSaving(0.4)).toMatch(/^400 g/);
    expect(describeSaving(12.5)).toMatch(/^12\.5 kg/);
    expect(describeSaving(63)).toMatch(/tree-years/);
  });
});
