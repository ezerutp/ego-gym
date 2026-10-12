import type { SQLiteDatabase } from 'expo-sqlite';

import { insertPayment, SUBSCRIPTION_PAID_SQL, SUBSCRIPTION_TOTAL_SQL, type PaymentMethod } from '@/features/payments/db/payments';

export type Subscription = {
  id: number;
  member_id: number;
  plan_id: number | null;
  plan_name: string;
  start_date: string;
  end_date: string;
  price: number;
  notes: string | null;
  created_at: string;
  personal_price: number | null;
  personal_start: string | null;
  personal_end: string | null;
  coach_id: number | null;
  coach_name: string | null;
  total: number;
  paid: number;
};

export type SubscriptionInput = {
  memberId: number;
  planId: number;
  planName: string;
  startDate: string;
  endDate: string;
  price: number;
  notes: string | null;
  personal: { coachId: number; price: number } | null;
  /** Paid at enrollment; anything left becomes debt. */
  payment?: { amount: number; method: PaymentMethod } | null;
};

const SELECT = `
  SELECT s.*, a.price AS personal_price, a.start_date AS personal_start, a.end_date AS personal_end,
         a.coach_id, c.name AS coach_name, ${SUBSCRIPTION_TOTAL_SQL} AS total, ${SUBSCRIPTION_PAID_SQL} AS paid
  FROM subscriptions s
  LEFT JOIN subscription_addons a ON a.subscription_id = s.id AND a.kind = 'personal'
  LEFT JOIN coaches c ON c.id = a.coach_id`;

export function listMemberSubscriptions(db: SQLiteDatabase, memberId: number) {
  return db.getAllAsync<Subscription>(`${SELECT} WHERE s.member_id = ? ORDER BY s.end_date DESC, s.id DESC`, memberId);
}

export function getSubscription(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Subscription>(`${SELECT} WHERE s.id = ?`, id);
}

/** The period that ends last; it may already be expired. */
export function getLatestSubscription(db: SQLiteDatabase, memberId: number) {
  return db.getFirstAsync<Subscription>(`${SELECT} WHERE s.member_id = ? ORDER BY s.end_date DESC, s.id DESC LIMIT 1`, memberId);
}

export async function createSubscription(db: SQLiteDatabase, input: SubscriptionInput, userId: number | null) {
  let id = 0;
  let paymentId: number | null = null;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO subscriptions (member_id, plan_id, plan_name, start_date, end_date, price, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.memberId,
      input.planId,
      input.planName,
      input.startDate,
      input.endDate,
      input.price,
      input.notes?.trim() || null,
      userId,
    );
    id = result.lastInsertRowId;
    if (input.personal) {
      await db.runAsync(
        'INSERT INTO subscription_addons (subscription_id, kind, coach_id, price, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        'personal',
        input.personal.coachId,
        input.personal.price,
        input.startDate,
        input.endDate,
      );
    }
    if (input.payment && input.payment.amount > 0) {
      paymentId = await insertPayment(
        db,
        { subscriptionId: id, memberId: input.memberId, amount: input.payment.amount, method: input.payment.method },
        userId,
      );
    }
    // Enrolling is what turns a prospect (or a returning inactive member) into an active client.
    await db.runAsync(`UPDATE members SET status = 'active', synced = 0, updated_at = datetime('now') WHERE id = ? AND status != 'active'`, input.memberId);
  });
  return { subscriptionId: id, paymentId };
}

export async function deleteSubscription(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM subscriptions WHERE id = ?', id);
}

/** Counts for the home screen: memberships ending within `warningDays` and those already ended, per member. */
export async function countMembershipAlerts(db: SQLiteDatabase, today: string, warningLimit: string) {
  const row = await db.getFirstAsync<{ expiring: number; expired: number }>(
    `WITH latest AS (SELECT member_id, MAX(end_date) AS end_date FROM subscriptions GROUP BY member_id)
     SELECT
       SUM(CASE WHEN l.end_date >= ? AND l.end_date <= ? THEN 1 ELSE 0 END) AS expiring,
       SUM(CASE WHEN l.end_date < ? THEN 1 ELSE 0 END) AS expired
     FROM latest l JOIN members m ON m.id = l.member_id WHERE m.status = 'active'`,
    today,
    warningLimit,
    today,
  );
  return { expiring: row?.expiring ?? 0, expired: row?.expired ?? 0 };
}
