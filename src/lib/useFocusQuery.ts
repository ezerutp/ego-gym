import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Re-runs the query every time the screen gains focus (so data edited elsewhere is fresh)
 * and whenever `deps` change. Late responses from an outdated query are ignored.
 */
export function useFocusQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, deps: unknown[] = []) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);
  const queryRef = useRef(query);
  const requestId = useRef(0);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    queryRef.current = query;
  });

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    const result = await queryRef.current(db);
    if (id === requestId.current) setData(result);
    // depsKey is listed so a change in deps produces a new callback and refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, depsKey]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, reload };
}
