import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button, Pill } from '@/components/ui';
import { session, useSession } from '@/features/auth/lib/session';
import { markTourSeen, measureTarget, tour, useActiveTour, type ActiveTour, type Rect } from '@/features/tour/lib/tour';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const PAD = 8;
const GAP = 14;
const MARGIN = 16;
const CARD_MAX = 400;
/** Below this much free space under the target, the card goes above it. */
const MIN_SPACE_BELOW = 240;

/** Dims the screen around the current step's target and explains it in a card. */
export function TourOverlay() {
  const active = useActiveTour();
  const user = useSession();
  const db = useSQLiteContext();
  const { width, height } = useWindowDimensions();
  const [measured, setMeasured] = useState<{ key: string; rect: Rect } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const key = active ? `${active.id}:${active.index}:${width}x${height}` : '';
  const rect = measured?.key === key ? measured.rect : null;

  const finish = useCallback(
    (t: ActiveTour) => {
      tour.stop();
      const id = session.get()?.id;
      if (id) markTourSeen(db, id, t.id).catch(() => {});
    },
    [db],
  );

  useEffect(() => {
    if (active && !user) tour.stop();
  }, [active, user]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    opacity.setValue(0);
    measureTarget(active.steps[active.index].target).then((r) => {
      if (cancelled) return;
      if (!r) {
        // The target is not on screen for this layout or role: move on.
        if (!tour.next()) finish(active);
        return;
      }
      setMeasured({ key, rect: r });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [active, key, opacity, finish]);

  if (!active || !rect) return null;
  return <TourStepView active={active} rect={rect} width={width} height={height} opacity={opacity} onFinish={finish} />;
}

type StepViewProps = { active: ActiveTour; rect: Rect; width: number; height: number; opacity: Animated.Value; onFinish: (t: ActiveTour) => void };

function TourStepView({ active, rect, width, height, opacity, onFinish: finish }: StepViewProps) {
  const styles = useStyles();
  const step = active.steps[active.index];
  const last = active.index === active.steps.length - 1;
  const hole = { x: rect.x - PAD, y: rect.y - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <Shade hole={hole} width={width} height={height} />
      <View pointerEvents="none" style={[styles.ring, { left: hole.x, top: hole.y, width: hole.width, height: hole.height }]} />
      <Card
        hole={hole}
        width={width}
        height={height}
        step={active.index + 1}
        total={active.steps.length}
        title={step.title}
        text={step.text}
        last={last}
        onBack={active.index > 0 ? tour.back : undefined}
        onNext={() => {
          if (!tour.next()) finish(active);
        }}
        onSkip={() => finish(active)}
      />
    </Animated.View>
  );
}

/** Four dark panels around the hole; together they block touches everywhere except the highlight. */
function Shade({ hole, width, height }: { hole: Rect; width: number; height: number }) {
  const { colors } = useTheme();
  const shade = { position: 'absolute' as const, backgroundColor: colors.overlay };
  const bottom = hole.y + hole.height;
  const right = hole.x + hole.width;
  return (
    <>
      <View style={[shade, { left: 0, top: 0, width, height: Math.max(hole.y, 0) }]} />
      <View style={[shade, { left: 0, top: bottom, width, height: Math.max(height - bottom, 0) }]} />
      <View style={[shade, { left: 0, top: hole.y, width: Math.max(hole.x, 0), height: hole.height }]} />
      <View style={[shade, { left: right, top: hole.y, width: Math.max(width - right, 0), height: hole.height }]} />
      {/* Taps on the highlighted element itself are swallowed too, so the tour cannot be left half way. */}
      <View style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.width, height: hole.height }} />
    </>
  );
}

type CardProps = {
  hole: Rect;
  width: number;
  height: number;
  step: number;
  total: number;
  title: string;
  text: string;
  last: boolean;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
};

function Card({ hole, width, height, step, total, title, text, last, onBack, onNext, onSkip }: CardProps) {
  const styles = useStyles();
  const { font } = useTheme();
  const cardWidth = Math.min(CARD_MAX, width - MARGIN * 2);
  const center = hole.x + hole.width / 2;
  const left = Math.min(Math.max(center - cardWidth / 2, MARGIN), width - cardWidth - MARGIN);
  const below = height - (hole.y + hole.height) >= MIN_SPACE_BELOW || hole.y < MIN_SPACE_BELOW;
  const position = below ? { top: Math.min(hole.y + hole.height + GAP, height - MIN_SPACE_BELOW) } : { bottom: height - hole.y + GAP };

  return (
    <View style={[styles.card, { width: cardWidth, left }, position]}>
      <Pill label={`Paso ${step} de ${total}`} tone="success" />
      <Text style={font.h2}>{title}</Text>
      <Text style={font.body}>{text}</Text>
      <View style={styles.actions}>
        <Button title="Saltar guía" variant="ghost" onPress={onSkip} style={styles.skip} />
        <View style={{ flex: 1 }} />
        {onBack && <Button title="Atrás" variant="secondary" onPress={onBack} style={styles.action} />}
        <Button title={last ? '¡Listo!' : 'Siguiente'} icon={last ? 'checkmark' : 'arrow-forward'} onPress={onNext} style={styles.action} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    ring: { position: 'absolute', borderRadius: radius.md, borderWidth: 3, borderColor: colors.white },
    card: { position: 'absolute', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...shadow, elevation: 16 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    skip: { minHeight: 44, paddingHorizontal: 0 },
    action: { minHeight: 44 },
  }),
);
