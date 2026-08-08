import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { CorridorMap } from '@/components/map';
import {
  ActionRow,
  Button,
  GraceDots,
  Money,
  Row,
  RowGroup,
  Screen,
  Stack,
  T,
} from '@/components/ui';
import {
  DEMO_PASS,
  DEMO_SPOT_QUOTE,
  corridorById,
  corridorLabel,
  minutesToClock,
} from '@/data/demo';
import { hasSeenWalkthrough } from '@/data/firstRun';
import { colors, space } from '@/theme/tokens';
import { formatINR, prettyDate } from '@sharing/core';

/**
 * Home.
 *
 * Rewritten to hold one idea instead of five. The old version stacked four
 * shadowed cards, and the effect was that nothing on the screen was louder than
 * anything else — the next ride, the three ways to ride and the driver switch
 * all shouted at the same volume.
 *
 * Now there is a hero and there is a list. The hero is the only thing with a map,
 * a display-size figure and a filled button; the three ways to ride are quiet,
 * equal rows. On a 360×640 phone the hero and the first two rows are above the
 * fold, which is the test that decided the layout.
 *
 * Two rules from docs/00-product-spec.md §11 survive the redesign unchanged:
 *
 *  1. The next thing that will happen to you is at the top, in big type.
 *  2. "I'm not going tomorrow" is one tap from here. It is the most-used action
 *     a pass holder has, and burying it is how you turn a considerate rider
 *     into a no-show.
 */
export default function Home() {
  const router = useRouter();
  const { from, to } = corridorLabel(DEMO_PASS.corridorId);
  const corridor = corridorById(DEMO_PASS.corridorId);

  // First run: show the walkthrough once, then never again unless asked for.
  // Deliberately *after* Home has mounted rather than as a gate in front of it,
  // so a returning user on a slow phone never stares at a blank screen waiting
  // for a storage read to decide whether they are new.
  useEffect(() => {
    let cancelled = false;
    void hasSeenWalkthrough().then((seen) => {
      if (!seen && !cancelled) router.push('/welcome');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Screen>
      {/* ── Hero: tomorrow's ride ──────────────────────────────────────────
          The map earns its place here by answering the question the old copy
          only asserted — *which* Gate 2, and how far is the station really. */}
      <Stack gap={space.lg}>
        <CorridorMap
          height={180}
          vehicle={{ progress: 0.34 }}
          distanceKm={corridor.distanceKm}
          caption={`${corridor.distanceKm} km by road · ~${corridor.typicalDurationMin} min`}
        />

        <Stack gap={space.xs}>
          <Row gap={space.sm}>
            <Icon name="seat" size="sm" color={colors.success} />
            <T variant="caption" color={colors.success}>
              SEAT CONFIRMED
            </T>
          </Row>

          <T variant="display">Tomorrow, {minutesToClock(DEMO_PASS.departureMinute)}</T>

          <Row gap={space.sm}>
            <T variant="body" color={colors.textMuted} style={{ flex: 1 }}>
              {from} → {to}
            </T>
          </Row>
        </Stack>

        <Button
          label="I'm not going tomorrow"
          tone="secondary"
          onPress={() => router.push('/pass/skip')}
          accessibilityHint="Tells your driver in advance and gives your seat to someone else"
        />
      </Stack>

      {/* ── The three ways to ride ─────────────────────────────────────────
          Flat rows, not cards. Equal weight, because which one you want depends
          entirely on your morning and the app has no business guessing. */}
      <RowGroup>
        <ActionRow
          icon="now"
          title="Ride now"
          meta="2 waiting · leaves in ~6 min"
          trailing={<Money>{formatINR(DEMO_SPOT_QUOTE.total)}</Money>}
          onPress={() => router.push('/ride/now')}
          accessibilityLabel={`Ride now. Two people waiting, leaves in about six minutes. ${formatINR(DEMO_SPOT_QUOTE.total)}.`}
        />
        <ActionRow
          icon="later"
          title="Book for later"
          meta="On a train? Match before you land"
          trailing={<Money>{formatINR(DEMO_SPOT_QUOTE.total)}</Money>}
          onPress={() => router.push('/ride/later')}
        />
        <ActionRow
          icon="pass"
          title="Daily pass"
          meta={`Runs to ${prettyDate(DEMO_PASS.endDate)}`}
          trailing={
            <GraceDots total={DEMO_PASS.graceDaysTotal} used={DEMO_PASS.graceDaysUsed} compact />
          }
          onPress={() => router.push('/pass')}
        />
      </RowGroup>

      {/* ── Quiet exits ────────────────────────────────────────────────────
          Both of these are secondary to riding, and neither deserves a card. */}
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: space.sm }}>
        <RowGroup>
          <ActionRow
            icon="sparkle"
            title="How Sharing works"
            meta="Two minutes, with pictures"
            onPress={() => router.push('/welcome')}
          />
        </RowGroup>

        <Pressable
          onPress={() => router.push('/driver')}
          accessibilityRole="button"
          accessibilityLabel="Switch to driver mode"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: space.md })}
        >
          <Row gap={space.sm} justify="center">
            <Icon name="navigate" size="sm" color={colors.textMuted} />
            <T variant="caption" color={colors.textMuted}>
              I drive a rickshaw
            </T>
          </Row>
        </Pressable>
      </View>
    </Screen>
  );
}
