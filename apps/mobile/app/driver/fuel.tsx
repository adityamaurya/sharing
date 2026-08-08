import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, Card, Divider, Pill, Row, Screen, Stack, T } from '@/components/ui';
import { colors, radius, space, touch, type } from '@/theme/tokens';
import {
  POLICY,
  evaluateFuelLog,
  formatINR,
  rupees,
  type FuelType,
} from '@sharing/core';

/**
 * Fuel logging.
 *
 * Triggered by a geofence: the driver dwelt two minutes inside a mapped fuel
 * station while on shift. He confirms what he actually bought and photographs
 * the plate; the plate OCR is what makes "I'm driving my friend's rickshaw
 * today" an honest declaration instead of a loophole.
 *
 * The reward is platform credit, never cash. Cash-out is how these programmes
 * get farmed, and credit against platform fees is worth real money to a driver
 * and nothing at all to somebody with twelve burner accounts.
 */
export default function LogFuel() {
  const router = useRouter();

  const [fuelType, setFuelType] = useState<FuelType>('cng');
  const [quantity, setQuantity] = useState('4.2');
  const [amount, setAmount] = useState('336');
  const [substitute, setSubstitute] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // The same guardrails the server runs. Evaluating locally lets us tell the
  // driver *before* he submits whether this will pay — nobody likes finding out
  // afterwards that their effort earned nothing.
  const decision = useMemo(
    () =>
      evaluateFuelLog(
        {
          driverId: 'driver_demo',
          stationId: 'mgl-dombivli-01',
          fuelType,
          quantity: Number(quantity) || 0,
          amountPaid: rupees(Number(amount) || 0),
          submittedAt: Date.now(),
          ocrPlate: substitute ? 'MH05ZZ0000' : 'MH 05 AB 1234',
          registeredPlate: 'MH05AB1234',
          substituteVehicleDeclared: substitute,
          dwellSeconds: 184,
          onShift: true,
          tripsSinceLastLog: 4,
        },
        { rewardedLogTimestamps: [], substituteLogTimestampsThisMonth: [] },
        rupees(80),
      ),
    [fuelType, quantity, amount, substitute],
  );

  if (submitted) {
    return (
      <Screen footer={<Button label="Done" onPress={() => router.back()} />}>
        <Card tone="primarySoft">
          <Pill tone="go" icon="✓">
            Logged
          </Pill>
          <T variant="display">{formatINR(decision.reward)} credited</T>
          <T variant="body" color={colors.textMuted}>
            {decision.reason}
          </T>
          <Divider />
          <T variant="body" color={colors.textMuted}>
            Credit comes off your platform fees, so it lands in your pocket as fewer rupees
            deducted — not as a payout you have to chase.
          </T>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Stack gap={space.sm}>
          <Button
            label={
              decision.reward > 0
                ? `Submit · earn ${formatINR(decision.reward)}`
                : 'Submit anyway'
            }
            onPress={() => setSubmitted(true)}
            hint={
              decision.reward > 0
                ? undefined
                : 'This one will not earn a reward, but the data still helps'
            }
          />
          <Button label="Not now" tone="quiet" onPress={() => router.back()} />
        </Stack>
      }
    >
      <Stack gap={space.xs}>
        <T variant="caption" color={colors.textMuted}>
          DETECTED AT
        </T>
        <T variant="title">Mahanagar Gas, Dombivli East</T>
        <T variant="body" color={colors.textMuted}>
          You have been here 3 minutes. What did you fill?
        </T>
      </Stack>

      <Card>
        <T variant="caption" color={colors.textMuted}>
          FUEL
        </T>
        <Row gap={space.sm} wrap>
          {(['cng', 'petrol', 'electric'] as const).map((f) => (
            <Chip key={f} label={f.toUpperCase()} active={fuelType === f} onPress={() => setFuelType(f)} />
          ))}
        </Row>

        <Divider />

        <Row gap={space.lg} wrap align="flex-start">
          <Field
            label={fuelType === 'cng' ? 'Kilograms' : fuelType === 'petrol' ? 'Litres' : 'kWh'}
            value={quantity}
            onChangeText={setQuantity}
          />
          <Field label="Amount paid (₹)" value={amount} onChangeText={setAmount} />
        </Row>

        <Divider />

        <Pressable
          onPress={() => setSubstitute((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: substitute }}
          style={{ minHeight: touch.min, justifyContent: 'center' }}
        >
          <Row gap={space.md} align="flex-start">
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.sm,
                borderWidth: 2,
                borderColor: substitute ? colors.text : colors.borderStrong,
                backgroundColor: substitute ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {substitute ? <T variant="bodyStrong">✓</T> : null}
            </View>
            <Stack gap={2} flex={1}>
              <T variant="bodyStrong">I’m driving a different rickshaw today</T>
              <T variant="caption" color={colors.textMuted}>
                Half reward · up to {POLICY.fuel.MAX_SUBSTITUTE_LOGS_PER_MONTH} times a month
              </T>
            </Stack>
          </Row>
        </Pressable>
      </Card>

      {/* Tell him what this will pay before he taps, not after. */}
      <Card tone={decision.reward > 0 ? 'primarySoft' : 'sunken'}>
        <Row justify="space-between" gap={space.md} wrap>
          <T variant="bodyStrong">
            {decision.reward > 0
              ? `You’ll earn ${formatINR(decision.reward)}`
              : decision.heldForReview
                ? 'Held for review'
                : 'No reward for this one'}
          </T>
          <Pill
            tone={decision.reward > 0 ? 'go' : decision.heldForReview ? 'warn' : 'neutral'}
            icon={decision.reward > 0 ? '₹' : decision.heldForReview ? '⏳' : '•'}
          >
            {decision.reward > 0 ? 'Eligible' : decision.heldForReview ? 'Checking' : 'Unpaid'}
          </Pill>
        </Row>
        <T variant="body" color={colors.textMuted}>
          {decision.reason}
        </T>
      </Card>

      <Card tone="sunken">
        <T variant="bodyStrong">Why we ask</T>
        <T variant="body" color={colors.textMuted}>
          Live fuel prices help every driver on the app know where gas is cheapest today, and
          it lets us show riders how much pollution sharing actually saves. Two logs a week
          earn a reward — after that you can still log, it just doesn’t pay.
        </T>
      </Card>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={{
        minHeight: touch.min,
        paddingHorizontal: space.lg,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: active ? colors.text : colors.border,
        backgroundColor: active ? colors.primary : colors.surface,
      }}
    >
      <T variant="bodyStrong">{label}</T>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <Stack gap={space.xs}>
      <T variant="caption" color={colors.textMuted}>
        {label}
      </T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        style={{
          minHeight: touch.comfortable,
          minWidth: 120,
          borderWidth: 2,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          fontSize: type.figure.fontSize,
          fontWeight: '700',
          color: colors.text,
          backgroundColor: colors.surface,
        }}
      />
    </Stack>
  );
}
