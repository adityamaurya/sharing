import { describe, expect, it } from 'vitest';

import { formatINR, rupees } from '../../money.js';
import { POLICY } from '../../policy.js';
import { quotePass, quoteSeat } from '../../index.js';
import { driverCancellationPenalty, isDriverSuspended, noticeHours } from '../cancellation.js';
import { applyCreditToPass, prettyDate } from '../credits.js';
import { graceState } from '../grace.js';
import { assertFundingBalances, previewCancellation, resolveCancellation } from '../resolve.js';
import { quoteShortFill } from '../../pricing/fares.js';

/**
 * The worked examples from docs/01-fairness-engine.md §8, pinned as tests.
 *
 * These numbers are promises to real people with thin margins. If you change a
 * policy value in `policy.ts`, one of these will fail and name the promise you
 * just altered. That is the point — these should be hard to change by accident.
 */

/** Palava Casa Bella Gate 2 → Dombivli East Station. The real corridor. */
const PALAVA_DOMBIVLI_FULL_FARE = rupees(150);

const MONTHLY_SEAT_FARE = quotePass(PALAVA_DOMBIVLI_FULL_FARE, 'monthly').perRideSeatFare;

const HOURS = 3_600_000;
const DEPARTURE = Date.UTC(2026, 8, 2, 3, 45); // 09:15 IST on 2 Sep 2026

describe('the corridor everything is calibrated against', () => {
  it('splits a ₹150 rickshaw three ways at ₹50 a seat', () => {
    const quote = quoteSeat(PALAVA_DOMBIVLI_FULL_FARE);

    expect(formatINR(quote.seatFare)).toBe('₹50');
    expect(formatINR(quote.platformFee)).toBe('₹4');
    expect(formatINR(quote.guaranteeLevy)).toBe('₹2');
    expect(formatINR(quote.total)).toBe('₹56');
  });

  it('saves the passenger about two thirds versus riding alone', () => {
    const { total } = quoteSeat(PALAVA_DOMBIVLI_FULL_FARE);
    const saving = 1 - total / PALAVA_DOMBIVLI_FULL_FARE;
    expect(saving).toBeGreaterThan(0.6);
  });

  it('pays the driver the whole trip fare on a spot pool', () => {
    const { seatFare } = quoteSeat(PALAVA_DOMBIVLI_FULL_FARE);
    expect(seatFare * POLICY.SEATS_PER_POOL).toBe(PALAVA_DOMBIVLI_FULL_FARE);
  });
});

describe('Case A — the fever, with notice, seat reseated', () => {
  // Ravi cancels at 21:40 the night before a 09:15 ride. A LATER rider takes it.
  const outcome = resolveCancellation({
    seatFare: MONTHLY_SEAT_FARE,
    cancelledAt: DEPARTURE - 11.58 * HOURS,
    departureAt: DEPARTURE,
    graceDaysRemaining: 4,
    reseated: true,
    actor: 'passenger',
  });

  it('gives the passenger a full day back', () => {
    expect(outcome.creditDays).toBe(1);
  });

  it('does not spend a grace day, because the market solved it', () => {
    expect(outcome.graceDayConsumed).toBe(false);
  });

  it('costs the guarantee fund nothing', () => {
    expect(outcome.fundOutflow).toBe(0);
    expect(outcome.funding).toEqual([
      { source: 'replacement_rider', amount: MONTHLY_SEAT_FARE },
    ]);
  });

  it('still pays the driver in full', () => {
    expect(outcome.driverPayout).toBe(MONTHLY_SEAT_FARE);
    assertFundingBalances(outcome);
  });

  it('moves the pass end date from 4 Sep to 5 Sep', () => {
    const applied = applyCreditToPass('2026-09-04', [1, 2, 3, 4, 5, 6], outcome.creditDays, 0);
    expect(applied.newEndDate).toBe('2026-09-05');
    expect(prettyDate(applied.newEndDate)).toBe('5 Sep');
  });
});

describe('Case B — the fever, ten minutes notice, no reseat', () => {
  const outcome = resolveCancellation({
    seatFare: MONTHLY_SEAT_FARE,
    cancelledAt: DEPARTURE - 10 * 60_000,
    departureAt: DEPARTURE,
    graceDaysRemaining: 4,
    reseated: false,
    actor: 'passenger',
  });

  it('still gives a full day back — a grace day covers any notice at all', () => {
    expect(outcome.creditDays).toBe(1);
    expect(outcome.graceDayConsumed).toBe(true);
  });

  it('pays the driver out of the guarantee fund', () => {
    expect(outcome.driverPayout).toBe(MONTHLY_SEAT_FARE);
    expect(outcome.fundOutflow).toBe(MONTHLY_SEAT_FARE);
    expect(outcome.funding).toEqual([{ source: 'guarantee_fund', amount: MONTHLY_SEAT_FARE }]);
    assertFundingBalances(outcome);
  });

  it('never asks the passenger why', () => {
    // The whole outcome object carries no reason field, and the message asks for nothing.
    expect(outcome).not.toHaveProperty('reason');
    expect(outcome.explanation).not.toMatch(/why|reason|proof|verify/i);
  });

  it('shows how many grace days are left', () => {
    expect(graceState(4, 1).display).toBe('●●●○');
    expect(graceState(4, 1).remaining).toBe(3);
  });
});

describe('Case C — the fifth absence, two hours notice, no grace left', () => {
  const outcome = resolveCancellation({
    seatFare: MONTHLY_SEAT_FARE,
    cancelledAt: DEPARTURE - 2 * HOURS,
    departureAt: DEPARTURE,
    graceDaysRemaining: 0,
    reseated: false,
    actor: 'passenger',
  });

  it('lands on the 1–3 hour rung and returns half a day', () => {
    expect(outcome.noticeTier).toBe('same_day_late');
    expect(outcome.creditDays).toBe(0.5);
  });

  it('pays the driver in full, half from the fund and half from the forfeited fare', () => {
    expect(outcome.driverPayout).toBe(MONTHLY_SEAT_FARE);
    expect(outcome.fundOutflow + outcome.passengerForfeit).toBe(MONTHLY_SEAT_FARE);
    assertFundingBalances(outcome);
  });

  it('banks the half day so two halves become a whole day of travel', () => {
    const first = applyCreditToPass('2026-09-04', [1, 2, 3, 4, 5, 6], 0.5, 0);
    expect(first.wholeDaysApplied).toBe(0);
    expect(first.bankedRemainder).toBe(0.5);
    expect(first.newEndDate).toBe('2026-09-04');

    const second = applyCreditToPass(first.newEndDate, [1, 2, 3, 4, 5, 6], 0.5, first.bankedRemainder);
    expect(second.wholeDaysApplied).toBe(1);
    expect(second.newEndDate).toBe('2026-09-05');
  });

  it('warns the passenger BEFORE they confirm, never after', () => {
    const preview = previewCancellation(
      {
        seatFare: MONTHLY_SEAT_FARE,
        cancelledAt: DEPARTURE - 2 * HOURS,
        departureAt: DEPARTURE,
        graceDaysRemaining: 0,
        reseated: false,
        actor: 'passenger',
      },
      0.1,
    );

    expect(preview.headline).toContain('half');
    expect(preview.detail).toContain(formatINR(MONTHLY_SEAT_FARE));
    expect(preview.confirmLabel).toBe('Cancel anyway');
  });
});

describe('Case D — the driver oversleeps', () => {
  const penalty = driverCancellationPenalty(0, true);

  it('gives every stranded passenger a full day plus an inconvenience credit', () => {
    expect(penalty.passengerCreditDays).toBe(1);
    expect(penalty.inconvenienceCreditRupees).toBe(30);
  });

  it('costs the driver reliability and a strike', () => {
    expect(penalty.reliabilityDelta).toBe(-10);
    expect(penalty.strike).toBe(true);
  });

  it('suspends the driver from pass matching at three strikes', () => {
    expect(isDriverSuspended(2)).toBe(false);
    expect(isDriverSuspended(3)).toBe(true);
  });

  it('is free for a driver who gives a full day of notice — notice is a favour, not an offence', () => {
    const early = driverCancellationPenalty(24, false);
    expect(early.reliabilityDelta).toBe(0);
    expect(early.strike).toBe(false);
  });
});

describe('Case E — the pool that never fills', () => {
  it('caps a solo rider at 1.7× the seat fare instead of charging them for three', () => {
    const offer = quoteShortFill(PALAVA_DOMBIVLI_FULL_FARE, 1);

    expect(formatINR(offer.perPassengerTotal)).toBe('₹85');
    expect(formatINR(offer.fundSubsidy)).toBe('₹65');
    expect(offer.driverPayout).toBe(PALAVA_DOMBIVLI_FULL_FARE);
  });

  it('asks a two-seat pool for a small top-up, not the missing third fare', () => {
    const offer = quoteShortFill(PALAVA_DOMBIVLI_FULL_FARE, 2);

    expect(formatINR(offer.topUpPerPassenger)).toBe('₹20');
    expect(formatINR(offer.perPassengerTotal)).toBe('₹70');
    expect(formatINR(offer.fundSubsidy)).toBe('₹10');
  });

  it('never charges a top-up when the pool is full', () => {
    const offer = quoteShortFill(PALAVA_DOMBIVLI_FULL_FARE, 3);
    expect(offer.topUpPerPassenger).toBe(0);
    expect(offer.fundSubsidy).toBe(0);
  });

  it('compensates the driver for holding a slot nobody booked', () => {
    const offer = quoteShortFill(PALAVA_DOMBIVLI_FULL_FARE, 0);
    expect(formatINR(offer.driverPayout)).toBe('₹40');
  });

  it('makes declining free at every fill level — this is the promise, not a policy', () => {
    for (const seats of [0, 1, 2, 3]) {
      expect(quoteShortFill(PALAVA_DOMBIVLI_FULL_FARE, seats).declineIsFree).toBe(true);
    }
  });
});

describe('the invariant that defines the product', () => {
  it('pays the driver the full seat fare on every possible cancellation path', () => {
    const notices = [48, 24, 12, 11.9, 6, 3, 2.9, 1, 0.9, 0.1, 0];
    const graceLevels = [0, 1, 4];
    const reseatOutcomes = [true, false];

    for (const hours of notices) {
      for (const grace of graceLevels) {
        for (const reseated of reseatOutcomes) {
          const outcome = resolveCancellation({
            seatFare: MONTHLY_SEAT_FARE,
            cancelledAt: DEPARTURE - hours * HOURS,
            departureAt: DEPARTURE,
            graceDaysRemaining: grace,
            reseated,
            actor: 'passenger',
          });

          expect(outcome.driverPayout).toBe(MONTHLY_SEAT_FARE);
          assertFundingBalances(outcome);
        }
      }
    }
  });

  it('never lets the credit fraction exceed a whole day', () => {
    const outcome = resolveCancellation({
      seatFare: MONTHLY_SEAT_FARE,
      cancelledAt: DEPARTURE - 100 * HOURS,
      departureAt: DEPARTURE,
      graceDaysRemaining: 4,
      reseated: false,
      actor: 'passenger',
    });
    expect(outcome.creditDays).toBeLessThanOrEqual(1);
  });

  it('treats a cancellation after departure as zero notice, not negative', () => {
    expect(noticeHours(DEPARTURE + 5 * HOURS, DEPARTURE)).toBe(0);
  });
});
