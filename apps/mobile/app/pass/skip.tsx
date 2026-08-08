import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { Button, Card, Divider, GraceDots, Pill, Row, Screen, Stack, T } from '@/components/ui';
import { DEMO_PASS, corridorLabel, minutesToClock } from '@/data/demo';
import { colors, space } from '@/theme/tokens';
import { applyCreditToPass, prettyDate, previewCancellation } from '@sharing/core';

/**
 * "I'm not going tomorrow."
 *
 * The most important screen in the product, and the one four rules apply to
 * without exception (docs/01-fairness-engine.md §9):
 *
 *   1. Always show the outcome BEFORE the tap. Never after.
 *   2. Never ask why. No reason field, no dropdown, no "optional feedback".
 *   3. State it in days and dates, never percentages or credit balances.
 *   4. One tap to do it.
 *
 * Surprise is what generates one-star reviews, not cost. A passenger who sees
 * "returns half a day" before confirming may be annoyed; one who discovers it
 * afterwards is gone, and tells their building.
 */
export default function SkipRide() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  const { from, to } = corridorLabel(DEMO_PASS.corridorId);

  // Tomorrow's departure, in epoch ms.
  const departureAt = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(Math.floor(DEMO_PASS.departureMinute / 60), DEMO_PASS.departureMinute % 60, 0, 0);
    return d.getTime();
  }, []);

  const graceRemaining = DEMO_PASS.graceDaysTotal - DEMO_PASS.graceDaysUsed;

  // The same function the server will use to settle this. One source of truth,
  // so the number on screen and the number on the receipt cannot disagree.
  const preview = useMemo(
    () =>
      previewCancellation(
        {
          seatFare: DEMO_PASS.seatFare,
          cancelledAt: Date.now(),
          departureAt,
          graceDaysRemaining: graceRemaining,
          reseated: false,
          actor: 'passenger',
        },
        // Reseat likelihood for this corridor and window, from history.
        0.72,
      ),
    [departureAt, graceRemaining],
  );

  const projected = applyCreditToPass(
    DEMO_PASS.endDate,
    DEMO_PASS.serviceWeekdays,
    preview.outcome.creditDays,
    DEMO_PASS.creditDaysBanked,
  );

  if (done) {
    return (
      <Screen
        footer={<Button label="Done" onPress={() => router.dismissAll()} />}
      >
        <Card tone="primarySoft">
          <Pill tone="go" icon="✓">
            Tomorrow cancelled
          </Pill>
          <T variant="display">{projected.message}</T>
          <T variant="body" color={colors.textMuted}>
            We’ll offer your seat to someone else on this route. Your driver has been told,
            so nobody waits at the gate for you.
          </T>
          <Divider />
          <Row justify="space-between">
            <T variant="body">Grace days</T>
            <GraceDots
              total={DEMO_PASS.graceDaysTotal}
              used={
                preview.outcome.graceDayConsumed && !preview.reseatLikely
                  ? DEMO_PASS.graceDaysUsed + 1
                  : DEMO_PASS.graceDaysUsed
              }
            />
          </Row>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Stack gap={space.sm}>
          <Button
            label={preview.confirmLabel}
            onPress={() => setDone(true)}
            accessibilityHint={preview.headline}
          />
          <Button label="Never mind" tone="quiet" onPress={() => router.back()} />
        </Stack>
      }
    >
      <Stack gap={space.xs}>
        <T variant="caption" color={colors.textMuted}>
          SKIP TOMORROW
        </T>
        <T variant="display">{minutesToClock(DEMO_PASS.departureMinute)}</T>
        <T variant="body" color={colors.textMuted}>
          {from} → {to}
        </T>
      </Stack>

      {/* Rule 1: the outcome, stated before the tap, in the largest type. */}
      <Card tone={preview.outcome.creditDays >= 1 ? 'primarySoft' : 'sunken'}>
        <T variant="title">{preview.headline}</T>
        <T variant="body" color={colors.textMuted}>
          {preview.detail}
        </T>

        <Divider />

        {/* Rule 3: days and dates, not percentages. */}
        <Row justify="space-between">
          <T variant="body">Your pass will run to</T>
          <T variant="subtitle">{prettyDate(projected.newEndDate)}</T>
        </Row>
        <Row justify="space-between">
          <T variant="body">Grace days after this</T>
          <T variant="subtitle">
            {preview.reseatLikely || !preview.outcome.graceDayConsumed
              ? graceRemaining
              : graceRemaining - 1}{' '}
            of {DEMO_PASS.graceDaysTotal}
          </T>
        </Row>
      </Card>

      {preview.reseatLikely ? (
        <Card tone="sunken">
          <Row gap={space.md} align="flex-start">
            <T variant="subtitle">↻</T>
            <Stack gap={space.xs}>
              <T variant="bodyStrong">We’ll try to fill your seat first</T>
              <T variant="body" color={colors.textMuted}>
                Most seats on this route sell on again at this much notice. If yours does,
                your grace days stay untouched.
              </T>
            </Stack>
          </Row>
        </Card>
      ) : null}

      {/* Said plainly, because a driver's morning depends on it. */}
      <Card tone="sunken">
        <Row gap={space.md} align="flex-start">
          <T variant="subtitle">🛺</T>
          <Stack gap={space.xs}>
            <T variant="bodyStrong">Your driver still gets paid</T>
            <T variant="body" color={colors.textMuted}>
              Whatever happens with your seat, Sunil is paid in full for tomorrow. You are
              not taking money out of his day by being unwell.
            </T>
          </Stack>
        </Row>
      </Card>

      {/*
        Rule 2 lives here as an absence: there is no reason field on this screen,
        and there never will be. Do not add one.
      */}
    </Screen>
  );
}
