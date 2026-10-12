import type { SQLiteDatabase } from 'expo-sqlite';

import { SUBSCRIPTION_PAID_SQL, SUBSCRIPTION_TOTAL_SQL } from '@/features/payments/db/payments';

export type MemberStatus = 'prospect' | 'active' | 'inactive';

export type Member = {
  id: number;
  first_name: string;
  last_name: string;
  dni: string | null;
  phone: string | null;
  photo_uri: string | null;
  birth_date: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  notes: string | null;
  status: MemberStatus;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberInput = Omit<Member, 'id' | 'created_at' | 'updated_at'>;

export const STATUS_LABELS: Record<MemberStatus, string> = { prospect: 'Prospecto', active: 'Activo', inactive: 'Inactivo' };

export const PROSPECT_SOURCES = ['Recomendación', 'Redes sociales', 'Pasó por el local', 'Volante o publicidad', 'Otro'];

export function fullName(m: Pick<Member, 'first_name' | 'last_name'>) {
  return `${m.first_name} ${m.last_name}`.trim();
}

export type MemberListItem = Member & { membership_end: string | null; debt: number };

export type MemberFilter =
  | { status?: MemberStatus; membership?: undefined; withDebt?: undefined }
  | { status?: undefined; membership: { kind: 'expiring' | 'expired'; today: string; warningLimit: string }; withDebt?: undefined }
  | { status?: undefined; membership?: undefined; withDebt: true };

export async function listMembers(db: SQLiteDatabase, { search = '', status, membership, withDebt }: { search?: string } & MemberFilter = {}) {
  const term = `%${search.trim()}%`;
  const params: (string | number)[] = [term, term, term, term];
  let where = `(first_name || ' ' || last_name LIKE ? OR last_name LIKE ? OR IFNULL(dni, '') LIKE ? OR IFNULL(phone, '') LIKE ?)`;
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (membership?.kind === 'expiring') {
    where += " AND status = 'active' AND membership_end BETWEEN ? AND ?";
    params.push(membership.today, membership.warningLimit);
  } else if (membership?.kind === 'expired') {
    where += " AND status = 'active' AND membership_end < ?";
    params.push(membership.today);
  }
  if (withDebt) where += ' AND debt > 0.009';
  return db.getAllAsync<MemberListItem>(
    `SELECT * FROM (
       SELECT m.*,
         (SELECT MAX(end_date) FROM subscriptions s WHERE s.member_id = m.id) AS membership_end,
         IFNULL((SELECT SUM(MAX(${SUBSCRIPTION_TOTAL_SQL} - ${SUBSCRIPTION_PAID_SQL}, 0)) FROM subscriptions s WHERE s.member_id = m.id), 0) AS debt
       FROM members m
     ) WHERE ${where}
     ORDER BY ${withDebt ? 'debt DESC, ' : membership ? 'membership_end, ' : ''}first_name COLLATE NOCASE, last_name COLLATE NOCASE`,
    ...params,
  );
}

export async function countMembersByStatus(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ status: MemberStatus; n: number }>('SELECT status, COUNT(*) AS n FROM members GROUP BY status');
  const counts: Record<MemberStatus, number> = { prospect: 0, active: 0, inactive: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export function getMember(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Member>('SELECT * FROM members WHERE id = ?', id);
}

/** Returns the member that already uses this DNI, ignoring `exceptId`. */
export function findMemberByDni(db: SQLiteDatabase, dni: string, exceptId?: number) {
  return db.getFirstAsync<Member>('SELECT * FROM members WHERE dni = ? AND id != ?', dni, exceptId ?? 0);
}

const COLUMNS = [
  'first_name',
  'last_name',
  'dni',
  'phone',
  'photo_uri',
  'birth_date',
  'emergency_name',
  'emergency_phone',
  'notes',
  'status',
  'source',
] as const satisfies readonly (keyof MemberInput)[];

const REQUIRED_TEXT = new Set<string>(['first_name', 'last_name', 'status']);

/** Empty optional fields are stored as NULL so the unique DNI index ignores them. */
function values(input: MemberInput) {
  return COLUMNS.map((c) => {
    const v = input[c];
    if (typeof v !== 'string') return v;
    return REQUIRED_TEXT.has(c) ? v.trim() : v.trim() || null;
  });
}

export async function createMember(db: SQLiteDatabase, input: MemberInput, userId: number | null) {
  const result = await db.runAsync(
    `INSERT INTO members (${COLUMNS.join(', ')}, created_by) VALUES (${COLUMNS.map(() => '?').join(', ')}, ?)`,
    ...values(input),
    userId,
  );
  return result.lastInsertRowId;
}

export async function updateMember(db: SQLiteDatabase, id: number, input: MemberInput) {
  await db.runAsync(
    `UPDATE members SET ${COLUMNS.map((c) => `${c} = ?`).join(', ')}, synced = 0, updated_at = datetime('now') WHERE id = ?`,
    ...values(input),
    id,
  );
}

export async function deleteMember(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM members WHERE id = ?', id);
}
