import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import {
  DriverIllustration,
  FuelIllustration,
  GraceIllustration,
  ShareIllustration,
  ThreeWaysIllustration,
} from '@/components/illustrations';
import { CorridorMap } from '@/components/map';
import { Button, Row, Stack, T } from '@/components/ui';
import { markWalkthroughSeen } from '@/data/firstRun';
import { colors, radius, space } from '@/theme/tokens';

/**
 * The walkthrough.
 *
 * Written for somebody who has never used a ride app and is not sure this one is
 * safe to trust with money. That shapes every choice here:
 *
 *  - Five screens, no more. Anything longer gets skipped, and then the person
 *    who most needed it is the one who didn't read it.
 *  - Every screen answers a question a real person asked in testing, in their
 *    words: "how is it cheaper", "what if I don't go one day", "does the driver
 *    lose money", "where does it actually run".
 *  - The awkward facts are *in* the walkthrough, not buried in terms. The pass
 *    slide says a skipped day returns a day, not a refund. Somebody who learns
 *    that here forgives it; somebody who discovers it on a Tuesday morning does
 *    not.
 *  - Skip is available from the first screen. Trapping people is not onboarding.
 */

interface Slide {
  readonly key: string;
  readonly icon: IconName;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly art: () => React.ReactNode;
}

const SLIDES: readonly Slide[] = [
  {
    key: 'share',
    icon: 'people',
    eyebrow: 'WHAT SHARING IS',
    title: 'Three of you, one rickshaw',
    body:
      'A rickshaw from your gate to the station costs about ₹150, whether one person rides or three. ' +
      'Sharing puts three people going the same way into the same rickshaw, so you each pay a third. ' +
      'Same rickshaw, same time, one third of the money.',
    art: () => <ShareIllustration />,
  },
  {
    key: 'ways',
    icon: 'now',
    eyebrow: 'THREE WAYS TO RIDE',
    title: 'Now, later, or every day',
    body:
      'Ride now if you are standing at the gate. Book for later while you are still on the train, ' +
      'and the rickshaw is waiting when you step off. Or take a daily pass and hold the same seat, ' +
      'same time, every working day.',
    art: () => <ThreeWaysIllustration />,
  },
  {
    key: 'grace',
    icon: 'skip',
    eyebrow: 'IF YOU CANNOT GO',
    title: 'Miss a day, keep the day',
    body:
      'Tell us the night before and your pass simply runs a day longer. No refund forms, no phone calls, ' +
      'no reason needed — one tap on the home screen. You get four of these a month, and we show you ' +
      'exactly what a skip costs before you confirm it, never after.',
    art: () => <GraceIllustration />,
  },
  {
    key: 'driver',
    icon: 'guarantee',
    eyebrow: 'FAIR TO THE DRIVER',
    title: 'Your driver is paid either way',
    body:
      'Pass money is guaranteed to the driver for the whole month, whether or not every rider turns up. ' +
      'That is why nobody argues with you at the gate on a morning you are unwell — his month does not ' +
      'depend on your Tuesday.',
    art: () => <DriverIllustration />,
  },
  {
    key: 'fuel',
    icon: 'fuel',
    eyebrow: 'FOR DRIVERS',
    title: 'Earn while you wait for gas',
    body:
      'A CNG queue in Dombivli runs 15 to 30 minutes on a normal morning. When we see you have been at ' +
      'the pump a few minutes, we ask two quick questions about your fill — and pay you ₹20 in credit ' +
      'for answering. Two a week. It is the only paperwork this app will ever ask you for.',
    art: () => <FuelIllustration />,
  },
  {
    key: 'route',
    icon: 'pin',
    eyebrow: 'WHERE WE RUN',
    title: 'Palava to Dombivli East',
    body:
      'One route, run properly, before we add a second. 6.5 km by road, about twenty minutes, ' +
      'roughly eight thousand people making it twice a day with no bus. If it works here it works ' +
      'on forty corridors like it.',
    art: () => <CorridorMap height={170} vehicle={{ progress: 0.55 }} distanceKm={6.5} />,
  },
];

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const last = index === SLIDES.length - 1;

  function finish() {
    void markWalkthroughSeen();
    // dismissAll so the walkthrough can be opened as a modal from Home without
    // leaving a stack of slides behind it.
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  }

  function next() {
    if (last) return finish();
    const to = index + 1;
    setIndex(to);
    scroller.current?.scrollTo({ x: to * width, animated: true });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== index) setIndex(page);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Skip, available from slide one. */}
      <Row justify="flex-end" style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel="Skip the walkthrough"
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: space.sm })}
        >
          <T variant="caption" color={colors.textMuted}>
            Skip
          </T>
        </Pressable>
      </Row>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flexGrow: 0 }}
      >
        {SLIDES.map((slide) => (
          <ScrollView
            key={slide.key}
            style={{ width }}
            contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl }}
          >
            <Stack gap={space.lg}>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md }}>
                {slide.art()}
              </View>

              <Row gap={space.sm}>
                <Icon name={slide.icon} size="sm" color={colors.textMuted} />
                <T variant="caption" color={colors.textMuted}>
                  {slide.eyebrow}
                </T>
              </Row>

              <T variant="display">{slide.title}</T>

              <T variant="body" color={colors.textMuted}>
                {slide.body}
              </T>
            </Stack>
          </ScrollView>
        ))}
      </ScrollView>

      {/* Footer: dots and the one action. */}
      <View style={{ padding: space.lg, gap: space.md }}>
        <View
          accessible
          accessibilityLabel={`Screen ${index + 1} of ${SLIDES.length}`}
          style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}
        >
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? colors.text : colors.border,
              }}
            />
          ))}
        </View>

        <Button
          label={last ? 'Start riding' : 'Next'}
          onPress={next}
          hint={last ? undefined : `${SLIDES.length - index - 1} more`}
        />
      </View>
    </View>
  );
}
