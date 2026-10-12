import type { SQLiteDatabase } from 'expo-sqlite';

export type DeliveryKind = 'test' | 'report' | 'receipt' | 'sale' | 'summary';
export type DeliveryStatus = 'pending' | 'sent' | 'failed';

export type Delivery = {
  id: number;
  kind: DeliveryKind;
  ref_id: number | null;
  title: string;
  status: DeliveryStatus;
  error: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
};

export const DELIVERY_KINDS: Record<DeliveryKind, string> = {
  test: 'Prueba',
  report: 'Reporte',
  receipt: 'Boleta de membresía',
  sale: 'Boleta de venta',
  summary: 'Resumen diario',
};

export async function createDelivery(db: SQLiteDatabase, kind: DeliveryKind, refId: number | null, title: string) {
  const result = await db.runAsync('INSERT INTO deliveries (kind, ref_id, title) VALUES (?, ?, ?)', kind, refId, title);
  return result.lastInsertRowId;
}

export async function markDelivery(db: SQLiteDatabase, id: number, error: string | null) {
  if (error) {
    await db.runAsync("UPDATE deliveries SET status = 'failed', error = ?, attempts = attempts + 1 WHERE id = ?", error, id);
  } else {
    await db.runAsync("UPDATE deliveries SET status = 'sent', error = NULL, attempts = attempts + 1, sent_at = datetime('now') WHERE id = ?", id);
  }
}

export function listDeliveries(db: SQLiteDatabase, limit = 20) {
  return db.getAllAsync<Delivery>('SELECT * FROM deliveries ORDER BY id DESC LIMIT ?', limit);
}

/** Failed reports and summaries can be rebuilt and sent again; receipts are images captured on screen, so they cannot. */
export function listRetryable(db: SQLiteDatabase, maxAttempts: number) {
  return db.getAllAsync<Delivery>(
    `SELECT * FROM deliveries WHERE status != 'sent' AND kind IN ('report', 'summary') AND attempts < ?
     AND created_at >= datetime('now', '-3 days') ORDER BY id`,
    maxAttempts,
  );
}
