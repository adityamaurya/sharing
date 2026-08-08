import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Divider, Pill, Row, Screen, Stack, T } from '@/components/ui';
import { DEMO_ARRIVALS } from '@/data/demo';
import { colors, space } from '@/theme/tokens';
import { assessDemand, formatINR, quoteSeat, rupees } from '@sharing/core';

/**
 * LATER — "I'll be at Khandeshwar at 1:45."
 *
 * The student flow, and the most defensible part of the product. Nobody serves
 * it today because nobody knows who is arriving — we do, because people tell
 * us. You post an intent from the train and the pool forms before anyone lands,
 * so you walk off the platform past the queue instead of standing in it.
 */
export default function RideLater() {
  const router = useRouter();
  const [committed, setCommitted] = useState(false);
  const quote = quoteSeat(rupees(120));

  const demand = assessDemand(DEMO_ARRIVALS.length, 0, null);

  return (
    <Screen
      footer={
        committed ? (
          <Button
            label="Show my boarding code"
            onPress={() => router.push('/board')}
            hint="Your pool is held until 1:55 PM"
          />
        ) : (
          <Button
            label={`Hold my seat · ${formatINR(quote.total)}`}
            onPress={() => setCommitted(true)}
            hint="Nothing is charged until the pool actually forms"
          />
        )
      }
    >
      <Stack gap={space.xs}>
        <T variant="caption" color={colors.textMuted}>
          ARRIVING AT
        </T>
        <T variant="display">Khandeshwar, 1:45 PM</T>
        <T variant="body" color={colors.textMuted}>
          Off the 1:05 from Kurla · going to Palava
        </T>
      </Stack>

      <Card tone={committed ? 'primarySoft' : 'surface'}>
        <Row justify="space-between">
          <T variant="caption" color={colors.textMuted}>
            OTHERS ARRIVING 1:38 – 1:52
          </T>
          <Pill tone="go" icon="✓">
            Pool likely
          </Pill>
        </Row>

        <T variant="body">{demand.message}</T>

        <Divider />

        <Stack gap={space.md}>
          {DEMO_ARRIVALS.map((p) => (
            <Row key={p.name} justify="space-between" gap={space.md}>
              <Stack gap={2} flex={1}>
                <T variant="bodyStrong">{p.name}</T>
                <T variant="caption" color={colors.textMuted}>
                  {p.train}
                </T>
              </Stack>
              <Stack gap={2}>
                <T variant="subtitle">{p.arrivesAt}</T>
                <T variant="caption" color={colors.textMuted}>
                  {p.reliability === 'gold'
                    ? 'Always on time'
                    : p.reliability === 'silver'
                      ? 'Reliable'
                      : 'New rider'}
                </T>
              </Stack>
            </Row>
          ))}
        </Stack>
      </Card>

      {committed ? (
        <Card tone="sunken">
          <T variant="bodyStrong">You’re holding a pool</T>
          <T variant="body" color={colors.textMuted}>
            Sana joins at 1:38 and Nikhil at 1:45. A rickshaw is assigned once two of you
            have tapped “I’ve arrived”. If your train is late, tap “running late” and we
            move the pool with you.
          </T>
        </Card>
      ) : (
        <Card tone="sunken">
          <T variant="bodyStrong">How this works</T>
          <T variant="body" color={colors.textMuted}>
            You hold a seat now, from the train. Others arriving in the same fifteen minutes
            join it. When you step off, the rickshaw is already there — no queue, and one
            third of the fare.
          </T>
        </Card>
      )}

      <Card tone="sunken">
        <T variant="bodyStrong">This route is still new</T>
        <T variant="body" color={colors.textMuted}>
          Only 3 drivers have committed to Khandeshwar → Palava so far, so afternoon pools
          can be slow to fill. We’d rather tell you that now than leave you waiting.
        </T>
      </Card>
    </Screen>
  );
}
