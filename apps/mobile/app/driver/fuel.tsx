import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Card, Divider, Money, Pill, Row, Screen, Stack, T } from '@/components/ui';
import {
  DEMO_FUEL_LOGS_THIS_WEEK,
  DEMO_FUEL_STREAK,
  DEMO_RECENT_DWELLS,
  DEMO_SPOT_QUOTE,
  DEMO_STATION_PRESENCE,
} from '@/data/demo';
import { colors, radius, space, touch, type } from '@/theme/tokens';
import {
  POLICY,
  add,
  buildRewardOffer,
  estimateQueueMinutes,
  evaluateCampaign,
  evaluateFuelLog,
  formatINR,
  rupees,
  type FuelType,
} from '@sharing/core';

/**
 * "Did you fill gas?"
 *
 * The screen the campaign exists for. It opens when a driver leaves a CNG
 * station having actually stopped there — see `fuel/campaign.ts` for why we arm
 * at five minutes inside the fence and ask on the way out rather than doing both
 * at once.
 *
 * Three things about the layout, all of them about a driver holding a phone in
 * one hand next to an idling engine:
 *
 *  - The money is the first thing on the screen, at display size, before any
 *    input. A driver deciding whether this is worth their attention should not
 *    have to scroll to find out what it pays.
 *  - The live queue estimate sits above the form, not below it. It is the part
 *    that costs the driver nothing and is worth something, and putting it first
 *    makes the exchange visible: here is what we know, now tell us what you
 *    filled.
 *  - The form is two numbers. Fuel type is pre-selected from the vehicle on file.
 *    Anything longer than 25 seconds and drivers stop doing it by week three.
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

  const now = Date.now();

  // Where the driver is in the campaign, and what this log is worth. Both come
  // from core, so the banner on the driver home screen and this screen cannot
  // disagree about whether the reward is live.
  const campaign = useMemo(() => evaluateCampaign(DEMO_STATION_PRESENCE, now), [now]);
  const queue = useMemo(() => estimateQueueMinutes(DEMO_RECENT_DWELLS), []);

  const offer = useMemo(
    () =>
      buildRewardOffer({
        consecutiveRewardedLogs: DEMO_FUEL_STREAK,
        rewardedLogsThisWeek: DEMO_FUEL_LOGS_THIS_WEEK,
        platformFeePerRide: DEMO_SPOT_QUOTE.platformFee,
      }),
    [],
  );

  // The same guardrails the server runs. Evaluating locally lets us tell the
  // driver *before* submitting whether this will pay — nobody likes finding out
  // afterwards that their effort earned nothing.
  const decision = useMemo(
    () =>
      evaluateFuelLog(
        {
          driverId: 'driver_demo',
          stationId: campaign.stationId,
          fuelType,
          quantity: Number(quantity) || 0,
          amountPaid: rupees(Number(amount) || 0),
          submittedAt: now,
          ocrPlate: substitute ? 'MH05ZZ0000' : 'MH 05 AB 1234',
          registeredPlate: 'MH05AB1234',
          substituteVehicleDeclared: substitute,
          dwellSeconds: campaign.dwellSeconds,
          onShift: true,
          tripsSinceLastLog: 4,
        },
        { rewardedLogTimestamps: [], substituteLogTimestampsThisMonth: [] },
        rupees(80),
      ),
    [campaign.stationId, campaign.dwellSeconds, fuelType, quantity, amount, substitute, now],
  );

  // What actually lands: the guardrail decision, plus the streak top-up when the
  // log qualifies at all.
  const payout =
    decision.reward > 0 ? add(decision.reward, offer.streakBonus) : decision.reward;

  if (submitted) {
    return (
      <Screen footer={<Button label="Done" onPress={() => router.back()} />}>
        <Card tone="primarySoft">
          <Row gap={space.sm}>
            <Icon name="seat" size="md" color={colors.success} />
            <T variant="caption" color={colors.success}>
              CREDITED
            </T>
          </Row>
          <T variant="display">{formatINR(payout)}</T>
          <T variant="body" color={colors.textMuted}>
            {decision.reason}
          </T>

          {offer.streakBonus > 0 ? (
            <>
              <Divider />
              <Row gap={space.md}>
                <Icon name="streak" size="md" color={colors.warning} />
                <Stack gap={2} flex={1}>
                  <T variant="bodyStrong">
                    {POLICY.fuel.STREAK_LENGTH_FOR_BONUS} in a row — {formatINR(offer.streakBonus)}{' '}
                    extra
                  </T>
                  <T variant="caption" color={colors.textMuted}>
                    Keep going and the next four earn it again.
                  </T>
                </Stack>
              </Row>
            </>
          ) : null}

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
            label={payout > 0 ? `Submit · earn ${formatINR(payout)}` : 'Submit anyway'}
            onPress={() => setSubmitted(true)}
            hint={
              payout > 0
                ? offer.effortLine
                : 'This one will not earn a reward, but the data still helps'
            }
          />
          <Button label="Not now" tone="quiet" onPress={() => router.back()} />
        </Stack>
      }
    >
      {/* ── The question, and what answering it pays ──────────────────────────
          Money first. A driver should not have to read a form to find the offer. */}
      <Card tone="primarySoft">
        <Row justify="space-between" gap={space.md} wrap>
          <Stack gap={2} flex={1}>
            <T variant="caption" color={colors.textMuted}>
              {campaign.stationName.toUpperCase()}
            </T>
            <T variant="display">Did you fill gas?</T>
          </Stack>
          <Money>{formatINR(offer.total)}</Money>
        </Row>

        <T variant="body" color={colors.textMuted}>
          You were here {Math.round(campaign.dwellSeconds / 60)} minutes. Tell us what you filled
          and the credit lands straight away.
        </T>

        <Divider />

        <Row gap={space.md} align="flex-start">
          <Icon name="wallet" size="md" color={colors.text} />
          <Stack gap={2} flex={1}>
            <T variant="bodyStrong">{offer.worthLine}</T>
            <T variant="caption" color={colors.textMuted}>
              {offer.effortLine}
            </T>
          </Stack>
        </Row>

        {/* Streak, shown as progress toward a bonus — never as something you are
            about to lose. Loss-framing converts better and breeds exactly the
            resentment you cannot afford among drivers who talk all morning. */}
        <Row gap={space.md} align="flex-start">
          <Icon name="streak" size="md" color={offer.streakBonus > 0 ? colors.warning : colors.textFaint} />
          <Stack gap={2} flex={1}>
            <T variant="bodyStrong">
              {offer.streakBonus > 0
                ? `${POLICY.fuel.STREAK_LENGTH_FOR_BONUS} in a row — ${formatINR(offer.streakBonus)} extra on this one`
                : `${offer.logsToBonus} more in a row for +${formatINR(rupees(POLICY.fuel.STREAK_BONUS_RUPEES))}`}
            </T>
            <Row gap={space.xs}>
              {Array.from({ length: POLICY.fuel.STREAK_LENGTH_FOR_BONUS }, (_, i) => (
                <View
                  key={i}
                  style={{
                    width: 26,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i <= DEMO_FUEL_STREAK ? colors.warning : colors.border,
                  }}
                />
              ))}
            </Row>
          </Stack>
        </Row>
      </Card>

      {/* ── What we give back ────────────────────────────────────────────────
          The queue estimate is built from other drivers' dwell times — a
          by-product of this very campaign. Showing it here is the whole reason a
          driver opens the app voluntarily instead of dismissing the prompt. */}
      <Card tone="sunken">
        <Row gap={space.md} align="flex-start">
          <Icon name="waiting" size="md" color={colors.text} />
          <Stack gap={2} flex={1}>
            <T variant="bodyStrong">
              {queue.minutes === null ? 'Queue length unknown' : `Queue here: about ${queue.minutes} min`}
            </T>
            <T variant="caption" color={colors.textMuted}>
              {queue.message}
            </T>
          </Stack>
        </Row>
      </Card>

      {/* ── Two numbers ─────────────────────────────────────────────────────── */}
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
              {substitute ? <Icon name="check" size="sm" color={colors.text} /> : null}
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
      <Card tone={payout > 0 ? 'primarySoft' : 'sunken'}>
        <Row justify="space-between" gap={space.md} wrap>
          <T variant="bodyStrong">
            {payout > 0
              ? `You’ll earn ${formatINR(payout)}`
              : decision.heldForReview
                ? 'Held for review'
                : 'No reward for this one'}
          </T>
          <Pill
            tone={payout > 0 ? 'go' : decision.heldForReview ? 'warn' : 'neutral'}
            icon={payout > 0 ? '₹' : decision.heldForReview ? '⏳' : '•'}
          >
            {payout > 0 ? 'Eligible' : decision.heldForReview ? 'Checking' : 'Unpaid'}
          </Pill>
        </Row>
        <T variant="body" color={colors.textMuted}>
          {decision.reason}
        </T>
        <T variant="caption" color={colors.textMuted}>
          {offer.logsLeftThisWeek > 0
            ? `${offer.logsLeftThisWeek} paid log${offer.logsLeftThisWeek === 1 ? '' : 's'} left this week.`
            : 'You have used both paid logs this week. Logging still helps, it just does not pay.'}
        </T>
      </Card>

      <Card tone="sunken">
        <T variant="bodyStrong">Why we ask</T>
        <T variant="body" color={colors.textMuted}>
          Your fills are what tell every other driver how long this queue is and where gas is
          cheapest today — the number at the top of this screen came from drivers who answered
          before you. It also lets us show riders how much pollution sharing actually saves.
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
