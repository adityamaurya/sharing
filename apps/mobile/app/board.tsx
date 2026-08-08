import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, PlateBadge, Row, Screen, Stack, T } from '@/components/ui';
import { DEMO_POOL } from '@/data/demo';
import { colors, radius, space } from '@/theme/tokens';

/**
 * Boarding.
 *
 * You were right that shouting a four-digit code across a station forecourt is
 * bad — it is also how the wrong person gets into the rickshaw. So:
 *
 *   1. The driver scans your rotating code. Nothing is spoken.
 *   2. Before that, the plate is shown in the largest type on the screen, so
 *      you match it against the vehicle in front of you. Getting into the wrong
 *      rickshaw is the failure we most want to prevent.
 *   3. A spoken PIN exists only as a fallback for a dead camera.
 *
 * The code is HMAC-TOTP over a seed issued at booking, so it works with no
 * signal at all. Station basements have no bars, and that is exactly when you
 * need your ticket.
 */
export default function Board() {
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [boarded, setBoarded] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 30 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  if (boarded) {
    return (
      <Screen>
        <Card tone="primarySoft">
          <T variant="display">You’re on your way</T>
          <T variant="body" color={colors.textMuted}>
            Sunil has confirmed all three passengers. Arriving Dombivli East at about
            9:37 AM.
          </T>
          <Divider />
          <Row justify="space-between">
            <T variant="body">Trip shared with</T>
            <T variant="bodyStrong">2 contacts</T>
          </Row>
        </Card>
        <Button label="Emergency help" tone="danger" onPress={() => {}} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Stack gap={space.sm}>
          <Button label="Driver has scanned me" onPress={() => setBoarded(true)} />
          <Button label="This is the wrong rickshaw" tone="quiet" onPress={() => {}} />
        </Stack>
      }
    >
      {/* Step 1 — check the plate. Biggest thing on the screen for a reason. */}
      <Stack gap={space.sm}>
        <T variant="caption" color={colors.textMuted}>
          CHECK THIS PLATE BEFORE YOU GET IN
        </T>
        <PlateBadge plate={DEMO_POOL.driver.plate} />
        <Row justify="space-between">
          <T variant="body">
            {DEMO_POOL.driver.name} · {DEMO_POOL.driver.tripsCompleted.toLocaleString('en-IN')}{' '}
            trips
          </T>
          <T variant="caption" color={colors.textMuted}>
            {DEMO_POOL.driver.fuelType.toUpperCase()}
          </T>
        </Row>
      </Stack>

      {/* Step 2 — show the code to the driver's camera. Nothing is spoken. */}
      <Card>
        <T variant="caption" color={colors.textMuted}>
          SHOW THIS TO YOUR DRIVER
        </T>

        <View style={qrStyle} accessibilityLabel="Your boarding code. Show it to the driver to scan.">
          <T variant="display" color={colors.textOnDark}>
            ▦ ▦ ▦
          </T>
          <T variant="caption" color={colors.textOnDark}>
            SCAN ME
          </T>
        </View>

        <Row justify="space-between">
          <T variant="body" color={colors.textMuted}>
            Refreshes in {secondsLeft}s
          </T>
          <T variant="body" color={colors.textMuted}>
            Works without signal
          </T>
        </Row>
      </Card>

      <Card tone="sunken">
        <T variant="bodyStrong">Can’t scan?</T>
        <T variant="body" color={colors.textMuted}>
          Tell the driver this number instead — but only if the camera isn’t working.
        </T>
        <T variant="display">4 7 2 9</T>
      </Card>
    </Screen>
  );
}

const qrStyle = {
  aspectRatio: 1,
  backgroundColor: colors.text,
  borderRadius: radius.md,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: space.sm,
};
