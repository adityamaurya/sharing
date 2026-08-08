import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  Button,
  Card,
  Divider,
  Money,
  Pill,
  Row,
  Screen,
  Stack,
  T,
} from '@/components/ui';
import { DEMO_POOL, DEMO_SPOT_QUOTE, corridorLabel } from '@/data/demo';
import { colors, space } from '@/theme/tokens';
import { POLICY, assessDemand, formatINR, quoteShortFill, rupees } from '@sharing/core';

/**
 * NOW — "I'm at the stand, get me a pool."
 *
 * The two things this screen must never do:
 *
 *  - Invent demand. If nobody is going your way it says so, in plain words, and
 *    points at a slot that works. An app that fakes demand dies in a week at a
 *    Mumbai station; word travels along a rickshaw queue faster than any push.
 *  - Surprise you with a short-fill price. The capped fare is shown up front,
 *    and declining is free.
 */
export default function RideNow() {
  const router = useRouter();
  const [joined, setJoined] = useState(false);

  const { from, to } = corridorLabel(DEMO_POOL.corridorId);
  const seatsLeft = POLICY.SEATS_PER_POOL - DEMO_POOL.seatsTaken;
  const minutesToGo = Math.max(0, Math.round((DEMO_POOL.departureAt - Date.now()) / 60_000));

  const demand = assessDemand(DEMO_POOL.seatsTaken, 4, '9:40 AM');
  const shortFill = quoteShortFill(rupees(150), 2);

  return (
    <Screen
      footer={
        joined ? (
          <Button
            label="Show my boarding code"
            onPress={() => router.push('/board')}
            hint={`${DEMO_POOL.driver.plate} · leaving in ${minutesToGo} min`}
          />
        ) : (
          <Stack gap={space.sm}>
            <Button
              label={`Join this pool · ${formatINR(DEMO_SPOT_QUOTE.total)}`}
              onPress={() => setJoined(true)}
              hint={`Seat held for ${POLICY.matching.SEAT_HOLD_SECONDS} seconds`}
            />
            <T variant="caption" color={colors.textMuted} center>
              You can leave the pool free until it departs.
            </T>
          </Stack>
        )
      }
    >
      {/* Where you are — detected, not typed. */}
      <Stack gap={space.xs}>
        <Row gap={space.sm}>
          <T variant="caption" color={colors.success}>
            ●
          </T>
          <T variant="caption" color={colors.textMuted}>
            YOU ARE AT
          </T>
        </Row>
        <T variant="title">{from}</T>
        <T variant="body" color={colors.textMuted}>
          Going to {to}
        </T>
      </Stack>

      {/* Live pool state. */}
      <Card tone={joined ? 'primarySoft' : 'surface'}>
        <Row justify="space-between">
          <T variant="caption" color={colors.textMuted}>
            {joined ? 'YOU ARE IN THIS POOL' : 'POOL FORMING'}
          </T>
          <Pill tone={seatsLeft === 0 ? 'go' : 'warn'} icon={seatsLeft === 0 ? '✓' : '⏳'}>
            {seatsLeft === 0 ? 'Full — leaving now' : `Needs ${seatsLeft} more`}
          </Pill>
        </Row>

        <T variant="display">Leaves in {minutesToGo} min</T>

        <Divider />

        <Stack gap={space.md}>
          {DEMO_POOL.coRiders.map((r) => (
            <Row key={r.name} justify="space-between">
              <Stack gap={2}>
                <T variant="bodyStrong">{r.name}</T>
                <T variant="caption" color={colors.textMuted}>
                  {r.sharedBefore >= 3
                    ? `You have ridden together ${r.sharedBefore} times`
                    : 'New to your pool'}
                </T>
              </Stack>
              {r.reliability === 'gold' ? (
                <Pill tone="go" icon="★">
                  Always on time
                </Pill>
              ) : (
                <Pill tone="neutral" icon="•">
                  Reliable
                </Pill>
              )}
            </Row>
          ))}

          <Row justify="space-between">
            <Stack gap={2}>
              <T variant="bodyStrong" color={joined ? colors.text : colors.textFaint}>
                {joined ? 'You' : 'Empty seat'}
              </T>
              <T variant="caption" color={colors.textMuted}>
                {joined ? 'Seat confirmed' : `${formatINR(DEMO_SPOT_QUOTE.total)} to join`}
              </T>
            </Stack>
            <Money tone={joined ? colors.text : colors.textFaint}>
              {formatINR(DEMO_SPOT_QUOTE.total)}
            </Money>
          </Row>
        </Stack>
      </Card>

      {/* Fare, itemised. No hidden lines — this is the whole promise. */}
      <Card tone="sunken">
        <T variant="caption" color={colors.textMuted}>
          WHAT YOU PAY
        </T>
        <Row justify="space-between">
          <T variant="body">Your share of the ₹150 fare</T>
          <T variant="bodyStrong">{formatINR(DEMO_SPOT_QUOTE.seatFare)}</T>
        </Row>
        <Row justify="space-between">
          <T variant="body">App fee</T>
          <T variant="bodyStrong">{formatINR(DEMO_SPOT_QUOTE.platformFee)}</T>
        </Row>
        <Row justify="space-between">
          <T variant="body">Driver guarantee</T>
          <T variant="bodyStrong">{formatINR(DEMO_SPOT_QUOTE.guaranteeLevy)}</T>
        </Row>
        <Divider />
        <Row justify="space-between">
          <T variant="subtitle">Total</T>
          <Money>{formatINR(DEMO_SPOT_QUOTE.total)}</Money>
        </Row>
        <T variant="caption" color={colors.textMuted}>
          Riding alone costs ₹150. The driver receives the full ₹150 either way.
        </T>
      </Card>

      {/* Honesty about what happens if it doesn't fill. Shown before joining. */}
      <Card tone="sunken">
        <T variant="bodyStrong">If nobody else joins</T>
        <T variant="body" color={colors.textMuted}>
          With two of you, it is {formatINR(shortFill.perPassengerTotal)} each. On your own,
          the most you would be asked is{' '}
          {formatINR(quoteShortFill(rupees(150), 1).perPassengerTotal)} — and you can always
          walk away free instead. We never charge you for three seats.
        </T>
      </Card>

      {demand.verdict !== 'good' ? (
        <Card tone="sunken">
          <Pill tone="warn" icon="!">
            Thin right now
          </Pill>
          <T variant="body">{demand.message}</T>
        </Card>
      ) : null}
    </Screen>
  );
}
