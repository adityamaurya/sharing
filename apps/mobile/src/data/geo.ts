/**
 * Real coordinates for the pilot corridor.
 *
 * Palava City → Dombivli East station, which is the corridor in the spec: a
 * 5 km run that ~8,000 people make twice a day, with no bus and a rickshaw
 * queue at both ends.
 *
 * These are approximate to a few dozen metres — good enough to draw a corridor
 * and to test geofence logic, not good enough to navigate by. Before launch
 * they get replaced by surveyed points from an actual walk of the route, which
 * is a half-day job for one person with a phone.
 */

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface Place extends LatLng {
  readonly id: string;
  readonly name: string;
  readonly short: string;
}

export const PALAVA_GATE_2: Place = {
  id: 'palava-casa-bella-g2',
  name: 'Palava Casa Bella, Gate 2',
  short: 'Casa Bella G2',
  lat: 19.1745,
  lng: 73.0885,
};

export const DOMBIVLI_EAST_STAND: Place = {
  id: 'dombivli-east-stand',
  name: 'Dombivli East Station Auto Stand',
  short: 'Dombivli East',
  lat: 19.2148,
  lng: 73.0868,
};

/**
 * The driven route, roughly: out along Palava's main spine to the Kalyan–Shil
 * road, then north up Manpada Road to the station.
 *
 * Read this as a **shape to draw, not a distance to quote.** Twelve waypoints
 * traced off a map cut every corner the road actually takes, so measuring this
 * polyline returns about 4.7 km against the 6.5 km recorded for the corridor in
 * `demo.ts`. The recorded figure is the one to show a rider — quoting the
 * polyline would make every arrival estimate optimistic by a quarter, which is
 * how somebody misses a 9:18 local and stops trusting the app.
 *
 * Both numbers get replaced by a GPS trace of an actual driven trip before
 * launch. That is a half-day job for one person with a phone, and until it
 * happens `CorridorMap` takes the distance as a prop rather than computing it.
 */
export const CORRIDOR_ROUTE: readonly LatLng[] = [
  { lat: 19.1745, lng: 73.0885 }, // Casa Bella Gate 2
  { lat: 19.1772, lng: 73.0902 },
  { lat: 19.1801, lng: 73.0913 }, // Palava spine road
  { lat: 19.1846, lng: 73.0934 },
  { lat: 19.1878, lng: 73.0939 }, // Nilje Gaon
  { lat: 19.1918, lng: 73.0928 },
  { lat: 19.1951, lng: 73.0913 }, // Kalyan–Shil road junction
  { lat: 19.1994, lng: 73.0901 },
  { lat: 19.2039, lng: 73.0890 }, // MIDC Phase II
  { lat: 19.2081, lng: 73.0881 },
  { lat: 19.2116, lng: 73.0874 }, // Manpada Road
  { lat: 19.2148, lng: 73.0868 }, // Dombivli East auto stand
];

/**
 * CNG stations a Dombivli rickshaw actually uses, with the geofence radius we
 * treat as "at the pump".
 *
 * 140 m is chosen from the queue, not the forecourt. On a busy morning the line
 * at Dombivli MIDC spills onto the service road for over a hundred metres, and
 * a driver forty cars back is unambiguously refuelling — a tight 50 m fence
 * around the pump island would miss the entire wait, which is precisely the
 * part we want to know about.
 */
export interface FuelStation extends Place {
  readonly brand: string;
  readonly geofenceRadiusMetres: number;
  /** Typical queue in minutes, by hour of day, from driver logs. */
  readonly typicalQueueMinutes: { readonly peak: number; readonly offPeak: number };
}

export const FUEL_STATIONS: readonly FuelStation[] = [
  {
    id: 'mgl-dombivli-midc',
    name: 'Mahanagar Gas, Dombivli MIDC',
    short: 'Dombivli MIDC',
    brand: 'Mahanagar Gas',
    lat: 19.2043,
    lng: 73.0794,
    geofenceRadiusMetres: 140,
    typicalQueueMinutes: { peak: 34, offPeak: 12 },
  },
  {
    id: 'mgl-manpada',
    name: 'Mahanagar Gas, Manpada Road',
    short: 'Manpada Road',
    brand: 'Mahanagar Gas',
    lat: 19.2089,
    lng: 73.0931,
    geofenceRadiusMetres: 120,
    typicalQueueMinutes: { peak: 41, offPeak: 15 },
  },
  {
    id: 'mgl-nilje',
    name: 'Mahanagar Gas, Nilje',
    short: 'Nilje',
    brand: 'Mahanagar Gas',
    lat: 19.1884,
    lng: 73.0971,
    geofenceRadiusMetres: 130,
    typicalQueueMinutes: { peak: 26, offPeak: 9 },
  },
];

// ── Distance ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_008.8;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine, in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const meanLat = toRadians((a.lat + b.lat) / 2);

  // Equirectangular is within 0.5% of haversine at this scale and cheaper, but
  // haversine costs nothing here and stays correct if the corridor list ever
  // grows to cover a city.
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(meanLat) ** 2 * sinLng * sinLng;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeLengthMetres(route: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += distanceMetres(route[i - 1]!, route[i]!);
  }
  return total;
}

/**
 * A point `fraction` of the way along the route, measured by distance rather
 * than by waypoint index — otherwise a vehicle would appear to crawl through
 * densely-sampled bends and jump across long straights.
 */
export function pointAlongRoute(route: readonly LatLng[], fraction: number): LatLng {
  const clamped = Math.min(1, Math.max(0, fraction));
  const target = routeLengthMetres(route) * clamped;

  let travelled = 0;
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1]!;
    const to = route[i]!;
    const leg = distanceMetres(from, to);

    if (travelled + leg >= target) {
      const t = leg === 0 ? 0 : (target - travelled) / leg;
      return {
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      };
    }
    travelled += leg;
  }
  return route[route.length - 1]!;
}

/** Which station is the driver inside the geofence of, if any? */
export function stationAt(position: LatLng): FuelStation | null {
  for (const station of FUEL_STATIONS) {
    if (distanceMetres(position, station) <= station.geofenceRadiusMetres) return station;
  }
  return null;
}
