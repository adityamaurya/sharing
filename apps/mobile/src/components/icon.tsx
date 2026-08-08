import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Flame,
  Fuel,
  Hourglass,
  IndianRupee,
  MapPin,
  Navigation,
  Repeat,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrainFront,
  TriangleAlert,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react-native';

import { colors } from '@/theme/tokens';

/**
 * Icons, behind a registry.
 *
 * Two reasons this indirection is worth a file. First, screens name an icon by
 * intent (`'skip'`) rather than by drawing (`'Repeat'`), so swapping the glyph
 * later is one edit here instead of a hunt through eight screens. Second, it
 * pins size and stroke to the type scale — a 16px hairline icon beside 17sp body
 * text is exactly the kind of thing that looks refined in a design tool and
 * disappears in Mumbai sunlight.
 *
 * Icons from Lucide (https://lucide.dev), ISC licensed.
 *
 * An icon is never the only carrier of meaning. Every one of these sits next to
 * a word, for the same reason Pill has both a glyph and a label.
 */

const REGISTRY = {
  now: Zap,
  later: CalendarClock,
  pass: Ticket,
  skip: Repeat,
  seat: CheckCircle2,
  people: Users,
  clock: Clock,
  waiting: Hourglass,
  pin: MapPin,
  navigate: Navigation,
  train: TrainFront,
  rupee: IndianRupee,
  money: CircleDollarSign,
  wallet: Wallet,
  fuel: Fuel,
  streak: Flame,
  guarantee: ShieldCheck,
  sparkle: Sparkles,
  alert: TriangleAlert,
  bell: BellRing,
  check: Check,
  chevron: ChevronRight,
  arrow: ArrowRight,
  close: X,
} as const;

export type IconName = keyof typeof REGISTRY;

/**
 * Sizes track the type scale rather than a generic 16/24/32 ramp, so an icon
 * beside a `subtitle` reads as the same weight of thing as the words.
 */
const SIZES = { sm: 18, md: 22, lg: 28, xl: 40, xxl: 56 } as const;

export function Icon({
  name,
  size = 'md',
  color = colors.text,
  /** 2.25 is deliberately heavier than Lucide's 2 — it survives a cheap LCD. */
  strokeWidth = 2.25,
}: {
  name: IconName;
  size?: keyof typeof SIZES | number;
  color?: string;
  strokeWidth?: number;
}) {
  const Glyph = REGISTRY[name];
  const px = typeof size === 'number' ? size : SIZES[size];

  return <Glyph size={px} color={color} strokeWidth={strokeWidth} />;
}
