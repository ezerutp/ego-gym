import type { SQLiteDatabase } from 'expo-sqlite';

import type { Member } from '@/features/members/db/members';
import { todayIso } from '@/lib/format';

export type Coach = { id: number; name: string; phone: string | null; photo_uri: string | null; specialty: string | null; active: number };

export type CoachInput = Omit<Coach, 'id' | 'active'> & { active: boolean };

export function listCoaches(db: SQLiteDatabase, { includeInactive = false } = {}) {
  return db.getAllAsync<Coach & { clients: number }>(
    `SELECT c.*, (
       SELECT COUNT(DISTINCT s.member_id) FROM subscription_addons a
       JOIN subscriptions s ON s.id = a.subscription_id
       WHERE a.coach_id = c.id AND a.end_date >= ?
     ) AS clients
     FROM coaches c ${includeInactive ? '' : 'WHERE c.active = 1'}
     ORDER BY c.active DESC, c.name COLLATE NOCASE`,
    todayIso(),
  );
}

export function getCoach(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Coach>('SELECT * FROM coaches WHERE id = ?', id);
}

export async function saveCoach(db: SQLiteDatabase, id: number | null, input: CoachInput) {
  const values = [input.name.trim(), input.phone?.trim() || null, input.photo_uri, input.specialty?.trim() || null, input.active ? 1 : 0];
  if (id) {
    await db.runAsync(
      `UPDATE coaches SET name = ?, phone = ?, photo_uri = ?, specialty = ?, active = ?, updated_at = datetime('now') WHERE id = ?`,
      ...values,
      id,
    );
    return id;
  }
  const result = await db.runAsync('INSERT INTO coaches (name, phone, photo_uri, specialty, active) VALUES (?, ?, ?, ?, ?)', ...values);
  return result.lastInsertRowId;
}

/** Members with a personal training add-on from this coach that has not ended yet. */
export function listCoachClients(db: SQLiteDatabase, coachId: number) {
  return db.getAllAsync<Member & { personal_end: string }>(
    `SELECT m.*, MAX(a.end_date) AS personal_end FROM subscription_addons a
     JOIN subscriptions s ON s.id = a.subscription_id
     JOIN members m ON m.id = s.member_id
     WHERE a.coach_id = ? AND a.end_date >= ?
     GROUP BY m.id ORDER BY personal_end`,
    coachId,
    todayIso(),
  );
}
