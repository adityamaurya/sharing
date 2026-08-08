import { describe, expect, it } from 'vitest';

import { POLICY } from '../../policy.js';
import type { LatLng } from '../../types.js';
import {
  assessDemand,
  haversineMetres,
  matchModeForDensity,
  rankCandidates,
  scoreCandidate,
  selectForMode,
  type MatchCandidate,
  type MatchRequest,
} from '../score.js';

const PALAVA_GATE_2: LatLng = { lat: 19.1723, lng: 73.0888 };
const DOMBIVLI_EAST: LatLng = { lat: 19.2154, lng: 73.0868 };

/** ~0.0009° of latitude is ~100 m. */
function north(from: LatLng, metres: number): LatLng {
  return { lat: from.lat + metres / 111_320, lng: from.lng };
}

const BASE_REQUEST: MatchRequest = {
  departureMinute: 555, // 09:15
  pickup: PALAVA_GATE_2,
  drop: DOMBIVLI_EAST,
  womenOnly: false,
  gender: 'm',
};

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    userId: 'u1',
    departureMinute: 555,
    pickup: PALAVA_GATE_2,
    drop: DOMBIVLI_EAST,
    reliability: 'gold',
    sharedPoolsWithRequester: 5,
    gender: 'm',
    ...overrides,
  };
}

describe('distance', () => {
  it('measures the real corridor at roughly five kilometres', () => {
    const m = haversineMetres(PALAVA_GATE_2, DOMBIVLI_EAST);
    expect(m).toBeGreaterThan(4_000);
    expect(m).toBeLessThan(6_000);
  });

  it('is zero for the same point and symmetric between two', () => {
    expect(haversineMetres(PALAVA_GATE_2, PALAVA_GATE_2)).toBe(0);
    expect(haversineMetres(PALAVA_GATE_2, DOMBIVLI_EAST)).toBeCloseTo(
      haversineMetres(DOMBIVLI_EAST, PALAVA_GATE_2),
      6,
    );
  });
});

describe('the density switch decides the UI, not a preference', () => {
  it('swipes when the pool is small and disappears when it is large', () => {
    expect(matchModeForDensity(0)).toBe('manual');
    expect(matchModeForDensity(7)).toBe('manual');
    expect(matchModeForDensity(8)).toBe('assisted');
    expect(matchModeForDensity(25)).toBe('assisted');
    expect(matchModeForDensity(200)).toBe('auto');
  });

  it('shows at most two co-riders in auto mode — the rest of the rickshaw', () => {
    const ranked = rankCandidates(
      BASE_REQUEST,
      Array.from({ length: 20 }, (_, i) => candidate({ userId: `u${i}` })),
    );
    expect(selectForMode('auto', ranked)).toHaveLength(POLICY.SEATS_PER_POOL - 1);
    expect(selectForMode('assisted', ranked)).toHaveLength(3);
    expect(selectForMode('manual', ranked)).toHaveLength(10);
  });
});

describe('scoring', () => {
  it('scores an identical commute near the top', () => {
    expect(scoreCandidate(BASE_REQUEST, candidate()).score).toBeGreaterThan(0.9);
  });

  it('ranks a close match above a marginal one', () => {
    const ranked = rankCandidates(BASE_REQUEST, [
      candidate({
        userId: 'marginal',
        departureMinute: 565,
        pickup: north(PALAVA_GATE_2, 300),
        reliability: 'new',
        sharedPoolsWithRequester: 0,
      }),
      candidate({ userId: 'ideal' }),
    ]);

    expect(ranked[0]?.candidate.userId).toBe('ideal');
    expect(ranked[1]?.candidate.userId).toBe('marginal');
  });

  it('refuses a pickup beyond walking distance, whatever else is good about it', () => {
    const far = scoreCandidate(
      BASE_REQUEST,
      candidate({ pickup: north(PALAVA_GATE_2, 900) }),
    );
    expect(far.eligible).toBe(false);
    expect(far.reasons).toContain('pickup_too_far');
    expect(far.score).toBe(0);
  });

  it('refuses a departure outside the pooling window', () => {
    const late = scoreCandidate(BASE_REQUEST, candidate({ departureMinute: 555 + 40 }));
    expect(late.eligible).toBe(false);
    expect(late.reasons).toContain('time_too_far');
  });

  it('keeps women-only pools women-only', () => {
    const womenOnly: MatchRequest = { ...BASE_REQUEST, womenOnly: true, gender: 'f' };
    expect(scoreCandidate(womenOnly, candidate({ gender: 'm' })).eligible).toBe(false);
    expect(scoreCandidate(womenOnly, candidate({ gender: 'f' })).eligible).toBe(true);
  });

  it('still matches brand-new users, or nobody could ever start', () => {
    const rookie = scoreCandidate(BASE_REQUEST, candidate({ reliability: 'new' }));
    expect(rookie.eligible).toBe(true);
    expect(rookie.score).toBeGreaterThan(0.5);
  });

  it('describes matches in words, never in raw scores', () => {
    const s = scoreCandidate(BASE_REQUEST, candidate());
    expect(s.highlights).toContain('Same time as you');
    expect(s.highlights).toContain('Same pickup point');
    expect(s.highlights.join(' ')).not.toMatch(/\d\.\d{2,}/);
  });
});

describe('honesty about thin demand', () => {
  it('says a pool will fill when it will', () => {
    expect(assessDemand(4, 0, null).verdict).toBe('good');
  });

  it('warns rather than pretending when there is one other person', () => {
    const advice = assessDemand(1, 5, '2:10 PM');
    expect(advice.verdict).toBe('thin');
    expect(advice.message).toMatch(/may not fill/);
    expect(advice.suggestAlternative).toBe(true);
  });

  it('tells the user to use another service when nobody is going their way', () => {
    const advice = assessDemand(0, 0, null);
    expect(advice.verdict).toBe('none');
    expect(advice.message).toMatch(/another service/);
  });

  it('points at a slot that actually works instead of just failing', () => {
    const advice = assessDemand(0, 3, '2:10 PM');
    expect(advice.message).toContain('2:10 PM');
    expect(advice.suggestAlternative).toBe(true);
  });
});
