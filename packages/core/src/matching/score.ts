import { POLICY } from '../policy.js';
import type { LatLng, ReliabilityBadge } from '../types.js';

/**
 * Match scoring.
 *
 * One engine, three UI modes. The mechanic changes as the pool grows — swipe
 * when the pool is small (six candidates is a list a human filters for free, and
 * recognising the same four faces from your building is exactly the trust that
 * makes daily pooling stick), invisible auto-match when it's large (swiping at
 * 8:40am loses to just taking a full-fare rickshaw).
 *
 * See docs/02-matching-and-pools.md.
 */

export type MatchMode = 'manual' | 'assisted' | 'auto';

/** Candidate density decides the UI, not a product manager's preference. */
export function matchModeForDensity(density: number): MatchMode {
  if (density < POLICY.matching.MANUAL_BELOW) return 'manual';
  if (density > POLICY.matching.AUTO_ABOVE) return 'auto';
  return 'assisted';
}

// ── Geometry ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 1 at zero distance, 0 at the cutoff, linear between. */
function proximityScore(metres: number, maxMetres: number): number {
  if (metres >= maxMetres) return 0;
  return 1 - metres / maxMetres;
}

function reliabilityScore(badge: ReliabilityBadge): number {
  switch (badge) {
    case 'gold':
      return 1;
    case 'silver':
      return 0.7;
    case 'new':
      // Not zero: a new user must be matchable or nobody can ever start.
      return 0.5;
  }
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface MatchCandidate {
  readonly userId: string;
  /** Minutes past local midnight. */
  readonly departureMinute: number;
  readonly pickup: LatLng;
  readonly drop: LatLng;
  readonly reliability: ReliabilityBadge;
  /** How many pools this candidate has shared with the requester before. */
  readonly sharedPoolsWithRequester: number;
  readonly gender: 'f' | 'm' | 'x' | 'unknown';
}

export interface MatchRequest {
  readonly departureMinute: number;
  readonly pickup: LatLng;
  readonly drop: LatLng;
  readonly womenOnly: boolean;
  readonly gender: 'f' | 'm' | 'x' | 'unknown';
}

export interface ScoredCandidate {
  readonly candidate: MatchCandidate;
  readonly score: number;
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  /** Short, human phrases for the swipe card. Never raw numbers. */
  readonly highlights: readonly string[];
}

export function scoreCandidate(req: MatchRequest, c: MatchCandidate): ScoredCandidate {
  const W = POLICY.matching.WEIGHTS;
  const reasons: string[] = [];
  const highlights: string[] = [];

  // Hard filters first — no amount of score rescues an ineligible match.
  const pickupM = haversineMetres(req.pickup, c.pickup);
  const dropM = haversineMetres(req.drop, c.drop);
  const minutesApart = Math.abs(req.departureMinute - c.departureMinute);

  let eligible = true;
  if (pickupM > POLICY.matching.MAX_PICKUP_METRES) {
    eligible = false;
    reasons.push('pickup_too_far');
  }
  if (dropM > POLICY.matching.MAX_DROP_METRES) {
    eligible = false;
    reasons.push('drop_too_far');
  }
  if (minutesApart > POLICY.matching.POOL_WINDOW_MINUTES * 2) {
    eligible = false;
    reasons.push('time_too_far');
  }
  if (req.womenOnly && c.gender !== 'f') {
    eligible = false;
    reasons.push('women_only_pool');
  }
  if (!req.womenOnly && c.gender === 'f') {
    // A woman who opted into women-only pools is not offered mixed pools.
    // (Caller sets `gender` to 'f' only for candidates whose own preference allows this pool.)
    reasons.push('mixed_pool_ok');
  }

  const timeScore = Math.max(0, 1 - minutesApart / (POLICY.matching.POOL_WINDOW_MINUTES * 2));
  const pickupScore = proximityScore(pickupM, POLICY.matching.MAX_PICKUP_METRES);
  const dropScore = proximityScore(dropM, POLICY.matching.MAX_DROP_METRES);
  const relScore = reliabilityScore(c.reliability);
  const repeatScore = Math.min(1, c.sharedPoolsWithRequester / 5);
  const genderScore = req.womenOnly && c.gender === 'f' ? 1 : 0.5;

  const score =
    W.departureTime * timeScore +
    W.pickupProximity * pickupScore +
    W.dropProximity * dropScore +
    W.reliability * relScore +
    W.repeatCoRider * repeatScore +
    W.genderPreference * genderScore;

  if (minutesApart <= 2) highlights.push('Same time as you');
  else highlights.push(`${minutesApart} min ${c.departureMinute > req.departureMinute ? 'later' : 'earlier'}`);

  if (pickupM <= 80) highlights.push('Same pickup point');
  else highlights.push(`${Math.round(pickupM)} m away`);

  if (c.sharedPoolsWithRequester >= 3) highlights.push('You have ridden together before');
  if (c.reliability === 'gold') highlights.push('Always on time');

  return { candidate: c, score: eligible ? score : 0, eligible, reasons, highlights };
}

export function rankCandidates(
  req: MatchRequest,
  candidates: readonly MatchCandidate[],
): readonly ScoredCandidate[] {
  return candidates
    .map((c) => scoreCandidate(req, c))
    .filter((s) => s.eligible)
    .sort((a, b) => b.score - a.score);
}

/**
 * What we actually show, by mode. In `auto` we take the top two and say nothing
 * about matching at all — the best matching UI is no matching UI.
 */
export function selectForMode(
  mode: MatchMode,
  ranked: readonly ScoredCandidate[],
): readonly ScoredCandidate[] {
  switch (mode) {
    case 'manual':
      return ranked.slice(0, 10);
    case 'assisted':
      return ranked.slice(0, 3);
    case 'auto':
      return ranked.slice(0, POLICY.SEATS_PER_POOL - 1);
  }
}

// ── Honesty about thin demand ───────────────────────────────────────────────

export type DemandVerdict = 'good' | 'thin' | 'none';

export interface DemandAdvice {
  readonly verdict: DemandVerdict;
  readonly message: string;
  readonly suggestAlternative: boolean;
}

/**
 * If there is genuinely nobody, the app says so, plainly.
 *
 * An app that fakes demand dies in one week at a Mumbai station — word travels
 * along a rickshaw queue faster than any push notification. Telling someone
 * "chance of a pool: low, try 14:10 instead" costs one ride and buys a user who
 * believes the next thing we tell them.
 */
export function assessDemand(
  candidatesInWindow: number,
  alternativeSlotCandidates: number,
  alternativeSlotLabel: string | null,
): DemandAdvice {
  if (candidatesInWindow >= POLICY.SEATS_PER_POOL - 1) {
    return {
      verdict: 'good',
      message: `${candidatesInWindow} others going your way. Pool should fill quickly.`,
      suggestAlternative: false,
    };
  }
  if (candidatesInWindow >= 1) {
    return {
      verdict: 'thin',
      message:
        `Only ${candidatesInWindow} other rider so far. It may not fill — ` +
        `you can wait, or ride solo at the capped fare.`,
      suggestAlternative: alternativeSlotCandidates > candidatesInWindow,
    };
  }
  return {
    verdict: 'none',
    message:
      alternativeSlotLabel && alternativeSlotCandidates > 0
        ? `Nobody else for this time yet. ${alternativeSlotLabel} has ` +
          `${alternativeSlotCandidates} riders — better chance of a pool.`
        : `Nobody else is going this way right now. You may prefer another service ` +
          `for this trip.`,
    suggestAlternative: alternativeSlotCandidates > 0,
  };
}
