import { useRouter } from 'expo-router';

import { Button, Card, Divider, Money, Pill, Row, Screen, Stack, T } from '@/components/ui';
import { colors, space } from '@/theme/tokens';
import { driverGuaranteedEarnings, formatINR, rupees } from '@sharing/core';

/**
 * Driver home.
 *
 * The whole driver-side pitch is one number, and it belongs at the top in the
 * largest type on the screen: **money you are already guaranteed this month,
 * before you turn a wheel.** Everything else is secondary.
 *
 * Note what is absent: no surge meter, no acceptance-rate scold, no ranking.
 * A driver earning ₹600 a day does not need to be gamified, he needs to know
 * what is certain.
 */
export default function DriverHome() {
  const router = useRouter();

  const guaranteed = driverGuaranteedEarnings(rupees(150), 'monthly', 8);

  return (
    <Screen
      footer={<Button label="Start today's shift" onPress={() => {}} />}
    >
      <Card tone="primarySoft">
        <T variant="caption" color={colors.textMuted}>
          GUARANTEED THIS MONTH
        </T>
        <T variant="display">{formatINR(guaranteed)}</T>
        <T variant="body" color={colors.textMuted}>
          From 8 monthly pass riders on Palava ↔ Dombivli. Already paid into escrow — you
          receive it whether or not each rider turns up.
        </T>
      </Card>

      <Card>
        <Row justify="space-between">
          <T variant="caption" color={colors.textMuted}>
            TODAY
          </T>
          <Pill tone="go" icon="✓">
            4 trips booked
          </Pill>
        </Row>

        <Stack gap={space.md}>
          {[
            { time: '9:15 AM', route: 'Palava Gate 2 → Dombivli East', seats: 3, fare: rupees(138) },
            { time: '10:05 AM', route: 'Dombivli East → Palava Gate 2', seats: 2, fare: rupees(100) },
            { time: '6:40 PM', route: 'Dombivli East → Palava Gate 2', seats: 3, fare: rupees(138) },
            { time: '7:30 PM', route: 'Palava Gate 2 → Dombivli East', seats: 3, fare: rupees(150) },
          ].map((t) => (
            <Row key={t.time} justify="space-between">
              <Stack gap={2}>
                <T variant="bodyStrong">{t.time}</T>
                <T variant="caption" color={colors.textMuted}>
                  {t.route} · {t.seats} seats
                </T>
              </Stack>
              <T variant="subtitle">{formatINR(t.fare)}</T>
            </Row>
          ))}
        </Stack>

        <Divider />

        <Row justify="space-between">
          <T variant="subtitle">Today’s total</T>
          <Money>{formatINR(rupees(526))}</Money>
        </Row>
      </Card>

      <Card tone="sunken">
        <Row justify="space-between">
          <Stack gap={2}>
            <T variant="bodyStrong">A rider cancelled tomorrow’s 9:15</T>
            <T variant="caption" color={colors.textMuted}>
              You are paid either way. We are looking for a replacement.
            </T>
          </Stack>
          <Pill tone="go" icon="₹">
            Paid
          </Pill>
        </Row>
      </Card>

      <Button
        label="Log fuel · earn ₹20"
        tone="secondary"
        onPress={() => router.push('/driver/fuel')}
        hint="2 of 2 rewards available this week"
      />

      <Button label="Switch to passenger" tone="quiet" onPress={() => router.replace('/')} />
    </Screen>
  );
}
