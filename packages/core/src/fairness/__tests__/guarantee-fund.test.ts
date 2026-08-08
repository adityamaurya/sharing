import { describe, expect, it } from 'vitest';

import { formatINR, rupees } from '../../money.js';
import { defaultAssumptions, projectFund, reserveStatus, shedOrder } from '../guaranteeFund.js';
import { assessPassHealth } from '../credits.js';
import { clusterGraceAllowance, nextCycleGraceDays } from '../grace.js';

const AVG_SEAT_FARE = rupees(48);
const AVG_SHORT_FILL_SUBSIDY = rupees(27);

describe('fund solvency, stated honestly', () => {
  const projection = projectFund(100, AVG_SEAT_FARE, defaultAssumptions(AVG_SHORT_FILL_SUBSIDY));

  it('does NOT self-fund at launch assumptions — this is a budgeted cost, not a surprise', () => {
    expect(projection.solvent).toBe(false);
    expect(formatINR(projection.income)).toBe('₹192');
    expect(formatINR(projection.totalOutflow)).toBe('₹280.80');
    expect(formatINR(projection.net)).toBe('-₹88.80');
  });

  it('quantifies the cold-start subsidy per seat, so it can go in a budget line', () => {
    expect(formatINR(projection.subsidyPerSeat)).toBe('₹0.89');
  });

  it('turns a surplus once density lifts reseat and fill rates', () => {
    const mature = projectFund(100, AVG_SEAT_FARE, {
      cancelRate: 0.08,
      reseatRate: 0.75,
      shortFillRate: 0.05,
      avgShortFillSubsidy: AVG_SHORT_FILL_SUBSIDY,
    });

    expect(mature.solvent).toBe(true);
    expect(mature.net).toBeGreaterThan(0);
    expect(mature.subsidyPerSeat).toBe(0);
  });

  it('is most sensitive to reseat rate — the highest-leverage number in the business', () => {
    const base = projectFund(100, AVG_SEAT_FARE, defaultAssumptions(AVG_SHORT_FILL_SUBSIDY));
    const betterReseat = projectFund(100, AVG_SEAT_FARE, {
      ...defaultAssumptions(AVG_SHORT_FILL_SUBSIDY),
      reseatRate: 0.75,
    });

    expect(betterReseat.cancellationOutflow).toBeLessThan(base.cancellationOutflow / 1.7);
  });
});

describe('degrade gracefully, never insolvently', () => {
  const dailyOutflow = rupees(1000);

  it('runs normally with plenty of cover', () => {
    const s = reserveStatus(rupees(50_000), dailyOutflow);
    expect(s.health).toBe('healthy');
    expect(s.disableNowMode).toBe(false);
  });

  it('warns before it hurts', () => {
    const s = reserveStatus(rupees(20_000), dailyOutflow);
    expect(s.health).toBe('watch');
    expect(s.disableNowMode).toBe(false);
  });

  it('sheds instant pooling — not passes — when the reserve runs thin', () => {
    const s = reserveStatus(rupees(5_000), dailyOutflow);
    expect(s.health).toBe('shedding');
    expect(s.disableNowMode).toBe(true);
    expect(s.message).toMatch(/Passes and scheduled rides are unaffected/);
  });

  it('sheds the corridors burning the most subsidy for the least fill, first', () => {
    const order = shedOrder([
      { corridorId: 'healthy', fillRate: 0.95, monthlySubsidy: rupees(500) },
      { corridorId: 'bleeding', fillRate: 0.3, monthlySubsidy: rupees(4000) },
      { corridorId: 'middling', fillRate: 0.7, monthlySubsidy: rupees(1500) },
    ]);
    expect(order).toEqual(['bleeding', 'middling', 'healthy']);
  });
});

describe('anti-abuse without making anyone a judge', () => {
  it('leaves an ordinary passenger alone', () => {
    const r = nextCycleGraceDays('monthly', { ridesScheduled: 22, ridesCancelled: 3 });
    expect(r.reduced).toBe(false);
    expect(r.graceDays).toBe(4);
    expect(r.message).toBeNull();
  });

  it('halves grace for a serial canceller and explains why in plain words', () => {
    const r = nextCycleGraceDays('monthly', { ridesScheduled: 20, ridesCancelled: 9 });
    expect(r.reduced).toBe(true);
    expect(r.graceDays).toBe(2);
    expect(r.message).toContain('45%');
    expect(r.message).toMatch(/smaller pass/i);
  });

  it('never drops below one grace day — the goal is behaviour change, not a broken commute', () => {
    const r = nextCycleGraceDays('weekly', { ridesScheduled: 10, ridesCancelled: 9 });
    expect(r.graceDays).toBe(1);
  });

  it('needs enough rides before judging anybody', () => {
    const r = nextCycleGraceDays('monthly', { ridesScheduled: 3, ridesCancelled: 3 });
    expect(r.reduced).toBe(false);
  });

  it('shares one allowance across duplicate accounts instead of multiplying it', () => {
    expect(clusterGraceAllowance('monthly', 1)).toBe(4);
    expect(clusterGraceAllowance('monthly', 2)).toBe(2);
    expect(clusterGraceAllowance('monthly', 9)).toBe(1);
  });
});

describe('telling somebody they are over-buying', () => {
  it('says nothing to a passenger using their pass', () => {
    expect(assessPassHealth(1, 20, 2).kind).toBe('ok');
  });

  it('offers a smaller plan when half the rides go unused', () => {
    const advice = assessPassHealth(2, 20, 12);
    expect(advice.kind).toBe('suggest_downgrade');
  });

  it('stops the credit pile growing past the cap and suggests pausing', () => {
    const advice = assessPassHealth(8, 20, 8);
    expect(advice.kind).toBe('cap_reached');
    if (advice.kind === 'cap_reached') {
      expect(advice.message).toMatch(/pause/i);
    }
  });
});
