import type { SQLiteDatabase } from 'expo-sqlite';

export type PaymentMethod = 'cash' | 'yape' | 'card' | 'transfer';

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  yape: 'Yape / Plin',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

export type Payment = {
  id: number;
  subscription_id: number;
  member_id: number;
  amount: number;
  method: PaymentMethod;
  notes: string | null;
  created_at: string;
  user_name: string | null;
};

export type PaymentInput = { subscriptionId: number; memberId: number; amount: number; method: PaymentMethod; notes?: string | null };

/** Plan price plus its add-ons (the personal training). Expects the subscription aliased as `s`. */
export const SUBSCRIPTION_TOTAL_SQL = `(s.price + IFNULL((SELECT SUM(a.price) FROM subscription_addons a WHERE a.subscription_id = s.id), 0))`;
export const SUBSCRIPTION_PAID_SQL = `IFNULL((SELECT SUM(p.amount) FROM payments p WHERE p.subscription_id = s.id), 0)`;

export function paymentReceiptNumber(id: number) {
  return `M001-${String(id).padStart(6, '0')}`;
}

/** Inserts without its own transaction, so it can run inside the enrollment transaction. */
export async function insertPayment(db: SQLiteDatabase, input: PaymentInput, userId: number | null) {
  const result = await db.runAsync(
    'INSERT INTO payments (subscription_id, member_id, amount, method, notes, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    input.subscriptionId,
    input.memberId,
    Math.round(input.amount * 100) / 100,
    input.method,
    input.notes?.trim() || null,
    userId,
  );
  return result.lastInsertRowId;
}

export function listSubscriptionPayments(db: SQLiteDatabase, subscriptionId: number) {
  return db.getAllAsync<Payment>(
    `SELECT p.*, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id = p.user_id
     WHERE p.subscription_id = ? ORDER BY p.id`,
    subscriptionId,
  );
}

export function listMemberPayments(db: SQLiteDatabase, memberId: number) {
  return db.getAllAsync<Payment & { plan_name: string }>(
    `SELECT p.*, u.name AS user_name, s.plan_name FROM payments p
     JOIN subscriptions s ON s.id = p.subscription_id
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.member_id = ? ORDER BY p.id DESC`,
    memberId,
  );
}

export async function deletePayment(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM payments WHERE id = ?', id);
}

export async function getSubscriptionBalance(db: SQLiteDatabase, subscriptionId: number) {
  const row = await db.getFirstAsync<{ total: number; paid: number }>(
    `SELECT ${SUBSCRIPTION_TOTAL_SQL} AS total, ${SUBSCRIPTION_PAID_SQL} AS paid FROM subscriptions s WHERE s.id = ?`,
    subscriptionId,
  );
  const total = row?.total ?? 0;
  const paid = row?.paid ?? 0;
  return { total, paid, due: Math.max(round2(total - paid), 0) };
}

/** The oldest subscription of a member that still has something to pay. */
export function getOldestDueSubscription(db: SQLiteDatabase, memberId: number) {
  return db.getFirstAsync<{ id: number }>(
    `SELECT s.id FROM subscriptions s
     WHERE s.member_id = ? AND ${SUBSCRIPTION_TOTAL_SQL} - ${SUBSCRIPTION_PAID_SQL} > 0.009
     ORDER BY s.start_date, s.id LIMIT 1`,
    memberId,
  );
}

export type PaymentReceipt = Payment & {
  member_name: string;
  member_dni: string | null;
  member_phone: string | null;
  plan_name: string;
  start_date: string;
  end_date: string;
  plan_price: number;
  personal_price: number | null;
  coach_name: string | null;
  total: number;
  /** Everything paid for this subscription up to and including this payment. */
  paid_to_date: number;
};

export async function getPaymentReceipt(db: SQLiteDatabase, id: number) {
  const row = await db.getFirstAsync<PaymentReceipt>(
    `SELECT p.*, u.name AS user_name,
            TRIM(m.first_name || ' ' || m.last_name) AS member_name, m.dni AS member_dni, m.phone AS member_phone,
            s.plan_name, s.start_date, s.end_date, s.price AS plan_price,
            a.price AS personal_price, c.name AS coach_name,
            ${SUBSCRIPTION_TOTAL_SQL} AS total,
            (SELECT SUM(p2.amount) FROM payments p2 WHERE p2.subscription_id = s.id AND p2.id <= p.id) AS paid_to_date
     FROM payments p
     JOIN subscriptions s ON s.id = p.subscription_id
     JOIN members m ON m.id = p.member_id
     LEFT JOIN subscription_addons a ON a.subscription_id = s.id AND a.kind = 'personal'
     LEFT JOIN coaches c ON c.id = a.coach_id
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    id,
  );
  return row ? { ...row, due_after: Math.max(round2(row.total - row.paid_to_date), 0) } : null;
}

/** Members (active or not) with something left to pay, and the total owed. */
export async function countDebts(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ members: number; total: number | null }>(
    `SELECT COUNT(DISTINCT member_id) AS members, SUM(due) AS total FROM (
       SELECT s.member_id, ${SUBSCRIPTION_TOTAL_SQL} - ${SUBSCRIPTION_PAID_SQL} AS due FROM subscriptions s
     ) WHERE due > 0.009`,
  );
  return { members: row?.members ?? 0, total: round2(row?.total ?? 0) };
}

/** Membership payments collected today, using the device's local day. */
export async function getTodayPayments(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number; total: number | null }>(
    `SELECT COUNT(*) AS count, SUM(amount) AS total FROM payments WHERE date(created_at, 'localtime') = date('now', 'localtime')`,
  );
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
