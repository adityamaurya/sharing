/**
 * The Sharing design system.
 *
 * Built around one test, and every value below is answerable to it:
 *
 *   A 55-year-old with reading glasses, in bright Mumbai sunlight, on a ₹8,000
 *   Android phone, holding a bag in one hand, who has never used Uber.
 *
 * If a token makes that person's life harder it is the wrong token, however good
 * it looks in a Figma frame at 200% zoom.
 */

// ── Colour ──────────────────────────────────────────────────────────────────
//
// Kaali-peeli: the black-and-yellow livery every Mumbai commuter can identify
// from fifty metres. It is free brand recognition and we should not waste it on
// a trendier palette.

export const palette = {
  /** Taxi yellow. The primary. Used for the one action on each screen. */
  peeli: '#FFC531',
  peeliDeep: '#F0A81C',
  peeliSoft: '#FFF3D1',

  /** Soft black. Pure #000 reads as a hole on OLED and glares in sunlight. */
  kaali: '#141210',
  kaali80: '#2A2622',
  kaali60: '#4A443D',
  kaali40: '#7A7267',

  white: '#FFFFFF',
  paper: '#FAF8F5',
  line: '#E4DFD7',

  /** Status colours. Never used alone — always paired with an icon and words. */
  go: '#0F7A4A',
  goSoft: '#E3F3EB',
  // Darkened from #B45309, which measured 4.47:1 on `warnSoft` — just under the
  // AA floor. Caught by tokens.test.ts, which is the entire point of that test.
  warn: '#A34A08',
  warnSoft: '#FDF0DC',
  stop: '#B4231F',
  stopSoft: '#FCE9E8',
  info: '#1D4E89',
  infoSoft: '#E6EEF7',
} as const;

export const colors = {
  bg: palette.paper,
  surface: palette.white,
  surfaceSunken: '#F2EFE9',

  text: palette.kaali,
  textMuted: palette.kaali60,
  textFaint: palette.kaali40,
  textOnPrimary: palette.kaali,
  textOnDark: palette.white,

  primary: palette.peeli,
  primaryPressed: palette.peeliDeep,
  primarySoft: palette.peeliSoft,

  border: palette.line,
  borderStrong: palette.kaali40,

  success: palette.go,
  successSoft: palette.goSoft,
  warning: palette.warn,
  warningSoft: palette.warnSoft,
  danger: palette.stop,
  dangerSoft: palette.stopSoft,
  info: palette.info,
  infoSoft: palette.infoSoft,

  scrim: 'rgba(20, 18, 16, 0.55)',
} as const;

/**
 * Contrast ratios we hold ourselves to, checked in `tokens.test.ts`:
 *   body text on background        ≥ 7.0  (WCAG AAA)
 *   everything else                ≥ 4.5  (WCAG AA)
 *
 * Yellow is a trap here: `peeli` on white is about 1.7:1, so yellow is a
 * *surface* colour in this system, never a text colour. Text on yellow is
 * always `kaali`.
 */
export const CONTRAST_FLOOR = { body: 7.0, other: 4.5 } as const;

// ── Type ────────────────────────────────────────────────────────────────────
//
// Nothing below 15sp exists. Body is 17sp. The numbers that decide whether
// somebody gets on the right rickshaw — fare, plate, time — are 24sp and up.

export const type = {
  /** Number plates. Tabular so digits line up and can't be misread. */
  plate: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: 2 },
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  /** Fares and times. */
  figure: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { fontSize: 19, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 25, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  /** The floor. Labels and captions only — never a full sentence. */
  caption: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  button: { fontSize: 19, lineHeight: 24, fontWeight: '700' },
} as const;

export const MIN_FONT_SIZE = 15;

// ── Space, shape, motion ────────────────────────────────────────────────────

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * 48dp is the floor for anything tappable — Android's accessibility minimum and
 * roughly the width of an adult thumb. Primary actions get 60dp because they
 * are pressed on a moving train.
 */
export const touch = {
  min: 48,
  comfortable: 56,
  primary: 60,
} as const;

export const elevation = {
  card: {
    shadowColor: palette.kaali,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sheet: {
    shadowColor: palette.kaali,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
} as const;

/**
 * Motion is short and never blocks. A 400ms flourish on a ₹8,000 phone at a
 * station gate is a 400ms delay, not delight.
 */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

// ── Contrast maths, so the rules above are checkable rather than aspirational ──

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
