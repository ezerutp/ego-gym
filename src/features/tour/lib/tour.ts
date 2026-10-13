import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore, type RefObject } from 'react';
import type { View } from 'react-native';

import { getSettings, saveSettings } from '@/db/settings';
import type { Role } from '@/features/auth/db/users';
import { TOURS, type TourId, type TourStep } from '@/features/tour/lib/tours';

export type ActiveTour = { id: TourId; steps: TourStep[]; index: number };
export type Rect = { x: number; y: number; width: number; height: number };
/** Lets the tour scroll the screen that contains a target, so steps far down can be shown. */
export type Scroller = { scrollBy: (dy: number) => void };

type Target = { ref: RefObject<View | null>; scroller: Scroller | null };

const targets = new Map<string, Target>();
/** A view that fills the tour overlay; targets are measured against it, not against the window. */
let anchor: RefObject<View | null> | null = null;

export function registerAnchor(ref: RefObject<View | null>) {
  anchor = ref;
  return () => {
    if (anchor === ref) anchor = null;
  };
}
let active: ActiveTour | null = null;
const listeners = new Set<() => void>();

function emit(next: ActiveTour | null) {
  active = next;
  listeners.forEach((l) => l());
}

export function registerTarget(id: string, ref: RefObject<View | null>, scroller: Scroller | null) {
  const target = { ref, scroller };
  targets.set(id, target);
  return () => {
    if (targets.get(id) === target) targets.delete(id);
  };
}

export function targetScroller(id: string) {
  return targets.get(id)?.scroller ?? null;
}

function windowRect(view: View) {
  return new Promise<Rect>((resolve) => view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));
}

/**
 * Position of a registered target inside the tour overlay, or null when it is not on screen.
 * Both views are measured the same way and subtracted: on Android, window coordinates can be
 * shifted by the status bar, which left every highlight a few dozen pixels too high.
 */
export async function measureTarget(id: string) {
  const view = targets.get(id)?.ref.current;
  const base = anchor?.current;
  if (!view || !base) return null;
  const [r, a] = await Promise.all([windowRect(view), windowRect(base)]);
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: r.x - a.x, y: r.y - a.y, width: r.width, height: r.height };
}

export const tour = {
  get: () => active,
  start(id: TourId, role: Role) {
    const steps = TOURS[id].filter((s) => !s.role || s.role === role);
    if (steps.length) emit({ id, steps, index: 0 });
  },
  /** Returns false when there was no next step (the tour ended). */
  next() {
    if (!active) return false;
    if (active.index >= active.steps.length - 1) {
      emit(null);
      return false;
    }
    emit({ ...active, index: active.index + 1 });
    return true;
  },
  back() {
    if (active && active.index > 0) emit({ ...active, index: active.index - 1 });
  },
  stop: () => emit(null),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useActiveTour() {
  return useSyncExternalStore(tour.subscribe, tour.get);
}

/** Tours are remembered per user: the tablet is shared, so each person gets their own walkthrough. */
export async function hasSeenTour(db: SQLiteDatabase, userId: number, id: TourId) {
  const { toursSeen } = await getSettings(db);
  return toursSeen[userId]?.includes(id) ?? false;
}

export async function markTourSeen(db: SQLiteDatabase, userId: number, id: TourId) {
  const { toursSeen } = await getSettings(db);
  const seen = new Set(toursSeen[userId] ?? []);
  seen.add(id);
  await saveSettings(db, { toursSeen: { ...toursSeen, [userId]: [...seen] } });
}

export async function resetTours(db: SQLiteDatabase, userId: number) {
  const { toursSeen } = await getSettings(db);
  await saveSettings(db, { toursSeen: { ...toursSeen, [userId]: [] } });
}
