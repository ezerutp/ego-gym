import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Button, Pill } from '@/components/ui';
import { session, useSession } from '@/features/auth/lib/session';
import { markTourSeen, measureTarget, registerAnchor, targetScroller, tour, useActiveTour, type ActiveTour, type Rect } from '@/features/tour/lib/tour';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const PAD = 8;
const GAP = 16;
const MARGIN = 16;
const CARD_MAX = 400;
const ARROW = 14;
const CORNER = 18;
/** Wider than any screen: the spotlight is a view whose huge border is the dark shade around the hole. */
const SHADE = 3000;
/** Room the card needs next to the highlight (its usual height plus the gap). */
const CARD_SPACE = 250;
/** Where a scrolled-in target ends up, as a fraction of the screen height from the top. */
const TARGET_TOP = 0.15;
const SCROLL_SETTLE_MS = 400;
/** Scrollable content near the edges may sit under the header or the bottom tab bar. */
const EDGE = 90;
const MOVE_MS = 320;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ease = Easing.out(Easing.cubic);

/** Measures a target; if it is off screen or leaves no room for the card, scrolls it up first and measures again. */
async function locate(id: string, height: number) {
  const r = await measureTarget(id);
  const scroller = targetScroller(id);
  if (!r || !scroller) return r;
  const offscreen = r.y < EDGE / 2 || r.y + r.height > height - EDGE;
  const fitsBelow = height - (r.y + r.height + PAD) >= CARD_SPACE;
  const fitsAbove = r.y - PAD >= CARD_SPACE;
  if (!offscreen && (fitsBelow || fitsAbove)) return r;
  scroller.scrollBy(r.y - height * TARGET_TOP);
  await sleep(SCROLL_SETTLE_MS);
  return measureTarget(id);
}

type Layout = { hole: Rect & { radius: number }; below: boolean };

/**
 * Where the highlight and the card go. Round buttons get a round hole, the rest soft corners.
 * When the card fits neither above nor below (a target taller than the screen), only the top
 * of the target is highlighted so the card can sit right under it without covering it.
 */
function layoutFor(r: Rect, height: number): Layout {
  const hole = { x: r.x - PAD, y: r.y - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
  const fitsBelow = height - (hole.y + hole.height) >= CARD_SPACE;
  const fitsAbove = hole.y >= CARD_SPACE;
  if (!fitsBelow && !fitsAbove) hole.height = Math.max(height - CARD_SPACE - hole.y, 48);
  const round = Math.abs(r.width - r.height) < 8;
  return { hole: { ...hole, radius: round ? hole.width / 2 : Math.min(CORNER, hole.height / 2) }, below: fitsBelow || !fitsAbove };
}

type Spot = { x: Animated.Value; y: Animated.Value; w: Animated.Value; h: Animated.Value; r: Animated.Value };

/** Dims the screen around the current step's target, glides between steps and explains each one in a card. */
export function TourOverlay() {
  const active = useActiveTour();
  const user = useSession();
  const db = useSQLiteContext();
  const anchor = useRef<View>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const [measured, setMeasured] = useState<{ key: string; rect: Rect } | null>(null);
  const [fade] = useState(() => new Animated.Value(0));
  const [card] = useState(() => new Animated.Value(0));
  const [spot] = useState<Spot>(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    w: new Animated.Value(0),
    h: new Animated.Value(0),
    r: new Animated.Value(0),
  }));
  const key = active ? `${active.id}:${active.index}:${width}x${height}` : '';
  const rect = measured?.key === key ? measured.rect : null;
  const shown = !!active && !!measured && measured.key.startsWith(`${active.id}:`);

  const finish = useCallback(
    (t: ActiveTour) => {
      const id = session.get()?.id;
      if (id) markTourSeen(db, id, t.id).catch(() => {});
      Animated.timing(fade, { toValue: 0, duration: 200, easing: ease, useNativeDriver: false }).start(() => {
        setMeasured(null);
        tour.stop();
      });
    },
    [db, fade],
  );

  useEffect(() => registerAnchor(anchor), []);

  useEffect(() => {
    if (active && !user) tour.stop();
  }, [active, user]);

  useEffect(() => {
    if (!active || !height) return;
    let cancelled = false;
    Animated.timing(card, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    locate(active.steps[active.index].target, height).then((r) => {
      if (cancelled) return;
      if (!r) {
        // The target is not on screen for this layout or role: move on.
        if (!tour.next()) finish(active);
        return;
      }
      const { hole } = layoutFor(r, height);
      const values = { x: hole.x, y: hole.y, w: hole.width, h: hole.height, r: hole.radius };
      const first = !shown;
      if (first) {
        (Object.keys(values) as (keyof Spot)[]).forEach((k) => spot[k].setValue(values[k]));
        Animated.timing(fade, { toValue: 1, duration: 260, easing: ease, useNativeDriver: false }).start();
      } else {
        Animated.parallel(
          (Object.keys(values) as (keyof Spot)[]).map((k) =>
            Animated.timing(spot[k], { toValue: values[k], duration: MOVE_MS, easing: ease, useNativeDriver: false }),
          ),
        ).start();
      }
      setMeasured({ key, rect: r });
      Animated.timing(card, { toValue: 1, duration: 220, delay: first ? 120 : MOVE_MS - 60, easing: ease, useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
    // `shown` only decides between appearing and gliding; it must not restart the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, height, fade, card, spot, finish]);

  return (
    <>
      {/* Always mounted, so targets can be measured against the overlay before the first step shows. */}
      <View
        ref={anchor}
        collapsable={false}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      />
      {active && shown && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Spotlight spot={spot} />
          {rect && (
            <Card
              active={active}
              layout={layoutFor(rect, height)}
              width={width}
              height={height}
              progress={card}
              onNext={() => {
                if (!tour.next()) finish(active);
              }}
              onSkip={() => finish(active)}
            />
          )}
        </Animated.View>
      )}
    </>
  );
}

/** One view whose enormous border is the shade: its inner edge is the rounded hole, and it also blocks touches. */
function Spotlight({ spot }: { spot: Spot }) {
  const styles = useStyles();
  return (
    <>
      <Animated.View
        style={[
          styles.shade,
          {
            left: Animated.subtract(spot.x, SHADE),
            top: Animated.subtract(spot.y, SHADE),
            width: Animated.add(spot.w, SHADE * 2),
            height: Animated.add(spot.h, SHADE * 2),
            borderRadius: Animated.add(spot.r, SHADE),
          },
        ]}
      />
      <Animated.View pointerEvents="none" style={[styles.ring, { left: spot.x, top: spot.y, width: spot.w, height: spot.h, borderRadius: spot.r }]} />
    </>
  );
}

type CardProps = {
  active: ActiveTour;
  layout: Layout;
  width: number;
  height: number;
  progress: Animated.Value;
  onNext: () => void;
  onSkip: () => void;
};

function Card({ active, layout, width, height, progress, onNext, onSkip }: CardProps) {
  const { hole, below } = layout;
  const styles = useStyles();
  const { font } = useTheme();
  const step = active.steps[active.index];
  const last = active.index === active.steps.length - 1;
  const cardWidth = Math.min(CARD_MAX, width - MARGIN * 2);
  const center = hole.x + hole.width / 2;
  const left = Math.min(Math.max(center - cardWidth / 2, MARGIN), width - cardWidth - MARGIN);
  const position = below ? { top: hole.y + hole.height + GAP } : { bottom: height - hole.y + GAP };
  const arrowLeft = Math.min(Math.max(center - left - ARROW / 2, radius.lg), cardWidth - radius.lg - ARROW);
  const shift = progress.interpolate({ inputRange: [0, 1], outputRange: [below ? 10 : -10, 0] });

  return (
    <Animated.View style={[styles.card, { width: cardWidth, left, opacity: progress, transform: [{ translateY: shift }] }, position]}>
      <View style={[styles.arrow, { left: arrowLeft }, below ? { top: -ARROW / 2 } : { bottom: -ARROW / 2 }]} />
      <View style={styles.header}>
        <Pill label={`Paso ${active.index + 1} de ${active.steps.length}`} tone="success" />
        <View style={styles.dots}>
          {active.steps.map((s, i) => (
            <View key={s.target} style={[styles.dot, i === active.index && styles.dotActive]} />
          ))}
        </View>
      </View>
      <Text style={font.h2}>{step.title}</Text>
      <Text style={font.body}>{step.text}</Text>
      <View style={styles.actions}>
        <Button title="Saltar guía" variant="ghost" onPress={onSkip} style={styles.skip} />
        <View style={{ flex: 1 }} />
        {active.index > 0 && <Button title="Atrás" variant="secondary" onPress={tour.back} style={styles.action} />}
        <Button title={last ? '¡Listo!' : 'Siguiente'} icon={last ? 'checkmark' : 'arrow-forward'} onPress={onNext} style={styles.action} />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    shade: { position: 'absolute', borderWidth: SHADE, borderColor: colors.overlay },
    ring: { position: 'absolute', borderWidth: 2, borderColor: colors.primary },
    card: { position: 'absolute', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...shadow, elevation: 16 },
    arrow: { position: 'absolute', width: ARROW, height: ARROW, backgroundColor: colors.surface, transform: [{ rotate: '45deg' }] },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dots: { flexDirection: 'row', gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    dotActive: { width: 16, backgroundColor: colors.primary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    skip: { minHeight: 44, paddingHorizontal: 0 },
    action: { minHeight: 44 },
  }),
);
