import { describe, expect, it } from 'vitest';

import { formatINR, paise, rupees, splitCeilToRupee, toRupees } from '../../money.js';
import { POLICY } from '../../policy.js';
import { driverPayoutForSeats, quoteSeat, quoteShortFill } from '../fares.js';
import { driverGuaranteedEarnings, quotePass, quoteRoundTripPass } from '../passes.js';

const FULL_FARE = rupees(150);

describe('money is integer paise, never floats', () => {
  it('refuses fractional paise', () => {
    expect(() => paise(10.5)).toThrow(RangeError);
  });

  it('does not accumulate float error across a month of fares', () => {
    let total = 0;
    for (let i = 0; i < 26; i++) total += rupees(49.28);
    expect(total).toBe(128128);
    expect(formatINR(paise(total))).toBe('₹1,281.28');
  });

  it('groups rupees the Indian way', () => {
    expect(formatINR(rupees(100000))).toBe('₹1,00,000');
    expect(formatINR(rupees(1234567))).toBe('₹12,34,567');
  });

  it('rounds a seat share up so the driver is never short-changed by rounding', () => {
    // ₹100 / 3 = ₹33.33. Three seats at ₹34 = ₹102, so the driver gains, not loses.
    const share = splitCeilToRupee(rupees(100), 3);
    expect(formatINR(share)).toBe('₹34');
    expect(share * 3).toBeGreaterThanOrEqual(rupees(100));
  });
});

describe('spot fares', () => {
  it('charges the platform cut on top of the seat fare, not out of the driver share', () => {
    const q = quoteSeat(FULL_FARE);
    expect(q.seatFare * POLICY.SEATS_PER_POOL).toBe(FULL_FARE);
    expect(q.total).toBe(q.seatFare + q.platformFee + q.guaranteeLevy);
  });

  it('keeps the driver above the MVAG 2025 floor of 80% of the fare', () => {
    const q = quoteSeat(FULL_FARE);
    const driverShare = q.seatFare / q.total;
    expect(driverShare).toBeGreaterThanOrEqual(0.8);
  });

  it('rejects nonsense inputs rather than quietly producing a wrong price', () => {
    expect(() => quoteSeat(paise(-1))).toThrow(RangeError);
    expect(() => quoteSeat(FULL_FARE, 1)).toThrow(RangeError);
    expect(() => quoteSeat(FULL_FARE, -0.5)).toThrow(RangeError);
  });
});

describe('passes', () => {
  it('prices a weekly pass at ₹48 a seat over six days', () => {
    const p = quotePass(FULL_FARE, 'weekly');
    expect(formatINR(p.perRideSeatFare)).toBe('₹48');
    expect(p.serviceDays).toBe(6);
    expect(p.graceDays).toBe(1);
    expect(formatINR(p.upfrontTotal)).toBe('₹322.56');
  });

  it('prices a monthly pass at ₹46 a seat over twenty-six days', () => {
    const p = quotePass(FULL_FARE, 'monthly');
    expect(formatINR(p.perRideSeatFare)).toBe('₹46');
    expect(p.serviceDays).toBe(26);
    expect(p.graceDays).toBe(4);
    expect(formatINR(p.upfrontTotal)).toBe('₹1,339.52');
  });

  it('always beats paying the daily rate', () => {
    for (const plan of ['weekly', 'monthly'] as const) {
      expect(quotePass(FULL_FARE, plan).savingsVsDaily).toBeGreaterThan(0);
    }
  });

  it('keeps the pass discount small enough that a driver still wants pass riders', () => {
    // A pass seat pays the driver less than a spot seat. That gap is the volume
    // discount the driver grants for guaranteed prepaid income — but if it grows
    // past ~10% the trade stops being worth it and drivers walk.
    const spot = quoteSeat(FULL_FARE).seatFare;
    for (const plan of ['weekly', 'monthly'] as const) {
      const pass = quotePass(FULL_FARE, plan).perRideSeatFare;
      expect((spot - pass) / spot).toBeLessThanOrEqual(0.1);
    }
  });

  it('bundles a round trip at a further 3% off', () => {
    const rt = quoteRoundTripPass(FULL_FARE, FULL_FARE, 'monthly');
    const unbundled = rt.outbound.upfrontTotal + rt.inbound.upfrontTotal;
    expect(rt.upfrontTotal).toBeLessThan(unbundled);
    expect(rt.bundleDiscount / unbundled).toBeCloseTo(0.03, 3);
  });

  it('quantifies the driver pitch: guaranteed rupees before the month starts', () => {
    // One daily slot, three monthly pass holders.
    const guaranteed = driverGuaranteedEarnings(FULL_FARE, 'monthly', 3);
    expect(toRupees(guaranteed)).toBe(3588);
    expect(formatINR(guaranteed)).toBe('₹3,588');
  });
});

describe('driver payout', () => {
  it('is simply the sum of the seat fares sold, with no special cases', () => {
    const spot = quoteSeat(FULL_FARE).seatFare;
    const pass = quotePass(FULL_FARE, 'monthly').perRideSeatFare;

    expect(driverPayoutForSeats([spot, spot, spot])).toBe(FULL_FARE);
    expect(formatINR(driverPayoutForSeats([pass, pass, pass]))).toBe('₹138');
    expect(formatINR(driverPayoutForSeats([spot, pass, pass]))).toBe('₹142');
  });
});

describe('short-fill never surprises anybody', () => {
  it('rejects impossible seat counts', () => {
    expect(() => quoteShortFill(FULL_FARE, 4)).toThrow(RangeError);
    expect(() => quoteShortFill(FULL_FARE, -1)).toThrow(RangeError);
    expect(() => quoteShortFill(FULL_FARE, 1.5)).toThrow(RangeError);
  });

  it('never asks a lone passenger for more than the capped multiple', () => {
    const seat = quoteSeat(FULL_FARE).seatFare;
    const offer = quoteShortFill(FULL_FARE, 1);
    expect(offer.perPassengerTotal).toBeLessThanOrEqual(
      seat * POLICY.shortFill.SOLO_MAX_MULTIPLE,
    );
  });

  it('always makes the driver whole from fares plus fund together', () => {
    for (const seats of [1, 2, 3]) {
      const o = quoteShortFill(FULL_FARE, seats);
      expect(o.perPassengerTotal * seats + o.fundSubsidy).toBe(o.driverPayout);
    }
  });

  it('costs the fund more the emptier the rickshaw — which is why thin corridors get shed', () => {
    const solo = quoteShortFill(FULL_FARE, 1).fundSubsidy;
    const pair = quoteShortFill(FULL_FARE, 2).fundSubsidy;
    const full = quoteShortFill(FULL_FARE, 3).fundSubsidy;
    expect(solo).toBeGreaterThan(pair);
    expect(pair).toBeGreaterThan(full);
  });
});
