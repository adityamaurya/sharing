import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import {
  CORRIDOR_ROUTE,
  DOMBIVLI_EAST_STAND,
  PALAVA_GATE_2,
  routeLengthMetres,
  type LatLng,
  type Place,
} from '@/data/geo';
import { colors, palette, radius, space } from '@/theme/tokens';

/**
 * The corridor map.
 *
 * This is a vector map drawn from real coordinates through a real projection —
 * not a screenshot, and not decoration. It is deliberately *not* `react-native-maps`:
 *
 *   - A slippy map needs a Google Maps API key on Android. A missing or
 *     misconfigured key renders a blank grey rectangle, and the person shipping
 *     this app is not going to enjoy debugging that from a Play Store review.
 *   - Tiles cost money per load once the pilot has a few thousand users, for a
 *     product where the route never changes.
 *   - Pan and zoom are not useful here. There are exactly two endpoints and one
 *     road between them; what a rider needs is "where is my rickshaw on that
 *     line", which a schematic answers better than a city map they must pinch
 *     around at a station gate.
 *
 * If a future feature genuinely needs free panning — door-to-door pickup, say —
 * swap this component's internals for `react-native-maps`. Everything outside
 * this file talks in lat/lng and would not change.
 */

// ── Projection ──────────────────────────────────────────────────────────────

interface Projection {
  (point: LatLng): { x: number; y: number };
}

/**
 * Equirectangular, fitted to the box.
 *
 * The `cos(lat)` term is the part that matters: a degree of longitude at 19°N
 * is about 105 km against 111 km for a degree of latitude, so without it the
 * corridor comes out visibly stretched east-west and the route stops matching
 * the shape a driver knows.
 */
function fitProjection(
  points: readonly LatLng[],
  width: number,
  height: number,
  pad: number,
): Projection {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const meanLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lngScale = Math.cos(meanLat);

  // Work in a flat metric space first, then fit that box to the viewport.
  const spanX = Math.max(1e-9, (maxLng - minLng) * lngScale);
  const spanY = Math.max(1e-9, maxLat - minLat);

  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const scale = Math.min(usableW / spanX, usableH / spanY);

  // Centre whatever axis has slack, so the route doesn't hug one edge.
  const offsetX = pad + (usableW - spanX * scale) / 2;
  const offsetY = pad + (usableH - spanY * scale) / 2;

  return (point) => ({
    x: offsetX + (point.lng - minLng) * lngScale * scale,
    y: offsetY + (maxLat - point.lat) * scale, // SVG y grows downward
  });
}

function toPath(points: readonly LatLng[], project: Projection): string {
  return points
    .map((p, i) => {
      const { x, y } = project(p);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

// ── Context features ────────────────────────────────────────────────────────
//
// Two real landmarks, so the drawing reads as a place rather than as a diagram:
// the Central Line through Dombivli, and the Kalyan–Shil road the corridor
// crosses. Both are approximate; both are recognisable to anyone who lives here.

const RAILWAY: readonly LatLng[] = [
  { lat: 19.2205, lng: 73.0762 },
  { lat: 19.2168, lng: 73.0851 },
  { lat: 19.2131, lng: 73.0938 },
];

const ARTERIAL: readonly LatLng[] = [
  { lat: 19.1922, lng: 73.0806 },
  { lat: 19.1949, lng: 73.0910 },
  { lat: 19.1981, lng: 73.1014 },
];

// ── Map ─────────────────────────────────────────────────────────────────────

export interface MapVehicle {
  /** 0 = at origin, 1 = at destination. */
  readonly progress: number;
  readonly label?: string;
}

export function CorridorMap({
  height = 190,
  width = 340,
  origin = PALAVA_GATE_2,
  destination = DOMBIVLI_EAST_STAND,
  route = CORRIDOR_ROUTE,
  vehicle,
  caption,
  distanceKm,
}: {
  height?: number;
  width?: number;
  origin?: Place;
  destination?: Place;
  route?: readonly LatLng[];
  vehicle?: MapVehicle;
  caption?: string;
  /**
   * Road distance for the label. Pass the corridor's recorded figure — the
   * drawn polyline is a coarse trace and measuring it would report a shorter
   * distance than the road actually is. Falls back to the geometry when absent.
   */
  distanceKm?: number;
}) {
  const { project, routePath, railPath, arterialPath, lengthKm } = useMemo(() => {
    // Project against everything we intend to draw, or the context features get
    // clipped at the edges of the frame.
    const all = [...route, ...RAILWAY, ...ARTERIAL];
    const p = fitProjection(all, width, height, 26);

    return {
      project: p,
      routePath: toPath(route, p),
      railPath: toPath(RAILWAY, p),
      arterialPath: toPath(ARTERIAL, p),
      lengthKm: routeLengthMetres(route) / 1000,
    };
  }, [route, width, height]);

  const a = project(origin);
  const b = project(destination);

  const vehiclePoint = useMemo(() => {
    if (!vehicle) return null;
    // Interpolating in screen space rather than lat/lng keeps the marker exactly
    // on the drawn line, including through the bends.
    const pts = route.map(project);
    let total = 0;
    const legs = pts.slice(1).map((pt, i) => {
      const prev = pts[i]!;
      const d = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      total += d;
      return d;
    });
    const target = total * Math.min(1, Math.max(0, vehicle.progress));

    let walked = 0;
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i]!;
      if (walked + leg >= target) {
        const t = leg === 0 ? 0 : (target - walked) / leg;
        const from = pts[i]!;
        const to = pts[i + 1]!;
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      }
      walked += leg;
    }
    return pts[pts.length - 1]!;
  }, [route, project, vehicle]);

  const shownKm = distanceKm ?? lengthKm;
  const label = caption ?? `${shownKm.toFixed(1)} km by road`;

  return (
    <View
      style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#EEEAE1' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        `Map of the route from ${origin.name} to ${destination.name}, ${shownKm.toFixed(1)} kilometres by road` +
        (vehicle ? `. Your rickshaw is ${Math.round(vehicle.progress * 100)} per cent of the way along.` : '')
      }
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F3EFE7" />
            <Stop offset="1" stopColor="#E8E3D8" />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="url(#ground)" />

        {/* Open land around Nilje — the green a driver sees on the left. */}
        <Circle cx={width * 0.22} cy={height * 0.62} r={54} fill="#E1E7D8" opacity={0.9} />
        <Circle cx={width * 0.78} cy={height * 0.24} r={40} fill="#E1E7D8" opacity={0.75} />

        {/* Context roads, drawn under the corridor so it stays dominant. */}
        <Path d={arterialPath} stroke="#D8D2C6" strokeWidth={9} fill="none" strokeLinecap="round" />
        <Path d={arterialPath} stroke="#EFEBE3" strokeWidth={5} fill="none" strokeLinecap="round" />

        {/* Central Line: casing plus sleeper dashes, the way a rail line reads. */}
        <Path d={railPath} stroke="#C9C2B4" strokeWidth={7} fill="none" strokeLinecap="round" />
        <Path
          d={railPath}
          stroke="#8C8474"
          strokeWidth={2}
          fill="none"
          strokeDasharray="7 6"
          strokeLinecap="butt"
        />

        {/* The corridor. Casing first so it lifts off the ground colour. */}
        <Path
          d={routePath}
          stroke={palette.white}
          strokeWidth={13}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={routePath}
          stroke={colors.text}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Origin: a ring, because "you are here" is a place, not a destination. */}
        <G>
          <Circle cx={a.x} cy={a.y} r={11} fill={palette.white} />
          <Circle cx={a.x} cy={a.y} r={7} fill={colors.success} />
          <SvgText
            x={a.x + 16}
            y={a.y + 5}
            fontSize={12}
            fontWeight="700"
            fill={colors.text}
          >
            {origin.short}
          </SvgText>
        </G>

        {/* Destination. */}
        <G>
          <Circle cx={b.x} cy={b.y} r={11} fill={palette.white} />
          <Circle cx={b.x} cy={b.y} r={7} fill={colors.text} />
          <SvgText
            x={b.x - 16}
            y={b.y - 14}
            fontSize={12}
            fontWeight="700"
            fill={colors.text}
            textAnchor="end"
          >
            {destination.short}
          </SvgText>
        </G>

        {/* The rickshaw, in taxi yellow with a dark ring so it survives the
            light background and reads at a glance on a sunlit screen. */}
        {vehiclePoint ? (
          <G>
            <Circle cx={vehiclePoint.x} cy={vehiclePoint.y} r={15} fill={colors.primary} opacity={0.28} />
            <Circle
              cx={vehiclePoint.x}
              cy={vehiclePoint.y}
              r={9}
              fill={colors.primary}
              stroke={colors.text}
              strokeWidth={2.5}
            />
          </G>
        ) : null}

        {/* Distance chip, bottom-left. */}
        <G>
          <Rect
            x={space.md}
            y={height - 30}
            width={label.length * 6.6 + 18}
            height={22}
            rx={11}
            fill={palette.white}
            opacity={0.94}
          />
          <SvgText
            x={space.md + 9}
            y={height - 15}
            fontSize={11}
            fontWeight="600"
            fill={colors.textMuted}
          >
            {label}
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}
