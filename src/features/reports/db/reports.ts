import type { SQLiteDatabase } from 'expo-sqlite';

import type { ReportKind } from '@/features/reports/lib/build';

export type Frequency = 'daily' | 'weekly' | 'monthly';
export type ReportFormat = 'pdf' | 'text';

export type ReportSchedule = {
  id: number;
  kind: ReportKind;
  frequency: Frequency;
  /** 0 = domingo … 6 = sábado, for weekly schedules. */
  weekday: number | null;
  /** 1–28, for monthly schedules. */
  month_day: number | null;
  hour: number;
  format: ReportFormat;
  active: number;
  last_period: string | null;
};

export type ScheduleInput = Omit<ReportSchedule, 'id' | 'active' | 'last_period'> & { active: boolean };

export type Report = {
  id: number;
  schedule_id: number | null;
  kind: ReportKind;
  period_start: string;
  period_end: string;
  title: string;
  text: string;
  pdf_uri: string | null;
  created_at: string;
};

export function listSchedules(db: SQLiteDatabase) {
  return db.getAllAsync<ReportSchedule>('SELECT * FROM report_schedules ORDER BY active DESC, id');
}

export function getSchedule(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ReportSchedule>('SELECT * FROM report_schedules WHERE id = ?', id);
}

export async function saveSchedule(db: SQLiteDatabase, id: number | null, input: ScheduleInput) {
  const values = [input.kind, input.frequency, input.weekday, input.month_day, input.hour, input.format, input.active ? 1 : 0];
  if (id) {
    // A changed schedule should not count its old period as already sent.
    await db.runAsync(
      'UPDATE report_schedules SET kind = ?, frequency = ?, weekday = ?, month_day = ?, hour = ?, format = ?, active = ?, last_period = NULL WHERE id = ?',
      ...values,
      id,
    );
    return id;
  }
  const result = await db.runAsync(
    'INSERT INTO report_schedules (kind, frequency, weekday, month_day, hour, format, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ...values,
  );
  return result.lastInsertRowId;
}

export async function deleteSchedule(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM report_schedules WHERE id = ?', id);
}

export async function markScheduleRun(db: SQLiteDatabase, id: number, periodKey: string) {
  await db.runAsync('UPDATE report_schedules SET last_period = ? WHERE id = ?', periodKey, id);
}

export async function insertReport(db: SQLiteDatabase, r: Omit<Report, 'id' | 'created_at' | 'pdf_uri'>) {
  const result = await db.runAsync(
    'INSERT INTO reports (schedule_id, kind, period_start, period_end, title, text) VALUES (?, ?, ?, ?, ?, ?)',
    r.schedule_id,
    r.kind,
    r.period_start,
    r.period_end,
    r.title,
    r.text,
  );
  return result.lastInsertRowId;
}

export async function setReportPdf(db: SQLiteDatabase, id: number, pdfUri: string) {
  await db.runAsync('UPDATE reports SET pdf_uri = ? WHERE id = ?', pdfUri, id);
}

export function listReports(db: SQLiteDatabase, limit = 30) {
  return db.getAllAsync<Report>('SELECT * FROM reports ORDER BY id DESC LIMIT ?', limit);
}

export function getReport(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Report>('SELECT * FROM reports WHERE id = ?', id);
}

export async function deleteReport(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM reports WHERE id = ?', id);
}
