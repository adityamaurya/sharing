import { useRouter } from 'expo-router';
import { View } from 'react-native';

import {
  Button,
  Card,
  Divider,
  GraceDots,
  Money,
  Pill,
  Row,
  Screen,
  Stack,
  T,
} from '@/components/ui';
import { DEMO_PASS, DEMO_SPOT_QUOTE, corridorLabel, minutesToClock } from '@/data/demo';
import { colors, space } from '@/theme/tokens';
import { formatINR, prettyDate } from '@sharing/core';

/**
 * Home.
 *
 * Two rules, both from docs/00-product-spec.md §11:
 *
 *  1. The next thing that is going to happen to you is at the top, in big type.
 *     For a committed rider that is tomorrow's ride, not a marketing banner.
 *  2. "I'm not going tomorrow" is reachable from here in one tap. It is the
 *     single most-used action by pass holders, and burying it three screens
 *     deep is how you turn a considerate user into a no-show.
 */
export default function Home() {
  const router = useRouter();
  const { from, to } = corridorLabel(DEMO_PASS.corridorId);

  return (
    <Screen>
      {/* ── Your next ride ─────────────────────────────────────────────── */}
      <Card tone="primarySoft">
        <Row justify="space-between">
          <T variant="caption" color={colors.textMuted}>
            YOUR NEXT RIDE
          </T>
          <Pill tone="go" icon="✓" >
            Seat confirmed
          </Pill>
        </Row>

        <T variant="display">Tomorrow, {minutesToClock(DEMO_PASS.departureMinute)}</T>

        <Stack gap={space.xs}>
          <T variant="bodyStrong">{from}</T>
          <T variant="body" color={colors.textMuted}>
            to {to}
          </T>
        </Stack>

        <Divider />

        <Row justify="space-between">
          <View>
            <T variant="caption" color={colors.textMuted}>
              Pass runs to
            </T>
            <T variant="subtitle">{prettyDate(DEMO_PASS.endDate)}</T>
          </View>
          <View>
            <T variant="caption" color={colors.textMuted}>
              Grace days
            </T>
            <GraceDots total={DEMO_PASS.graceDaysTotal} used={DEMO_PASS.graceDaysUsed} />
          </View>
        </Row>

        {/* The one-tap escape hatch. Never bury this. */}
        <Button
          label="I'm not going tomorrow"
          tone="secondary"
          onPress={() => router.push('/pass/skip')}
          accessibilityHint="Tells your driver in advance and gives your seat to someone else"
        />
      </Card>

      {/* ── The three ways to ride ─────────────────────────────────────── */}
      <T variant="title">Need a rickshaw?</T>

      <Card
        onPress={() => router.push('/ride/now')}
        accessibilityLabel="Ride now. Share a rickshaw leaving in the next few minutes."
      >
        <Row justify="space-between">
          <Stack gap={space.xs} flex={1}>
            <T variant="subtitle">Ride now</T>
            <T variant="body" color={colors.textMuted}>
              2 people waiting · leaves in ~6 min
            </T>
          </Stack>
          <Money>{formatINR(DEMO_SPOT_QUOTE.total)}</Money>
        </Row>
      </Card>

      <Card
        onPress={() => router.push('/ride/later')}
        accessibilityLabel="Book for later. Tell us when you will arrive and we match you before you get there."
      >
        <Row justify="space-between">
          <Stack gap={space.xs} flex={1}>
            <T variant="subtitle">Book for later</T>
            <T variant="body" color={colors.textMuted}>
              On a train? Get matched before you land
            </T>
          </Stack>
          <Money>{formatINR(DEMO_SPOT_QUOTE.total)}</Money>
        </Row>
      </Card>

      <Card
        onPress={() => router.push('/pass')}
        accessibilityLabel="Daily pass. Lock the same seat every day for a week or a month."
      >
        <Row justify="space-between">
          <Stack gap={space.xs} flex={1}>
            <T variant="subtitle">Daily pass</T>
            <T variant="body" color={colors.textMuted}>
              Same seat, same time, every day
            </T>
          </Stack>
          <Pill tone="info" icon="★">
            Active
          </Pill>
        </Row>
      </Card>

      <Button
        label="Switch to driver"
        tone="quiet"
        onPress={() => router.push('/driver')}
      />
    </Screen>
  );
}
