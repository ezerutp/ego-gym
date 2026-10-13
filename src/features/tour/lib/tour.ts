import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore, type RefObject } from 'react';
import type { View } from 'react-native';

import { getSettings, saveSettings } from '@/db/settings';
import type { Role } from '@/features/auth/db/users';
import { TOURS, type TourId, type TourStep } from '@/features/tour/lib/tours';

export type ActiveTour = { id: TourId; steps: TourStep[]; index: number };
export type Rect = { x: number; y: number; width: number; height: number };

const targets = new Map<string, RefObject<View | null>>();
let active: ActiveTour | null = null;
const listeners = new Set<() => void>();

function emit(next: ActiveTour | null) {
  active = next;
  listeners.forEach((l) => l());
}

export function registerTarget(id: string, ref: RefObject<View | null>) {
  targets.set(id, ref);
  return () => {
    if (targets.get(id) === ref) targets.delete(id);
  };
}

/** Window coordinates of a registered target, or null when it is not on screen. */
export function measureTarget(id: string) {
  const view = targets.get(id)?.current;
  if (!view) return Promise.resolve(null);
  return new Promise<Rect | null>((resolve) => {
    view.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
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
