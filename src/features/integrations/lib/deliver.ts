import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSettings, saveSettings, type Settings } from '@/db/settings';
import { attentionCount, computeAttention } from '@/features/alerts/lib/attention';
import { createDelivery, listRetryable, markDelivery, type DeliveryKind } from '@/features/integrations/db/deliveries';
import { sendFile, sendText } from '@/features/integrations/lib/telegram';
import { fullName } from '@/features/members/db/members';
import { getReport } from '@/features/reports/db/reports';
import { attachPdf } from '@/features/reports/lib/pdf';
import { formatDay, money, todayIso } from '@/lib/format';

const MAX_ATTEMPTS = 4;

export function telegramReady(s: Settings) {
  return !!s.telegramToken && !!s.telegramChatId;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** Logs every send in `deliveries`, so failures show up in Integraciones and can be retried. */
async function tracked(db: SQLiteDatabase, kind: DeliveryKind, refId: number | null, title: string, send: (s: Settings) => Promise<unknown>, existingId?: number): Promise<SendResult> {
  const settings = await getSettings(db);
  const id = existingId ?? (await createDelivery(db, kind, refId, title));
  if (!telegramReady(settings)) {
    await markDelivery(db, id, 'Telegram no está configurado');
    return { ok: false, error: 'Telegram no está configurado. El administrador puede conectarlo en Más → Integraciones.' };
  }
  try {
    await send(settings);
    await markDelivery(db, id, null);
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await markDelivery(db, id, error);
    return { ok: false, error };
  }
}

export function sendTestMessage(db: SQLiteDatabase) {
  return tracked(db, 'test', null, 'Mensaje de prueba', (s) =>
    sendText(s.telegramToken, s.telegramChatId, `✅ ${s.storeName} quedó conectado. Aquí llegarán los reportes, boletas y avisos.`),
  );
}

/** Sends a report as PDF (created on the fly if missing) or as text; retries reuse whatever was generated. */
export async function sendReport(db: SQLiteDatabase, reportId: number, { asPdf, deliveryId }: { asPdf?: boolean; deliveryId?: number } = {}) {
  const report = await getReport(db, reportId);
  if (!report) return { ok: false, error: 'El reporte ya no existe.' } as SendResult;
  const withPdf = asPdf ?? !!report.pdf_uri;
  return tracked(
    db,
    'report',
    reportId,
    report.title,
    async (s) => {
      if (!withPdf) return sendText(s.telegramToken, s.telegramChatId, report.text);
      const existing = report.pdf_uri && new File(report.pdf_uri).exists ? report.pdf_uri : null;
      const uri = existing ?? (await attachPdf(db, report.id, report.kind, report.period_start, report.period_end));
      return sendFile(s.telegramToken, s.telegramChatId, uri, 'document', report.text);
    },
    deliveryId,
  );
}

/** Receipts are sent as the same image that is shared by WhatsApp. */
export function sendReceiptImage(db: SQLiteDatabase, kind: 'receipt' | 'sale', refId: number, title: string, uri: string, caption: string) {
  return tracked(db, kind, refId, title, (s) => sendFile(s.telegramToken, s.telegramChatId, uri, 'photo', caption));
}

export async function summaryText(db: SQLiteDatabase, settings: Settings) {
  const a = await computeAttention(db, settings);
  const lines = [`🔔 ${settings.storeName} · ${formatDay(todayIso())}`];
  if (attentionCount(a) === 0) return [...lines, '', 'Todo al día: sin membresías por vencer, deudas ni alertas del almacén.'].join('\n');
  const names = (list: { first_name: string; last_name: string }[]) =>
    list.slice(0, 5).map(fullName).join(', ') + (list.length > 5 ? ` y ${list.length - 5} más` : '');
  if (a.expiring.length) lines.push('', `⏳ Por vencer (${a.expiring.length}): ${names(a.expiring)}`);
  if (a.expired.length) lines.push('', `⛔ Vencidas (${a.expired.length}): ${names(a.expired)}`);
  if (a.debts.length) {
    const total = a.debts.reduce((sum, m) => sum + m.debt, 0);
    lines.push('', `💸 Deudas (${a.debts.length}, ${money(total)}): ${names(a.debts)}`);
  }
  const low = a.store.lowStock.length + a.store.outOfStock.length;
  const exp = a.store.expiring.length + a.store.expired.length;
  if (low || exp) lines.push('', `📦 Tienda: ${low} con poco stock, ${exp} productos por vencer`);
  return lines.join('\n');
}

export function sendSummary(db: SQLiteDatabase, deliveryId?: number) {
  return tracked(
    db,
    'summary',
    null,
    'Resumen diario',
    async (s) => sendText(s.telegramToken, s.telegramChatId, await summaryText(db, s)),
    deliveryId,
  );
}

let running = false;

/** Daily summary at the configured hour, plus retries of failed reports and summaries. */
export async function runDueDeliveries(db: SQLiteDatabase) {
  if (running) return;
  running = true;
  try {
    const settings = await getSettings(db);
    if (!telegramReady(settings)) return;
    const today = todayIso();
    if (settings.telegramDailySummary && settings.telegramLastSummary !== today && new Date().getHours() >= settings.notifyHour) {
      await saveSettings(db, { telegramLastSummary: today });
      await sendSummary(db);
    }
    for (const d of await listRetryable(db, MAX_ATTEMPTS)) {
      if (d.kind === 'report' && d.ref_id) await sendReport(db, d.ref_id, { deliveryId: d.id });
      else if (d.kind === 'summary') await sendSummary(db, d.id);
    }
  } finally {
    running = false;
  }
}
