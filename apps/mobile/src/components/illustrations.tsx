import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors, palette } from '@/theme/tokens';

/**
 * Walkthrough illustrations.
 *
 * Drawn as vectors rather than shipped as PNGs, for three reasons that matter
 * more on this product than usual: they cost nothing in bundle size on a phone
 * with 300 MB free, they stay sharp on every density from a ₹8,000 Android to an
 * iPhone Pro, and they recolour from the design tokens so they cannot drift out
 * of sync with the brand.
 *
 * They are also deliberately literal. A first-time user who has never used Uber
 * does not need an abstract gradient blob — they need to see a rickshaw with
 * three people in it and the number 150 becoming three 50s.
 */

const W = 260;
const H = 170;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {children}
    </Svg>
  );
}

/**
 * A kaali-peeli three-wheeler, side on.
 *
 * The silhouette is doing real work here, so it is worth being fussy about. An
 * earlier version read as a minibus, which quietly undermined the whole first
 * slide — the pitch is "three of you in *a rickshaw*", and if the picture shows
 * a van the reader is being told something else entirely.
 *
 * Three features carry the recognition, and none of them is optional:
 *   - one small front wheel, set well forward on a visible fork
 *   - a domed canopy, not a boxy roof
 *   - an open passenger side with no door
 */
function Rickshaw({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  // One continuous outline for the whole body, canopy sweeping down into the
  // snout. Drawing the front as a second shape made it read as a box bolted to
  // the side of a van, which is exactly the impression to avoid.
  const body =
    'M16 74 L16 40 Q16 15 44 13 L70 13 Q86 14 93 30 L106 56 Q112 66 108 72 L108 74 Z';

  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* Fork to the front wheel, behind the body so only the strut shows. */}
      <Path d="M104 68 L114 86" stroke={colors.text} strokeWidth={5} strokeLinecap="round" fill="none" />

      <Path d={body} fill={colors.primary} strokeLinejoin="round" />
      {/* Black lower half — the kaali of kaali-peeli. */}
      <Path d="M16 62 L108 62 L108 74 Q108 80 101 80 L23 80 Q16 80 16 74 Z" fill={colors.text} />
      {/* Outline last, so the livery split doesn't cut across it. */}
      <Path d={body} fill="none" stroke={colors.text} strokeWidth={3.5} strokeLinejoin="round" />

      {/* The open side. No door, because a rickshaw has none. */}
      <Path d="M26 56 L26 30 Q26 21 40 20 L76 20 L82 56 Z" fill={palette.paper} opacity={0.55} />

      <Circle cx={101} cy={52} r={4} fill={colors.primary} stroke={colors.text} strokeWidth={2} />

      {/* Wheels: paired at the back, one small one well forward. */}
      <Circle cx={42} cy={86} r={14} fill={colors.text} />
      <Circle cx={42} cy={86} r={5} fill={palette.paper} />
      <Circle cx={114} cy={88} r={10} fill={colors.text} />
      <Circle cx={114} cy={88} r={3.5} fill={palette.paper} />
    </G>
  );
}

/** A seated passenger, as a head-and-shoulders glyph. */
function Passenger({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <G transform={`translate(${x} ${y})`}>
      <Circle cx={0} cy={0} r={7} fill={fill} />
      <Path d="M-10 18 Q-10 6 0 6 Q10 6 10 18 Z" fill={fill} />
    </G>
  );
}

/** 1 — Three of you, one rickshaw, one third of the fare. */
export function ShareIllustration() {
  return (
    <Frame>
      <Rect x={0} y={126} width={W} height={5} rx={2.5} fill={colors.border} />
      <Rickshaw x={58} y={30} scale={0.95} />

      {/* The three riders, seated in the open side rather than floating over the
          bodywork. The cabin opening is local x 26–82, y 20–56. */}
      <Passenger x={98} y={70} fill={colors.text} />
      <Passenger x={113} y={70} fill={colors.text} />
      <Passenger x={128} y={70} fill={colors.text} />

      {/* ₹150 ÷ 3 = ₹50, stated as arithmetic because that is the whole pitch. */}
      <SvgText x={W / 2} y={157} fontSize={19} fontWeight="800" fill={colors.text} textAnchor="middle">
        ₹150 ÷ 3 = ₹50 each
      </SvgText>
    </Frame>
  );
}

/** 2 — The three ways to ride, as three doors. */
export function ThreeWaysIllustration() {
  const panels = [
    { label: 'Now', sub: '6 min', x: 12 },
    { label: 'Later', sub: '1:45', x: 96 },
    { label: 'Pass', sub: 'Daily', x: 180 },
  ];

  return (
    <Frame>
      {panels.map((p, i) => (
        <G key={p.label}>
          <Rect
            x={p.x}
            y={30}
            width={68}
            height={96}
            rx={14}
            fill={i === 2 ? colors.primary : palette.white}
            stroke={colors.text}
            strokeWidth={i === 2 ? 3 : 2}
          />
          <SvgText
            x={p.x + 34}
            y={72}
            fontSize={15}
            fontWeight="800"
            fill={colors.text}
            textAnchor="middle"
          >
            {p.label}
          </SvgText>
          <SvgText
            x={p.x + 34}
            y={94}
            fontSize={13}
            fontWeight="600"
            fill={colors.textMuted}
            textAnchor="middle"
          >
            {p.sub}
          </SvgText>
          {/* A seat-count strip, filled progressively left to right. */}
          {[0, 1, 2].map((seat) => (
            <Circle
              key={seat}
              cx={p.x + 20 + seat * 14}
              cy={112}
              r={4.5}
              fill={seat <= i ? colors.success : colors.border}
            />
          ))}
        </G>
      ))}
    </Frame>
  );
}

/** 3 — A skipped day extends the pass. The grace-day idea, drawn. */
export function GraceIllustration() {
  const days = Array.from({ length: 12 }, (_, i) => i);

  return (
    <Frame>
      {days.map((d) => {
        const col = d % 6;
        const row = Math.floor(d / 6);
        const skipped = d === 8;
        const added = d === 11;

        return (
          <G key={d}>
            <Rect
              x={22 + col * 36}
              y={28 + row * 42}
              width={30}
              height={34}
              rx={7}
              fill={added ? colors.primary : skipped ? palette.paper : colors.successSoft}
              stroke={added ? colors.text : skipped ? colors.textFaint : colors.success}
              strokeWidth={added ? 2.5 : 1.5}
              strokeDasharray={skipped ? '4 3' : undefined}
            />
            {skipped ? (
              <G>
                <Line
                  x1={30 + col * 36}
                  y1={36 + row * 42}
                  x2={44 + col * 36}
                  y2={54 + row * 42}
                  stroke={colors.textFaint}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                <Line
                  x1={44 + col * 36}
                  y1={36 + row * 42}
                  x2={30 + col * 36}
                  y2={54 + row * 42}
                  stroke={colors.textFaint}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </G>
            ) : null}
            {added ? (
              <SvgText
                x={37 + col * 36}
                y={52 + row * 42}
                fontSize={17}
                fontWeight="800"
                fill={colors.text}
                textAnchor="middle"
              >
                +1
              </SvgText>
            ) : null}
          </G>
        );
      })}

      <SvgText x={W / 2} y={160} fontSize={15} fontWeight="700" fill={colors.textMuted} textAnchor="middle">
        one skipped day → one day added
      </SvgText>
    </Frame>
  );
}

/** 4 — The driver is paid either way. A steady line, not a spiky one. */
export function DriverIllustration() {
  return (
    <Frame>
      {/* Guaranteed floor. */}
      <Rect x={24} y={96} width={212} height={30} rx={8} fill={colors.successSoft} />
      <Line
        x1={24}
        y1={96}
        x2={236}
        y2={96}
        stroke={colors.success}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Daily takings wobbling above it — the point is the floor holds. */}
      <Path
        d="M32 74 L64 62 L96 80 L128 54 L160 70 L192 58 L228 66"
        fill="none"
        stroke={colors.text}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[32, 64, 96, 128, 160, 192, 228].map((x, i) => (
        <Circle
          key={x}
          cx={x}
          cy={[74, 62, 80, 54, 70, 58, 66][i]}
          r={4}
          fill={palette.white}
          stroke={colors.text}
          strokeWidth={2.5}
        />
      ))}

      <SvgText x={30} y={116} fontSize={13} fontWeight="700" fill={colors.success}>
        GUARANTEED ₹9,568 / MONTH
      </SvgText>
      <SvgText x={W / 2} y={156} fontSize={15} fontWeight="700" fill={colors.textMuted} textAnchor="middle">
        paid whether you turn up or not
      </SvgText>
    </Frame>
  );
}

/** 5 — The fuel reward, for the driver walkthrough. */
export function FuelIllustration() {
  return (
    <Frame>
      {/* A queue of rickshaws at the pump, because that is the real scene. */}
      <Rect x={0} y={118} width={W} height={5} rx={2.5} fill={colors.border} />
      {/* y chosen so the wheels sit on the ground line at the smaller scale. */}
      <Rickshaw x={10} y={52} scale={0.62} />
      <Rickshaw x={96} y={52} scale={0.62} />

      {/* The pump. */}
      <Rect x={190} y={44} width={44} height={74} rx={8} fill={colors.text} />
      <Rect x={198} y={54} width={28} height={24} rx={4} fill={colors.primary} />
      <Path
        d="M234 70 Q248 70 248 84 L248 100"
        fill="none"
        stroke={colors.text}
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* The reward, as a chip floating over the queue. */}
      <Rect x={72} y={8} width={116} height={32} rx={16} fill={colors.primary} stroke={colors.text} strokeWidth={2.5} />
      <SvgText x={130} y={30} fontSize={17} fontWeight="800" fill={colors.text} textAnchor="middle">
        +₹20 credit
      </SvgText>

      <SvgText x={W / 2} y={152} fontSize={15} fontWeight="700" fill={colors.textMuted} textAnchor="middle">
        for two minutes while you wait
      </SvgText>
    </Frame>
  );
}
