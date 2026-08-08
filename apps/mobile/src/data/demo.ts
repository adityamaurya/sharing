import { quotePass, quoteSeat, rupees, type Pass } from '@sharing/core';

/**
 * Demo data for the real Palava ↔ Dombivli corridor.
 *
 * This exists so the app runs and can be walked through end-to-end before any
 * backend is connected — which is what you need for the Play Store's closed
 * testing round, and for showing a driver what the app does while standing at
 * a stand. Replace with Supabase queries when the backend is live; the shapes
 * here match the tables in `supabase/migrations`.
 */

export const HOTSPOTS = [
  {
    id: 'hs_palava_gate2',
    name: 'Palava Casa Bella, Gate 2',
    nameHi: 'पलावा कासा बेला, गेट २',
    nameMr: 'पलावा कासा बेला, गेट २',
    kind: 'society' as const,
    centre: { lat: 19.1723, lng: 73.0888 },
    geofenceRadiusM: 120,
  },
  {
    id: 'hs_dombivli_east',
    name: 'Dombivli East Station Auto Stand',
    nameHi: 'डोंबिवली पूर्व स्टेशन ऑटो स्टँड',
    nameMr: 'डोंबिवली पूर्व स्टेशन ऑटो स्टँड',
    kind: 'station' as const,
    centre: { lat: 19.2154, lng: 73.0868 },
    geofenceRadiusM: 200,
  },
  {
    id: 'hs_khandeshwar',
    name: 'Khandeshwar Station',
    nameHi: 'खांदेश्वर स्टेशन',
    nameMr: 'खांदेश्वर स्टेशन',
    kind: 'station' as const,
    centre: { lat: 19.0197, lng: 73.0663 },
    geofenceRadiusM: 200,
  },
];

export const CORRIDORS = [
  {
    id: 'cor_palava_dombivli',
    fromHotspotId: 'hs_palava_gate2',
    toHotspotId: 'hs_dombivli_east',
    fullFare: rupees(150),
    distanceKm: 6.5,
    typicalDurationMin: 22,
    active: true,
    committedDrivers: 9,
  },
  {
    id: 'cor_dombivli_palava',
    fromHotspotId: 'hs_dombivli_east',
    toHotspotId: 'hs_palava_gate2',
    fullFare: rupees(150),
    distanceKm: 6.5,
    typicalDurationMin: 24,
    active: true,
    committedDrivers: 9,
  },
  {
    id: 'cor_khandeshwar_college',
    fromHotspotId: 'hs_khandeshwar',
    toHotspotId: 'hs_palava_gate2',
    fullFare: rupees(120),
    distanceKm: 5.1,
    typicalDurationMin: 18,
    // Below the 6-driver floor: visible, but we say so rather than pretending.
    active: true,
    committedDrivers: 3,
  },
];

export function corridorById(id: string) {
  return CORRIDORS.find((c) => c.id === id) ?? CORRIDORS[0]!;
}

export function hotspotById(id: string) {
  return HOTSPOTS.find((h) => h.id === id) ?? HOTSPOTS[0]!;
}

export function corridorLabel(corridorId: string): { from: string; to: string } {
  const c = corridorById(corridorId);
  return {
    from: hotspotById(c.fromHotspotId).name,
    to: hotspotById(c.toHotspotId).name,
  };
}

// ── The demo user's active pass ─────────────────────────────────────────────

const MONTHLY = quotePass(rupees(150), 'monthly');

export const DEMO_PASS: Pass = {
  id: 'pass_demo_1',
  passengerId: 'user_demo',
  corridorId: 'cor_palava_dombivli',
  plan: 'monthly',
  departureMinute: 9 * 60 + 15, // 09:15
  serviceWeekdays: [1, 2, 3, 4, 5, 6],
  startDate: '2026-08-10',
  endDate: '2026-09-04',
  seatFare: MONTHLY.perRideSeatFare,
  graceDaysTotal: MONTHLY.graceDays,
  graceDaysUsed: 1,
  creditDaysBanked: 0,
  womenOnly: false,
  status: 'active',
};

export const DEMO_SPOT_QUOTE = quoteSeat(rupees(150));

// ── A pool that is currently forming ────────────────────────────────────────

export const DEMO_POOL = {
  id: 'pool_demo_1',
  corridorId: 'cor_palava_dombivli',
  departureAt: Date.now() + 6 * 60_000,
  seatsTaken: 2,
  status: 'forming' as const,
  driver: {
    name: 'Sunil K.',
    plate: 'MH 05 AB 1234',
    reliability: 'gold' as const,
    fuelType: 'cng' as const,
    tripsCompleted: 1_284,
  },
  coRiders: [
    { name: 'Meera P.', reliability: 'gold' as const, sharedBefore: 12 },
    { name: 'Arjun S.', reliability: 'silver' as const, sharedBefore: 3 },
  ],
};

/** Candidates for the LATER (train arrival) flow at Khandeshwar. */
export const DEMO_ARRIVALS = [
  { name: 'Sana R.', arrivesAt: '13:38', train: '13:05 from Kurla', reliability: 'silver' as const },
  { name: 'Nikhil D.', arrivesAt: '13:45', train: '13:05 from Kurla', reliability: 'new' as const },
  { name: 'Priya M.', arrivesAt: '13:52', train: '13:19 from Kurla', reliability: 'gold' as const },
];

export function minutesToClock(minute: number): string {
  const h24 = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}
