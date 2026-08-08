import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Button, Card, Divider, GraceDots, Money, Pill, Row, Screen, Stack, T } from '@/components/ui';
import { DEMO_PASS, corridorLabel, minutesToClock } from '@/data/demo';
import { colors, radius, space, touch } from '@/theme/tokens';
import { formatINR, prettyDate, quotePass, rupees, type PassPlan } from '@sharing/core';

/**
 * The pass: buy one, or manage the one you have.
 *
 * Notice what the plan comparison leads with — grace days and the guaranteed
 * seat, not the discount. The discount is small on purpose (it comes out of a
 * driver's income) and it is not why anyone buys this. People buy certainty.
 */
export default function PassScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<PassPlan>('monthly');
  const { from, to } = corridorLabel(DEMO_PASS.corridorId);

  const quote = quotePass(rupees(150), plan);
  const hasPass = DEMO_PASS.status === 'active';

  return (
    <Screen
      footer={
        hasPass ? (
          <Button
            label="I'm not going tomorrow"
            tone="secondary"
            onPress={() => router.push('/pass/skip')}
          />
        ) : (
          <Button
            label={`Buy ${plan} pass · ${formatINR(quote.upfrontTotal)}`}
            onPress={() => {}}
            hint="UPI, card, or UPI AutoPay"
          />
        )
      }
    >
      {hasPass ? (
        <Card tone="primarySoft">
          <Row justify="space-between">
            <T variant="caption" color={colors.textMuted}>
              YOUR MONTHLY PASS
            </T>
            <Pill tone="go" icon="✓">
              Active
            </Pill>
          </Row>

          <T variant="display">{minutesToClock(DEMO_PASS.departureMinute)}</T>
          <T variant="body">
            {from} → {to}
          </T>
          <T variant="body" color={colors.textMuted}>
            Monday to Saturday
          </T>

          <Divider />

          <Row justify="space-between">
            <T variant="body">Runs to</T>
            <T variant="subtitle">{prettyDate(DEMO_PASS.endDate)}</T>
          </Row>
          <Row justify="space-between">
            <T variant="body">Grace days</T>
            <GraceDots total={DEMO_PASS.graceDaysTotal} used={DEMO_PASS.graceDaysUsed} />
          </Row>
          <Row justify="space-between">
            <T variant="body">Locked fare</T>
            <T variant="subtitle">{formatINR(DEMO_PASS.seatFare)} a ride</T>
          </Row>

          <T variant="caption" color={colors.textMuted}>
            Your fare cannot change while this pass is running, even if we revise the route
            price.
          </T>
        </Card>
      ) : null}

      <T variant="title">{hasPass ? 'Renew or change plan' : 'Choose a plan'}</T>

      <Row gap={space.md} align="stretch">
        {(['weekly', 'monthly'] as const).map((p) => {
          const q = quotePass(rupees(150), p);
          const active = plan === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPlan(p)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${p} pass, ${formatINR(q.upfrontTotal)} for ${q.serviceDays} days`}
              style={{
                flex: 1,
                minHeight: touch.min,
                padding: space.lg,
                gap: space.sm,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: active ? colors.text : colors.border,
                backgroundColor: active ? colors.primarySoft : colors.surface,
              }}
            >
              <T variant="caption" color={colors.textMuted}>
                {p.toUpperCase()}
              </T>
              <Money>{formatINR(q.upfrontTotal)}</Money>
              <T variant="caption" color={colors.textMuted}>
                {q.serviceDays} rides · {formatINR(q.perRideTotal)} each
              </T>
              <T variant="caption" color={colors.success}>
                {q.graceDays} grace {q.graceDays === 1 ? 'day' : 'days'}
              </T>
            </Pressable>
          );
        })}
      </Row>

      <Card tone="sunken">
        <T variant="bodyStrong">What a pass actually buys you</T>
        <Stack gap={space.sm}>
          <T variant="body" color={colors.textMuted}>
            • A seat held for you every service day — you stop wondering each morning.
          </T>
          <T variant="body" color={colors.textMuted}>
            • The same driver wherever possible, so you both stop negotiating.
          </T>
          <T variant="body" color={colors.textMuted}>
            • {quote.graceDays} days you can skip with no questions asked and no reason
            given.
          </T>
          <T variant="body" color={colors.textMuted}>
            • A fare locked for the whole {plan === 'weekly' ? 'week' : 'month'}.
          </T>
        </Stack>
        <Divider />
        <T variant="caption" color={colors.textMuted}>
          You save {formatINR(quote.savingsVsDaily)} against paying daily — but the reason to
          buy this is the seat, not the discount.
        </T>
      </Card>

      <Card tone="sunken">
        <T variant="bodyStrong">Paying by UPI AutoPay</T>
        <T variant="body" color={colors.textMuted}>
          You approve the mandate once with your UPI PIN. Your bank tells you 24 hours before
          each debit, and you can pause or cancel it any time from your UPI app or from here.
          We never debit without that notice.
        </T>
      </Card>
    </Screen>
  );
}
