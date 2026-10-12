import type { SQLiteDatabase } from 'expo-sqlite';

import { getSettings } from '@/db/settings';
import { sendReport, telegramReady } from '@/features/integrations/lib/deliver';
import { insertReport, listSchedules, markScheduleRun } from '@/features/reports/db/reports';
import { buildReport, reportText, type ReportKind } from '@/features/reports/lib/build';
import { attachPdf } from '@/features/reports/lib/pdf';
import { latestRun, periodFor, periodKey } from '@/features/reports/lib/schedule';
import { notifyReportReady } from '@/lib/notifications';

export async function generateReport(
  db: SQLiteDatabase,
  kind: ReportKind,
  start: string,
  end: string,
  { scheduleId = null, withPdf = true }: { scheduleId?: number | null; withPdf?: boolean } = {},
) {
  const data = await buildReport(db, kind, start, end);
  const id = await insertReport(db, { schedule_id: scheduleId, kind, period_start: start, period_end: end, title: data.title, text: reportText(data) });
  if (withPdf) await attachPdf(db, id, kind, start, end).catch(() => {});
  return id;
}

let running = false;

/** Generates every scheduled report whose latest run has not been produced yet (no backfill of older ones). */
export async function runDueReports(db: SQLiteDatabase) {
  if (running) return 0;
  running = true;
  let generated = 0;
  try {
    const now = new Date();
    for (const schedule of await listSchedules(db)) {
      if (!schedule.active) continue;
      const period = periodFor(schedule, latestRun(schedule, now));
      const key = periodKey(period);
      if (schedule.last_period === key) continue;
      const id = await generateReport(db, schedule.kind, period.start, period.end, { scheduleId: schedule.id, withPdf: schedule.format === 'pdf' });
      await markScheduleRun(db, schedule.id, key);
      const report = await db.getFirstAsync<{ title: string }>('SELECT title FROM reports WHERE id = ?', id);
      await notifyReportReady(db, report?.title ?? 'Reporte', id).catch(() => {});
      const settings = await getSettings(db);
      if (settings.telegramSendReports && telegramReady(settings)) await sendReport(db, id, { asPdf: schedule.format === 'pdf' });
      generated++;
    }
  } finally {
    running = false;
  }
  return generated;
}
