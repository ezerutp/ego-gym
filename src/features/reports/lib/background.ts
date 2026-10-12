import * as BackgroundTask from 'expo-background-task';
import * as SQLite from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';

import { DATABASE_NAME, migrateDb } from '@/db/schema';
import { runDueReports } from '@/features/reports/lib/runner';

const REPORTS_TASK = 'ego-gym-reports';

// Must be defined at module load, before the app renders, so Android can run it with the app closed.
TaskManager.defineTask(REPORTS_TASK, async () => {
  try {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await migrateDb(db);
    await runDueReports(db);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Asks Android to wake the app about every 15 minutes; the OS decides the real timing. */
export async function registerReportsTask() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(REPORTS_TASK)) return;
    await BackgroundTask.registerTaskAsync(REPORTS_TASK, { minimumInterval: 15 });
  } catch {
    // Not available in Expo Go: reports are still generated whenever the app is opened.
  }
}
