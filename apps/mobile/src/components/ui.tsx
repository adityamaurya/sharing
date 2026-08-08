import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { colors, elevation, radius, space, touch, type } from '@/theme/tokens';

/**
 * The Sharing UI kit.
 *
 * Every component here bakes in a rule from the 55-year-old test so that a
 * screen can't accidentally break it: tap targets can't be built too small,
 * status can't be conveyed by colour alone, and the primary action is always
 * one full-width button.
 */

// ── Text ────────────────────────────────────────────────────────────────────

type Variant = keyof typeof type;

/**
 * Extends TextProps rather than redeclaring a handful of props, so every
 * accessibility escape hatch — `accessibilityLabel`, `accessibilityRole`,
 * `accessible` — stays available. A text component that silently drops
 * `accessibilityLabel` makes the app unusable with TalkBack and the failure is
 * invisible to a sighted developer.
 */
export function T({
  variant = 'body',
  color = colors.text,
  center,
  style,
  children,
  ...rest
}: TextProps & {
  variant?: Variant;
  color?: string;
  center?: boolean;
  children: ReactNode;
}) {
  return (
    <Text
      {...rest}
      // Respect the OS font-size setting, but cap the scale so a 200% setting
      // doesn't push the primary button off the bottom of the screen.
      maxFontSizeMultiplier={1.6}
      style={[
        type[variant] as TextStyle,
        { color },
        center && { textAlign: 'center' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  loading,
  /** Shown under the label — use it to state the consequence, not to advertise. */
  hint,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  accessibilityHint?: string;
}) {
  const toneStyle = {
    primary: { bg: colors.primary, fg: colors.textOnPrimary, border: 'transparent' },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    quiet: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? hint}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: toneStyle.bg,
          borderColor: toneStyle.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={toneStyle.fg} />
      ) : (
        <>
          <T variant="button" color={toneStyle.fg} center>
            {label}
          </T>
          {hint ? (
            <T variant="caption" color={toneStyle.fg} center style={{ opacity: 0.75 }}>
              {hint}
            </T>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

// ── Containers ──────────────────────────────────────────────────────────────

export function Card({
  children,
  onPress,
  accessibilityLabel,
  tone = 'surface',
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  tone?: 'surface' | 'sunken' | 'primarySoft';
}) {
  const bg = {
    surface: colors.surface,
    sunken: colors.surfaceSunken,
    primarySoft: colors.primarySoft,
  }[tone];

  const inner = <View style={[s.card, { backgroundColor: bg }]}>{children}</View>;

  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      {inner}
    </Pressable>
  );
}

export function Row({
  children,
  gap = space.md,
  align = 'center',
  justify = 'flex-start',
  wrap,
  style,
}: {
  children: ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  /** Let children drop to a second line rather than overflow a narrow screen. */
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap,
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * `flex` matters more than it looks. A text column inside a Row will happily
 * run past the edge of a 360dp phone unless it is told it may shrink — the
 * fare or the badge next to it then gets clipped, which on this app means a
 * price somebody cannot read. Pass `flex={1}` to the side that should give way.
 */
export function Stack({
  children,
  gap = space.md,
  flex,
}: {
  children: ReactNode;
  gap?: number;
  flex?: number;
}) {
  return <View style={[{ gap }, flex !== undefined && { flex, minWidth: 0 }]}>{children}</View>;
}

export function Divider() {
  return <View style={s.divider} />;
}

/**
 * One tappable line: icon, label, a supporting line, and whatever the number is.
 *
 * The home screen used to stack a `Card` per choice, which gave three shadowed
 * boxes competing with the one thing that actually matters — the next ride. A
 * flat row list makes the hierarchy honest: the hero is loud, the choices are
 * quiet and equal, and the whole screen fits above the fold on a small phone.
 *
 * Still 56dp tall and still one tap. Simplifying the look is not licence to
 * shrink the target.
 */
export function ActionRow({
  icon,
  title,
  meta,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  meta?: string;
  /** A fare, a pill, anything short. Sits left of the chevron. */
  trailing?: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, meta].filter(Boolean).join('. ')}
      style={({ pressed }) => [s.actionRow, pressed && { backgroundColor: colors.surfaceSunken }]}
    >
      <View style={s.actionIcon}>
        <Icon name={icon} size="md" color={colors.text} />
      </View>

      <Stack gap={1} flex={1}>
        <T variant="bodyStrong">{title}</T>
        {meta ? (
          <T variant="caption" color={colors.textMuted}>
            {meta}
          </T>
        ) : null}
      </Stack>

      {trailing}
      <Icon name="chevron" size="sm" color={colors.textFaint} />
    </Pressable>
  );
}

/** A hairline group wrapper for a run of ActionRows. */
export function RowGroup({ children }: { children: ReactNode }) {
  return <View style={s.rowGroup}>{children}</View>;
}

// ── Status ──────────────────────────────────────────────────────────────────

export type StatusTone = 'go' | 'warn' | 'stop' | 'info' | 'neutral';

/**
 * Status is never colour alone.
 *
 * Roughly 1 in 12 men has some form of colour-vision deficiency, and in bright
 * sunlight on a cheap LCD everyone does. Every Pill carries an icon glyph and a
 * word as well as a colour, so the meaning survives all three.
 */
export function Pill({ tone, icon, children }: { tone: StatusTone; icon: string; children: string }) {
  const map = {
    go: { bg: colors.successSoft, fg: colors.success },
    warn: { bg: colors.warningSoft, fg: colors.warning },
    stop: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: colors.infoSoft, fg: colors.info },
    neutral: { bg: colors.surfaceSunken, fg: colors.textMuted },
  }[tone];

  return (
    <View style={[s.pill, { backgroundColor: map.bg }]} accessibilityRole="text">
      <T variant="caption" color={map.fg}>
        {icon} {children}
      </T>
    </View>
  );
}

/**
 * Grace days as filled/empty dots, plus the count in words for screen readers.
 *
 * `compact` drops the trailing words for use inside a tight row. The
 * accessibilityLabel keeps them either way — the dots are decoration to a
 * screen reader, and "three of four left" is the actual content.
 */
export function GraceDots({
  total,
  used,
  compact,
}: {
  total: number;
  used: number;
  compact?: boolean;
}) {
  const remaining = Math.max(0, total - used);
  return (
    <Row gap={space.sm}>
      <T
        variant="subtitle"
        color={remaining > 0 ? colors.success : colors.textFaint}
        accessibilityLabel={`${remaining} of ${total} grace days left`}
      >
        {'●'.repeat(remaining)}
        <Text style={{ color: colors.border }}>{'○'.repeat(used)}</Text>
      </T>
      {compact ? null : (
        <T variant="caption" color={colors.textMuted}>
          {remaining} of {total} left
        </T>
      )}
    </Row>
  );
}

/**
 * A number plate, rendered the way a plate actually looks so it can be matched
 * against the rickshaw in front of you at a glance. This is a safety component:
 * getting into the wrong vehicle is the failure we most want to prevent.
 */
export function PlateBadge({ plate }: { plate: string }) {
  return (
    <View style={s.plate} accessibilityLabel={`Number plate ${plate.split('').join(' ')}`}>
      <T variant="plate" color={colors.text}>
        {plate}
      </T>
    </View>
  );
}

/** A big, unmissable money figure. Fares are never set in body type. */
export function Money({ children, tone = colors.text }: { children: string; tone?: string }) {
  return (
    <T variant="figure" color={tone}>
      {children}
    </T>
  );
}

export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Pinned to the bottom. The one primary action lives here, always reachable. */
  footer?: ReactNode;
}) {
  const body = (
    <View style={{ padding: space.lg, gap: space.lg, flexGrow: 1 }}>{children}</View>
  );

  return (
    <View style={s.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  button: {
    minHeight: touch.primary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: 2,
  },
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    ...elevation.card,
  },
  divider: { height: 1, backgroundColor: colors.border },
  rowGroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...elevation.card,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.comfortable + 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    minHeight: 30,
    justifyContent: 'center',
  },
  footer: {
    padding: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  plate: {
    backgroundColor: colors.primary,
    borderColor: colors.text,
    borderWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    alignSelf: 'flex-start',
  },
});
