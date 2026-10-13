import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { session } from '@/features/auth/lib/session';
import { hasSeenTour, tour } from '@/features/tour/lib/tour';
import type { TourId } from '@/features/tour/lib/tours';

/** Waits for the screen to settle so targets have their final position before measuring. */
const START_DELAY_MS = 700;

/** Starts a screen's tour the first time each user opens it. */
export function useAutoTour(id: TourId) {
  const db = useSQLiteContext();
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const timer = setTimeout(async () => {
        const user = session.get();
        if (cancelled || !user || tour.get()) return;
        if (await hasSeenTour(db, user.id, id)) return;
        if (!cancelled && !tour.get()) tour.start(id, user.role);
      }, START_DELAY_MS);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [db, id]),
  );
}
