import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export type Role = 'admin' | 'reception';

export type User = { id: number; name: string; role: Role; active: number; created_at: string };

export const ROLE_LABELS: Record<Role, string> = { admin: 'Administrador', reception: 'Recepción' };

export const PIN_LENGTH = 4;

const USER_COLUMNS = 'id, name, role, active, created_at';

function hashPin(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export function listUsers(db: SQLiteDatabase, { includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE active = 1';
  return db.getAllAsync<User>(`SELECT ${USER_COLUMNS} FROM users ${where} ORDER BY role = 'admin' DESC, name COLLATE NOCASE`);
}

export function getUser(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<User>(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, id);
}

export async function countUsers(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM users');
  return row?.n ?? 0;
}

export async function createUser(db: SQLiteDatabase, input: { name: string; role: Role; pin: string }) {
  const salt = Crypto.randomUUID();
  const result = await db.runAsync(
    'INSERT INTO users (name, role, pin_hash, pin_salt) VALUES (?, ?, ?, ?)',
    input.name.trim(),
    input.role,
    await hashPin(input.pin, salt),
    salt,
  );
  return result.lastInsertRowId;
}

export async function updateUser(db: SQLiteDatabase, id: number, patch: { name: string; role: Role; active: boolean }) {
  await db.runAsync(
    `UPDATE users SET name = ?, role = ?, active = ?, updated_at = datetime('now') WHERE id = ?`,
    patch.name.trim(),
    patch.role,
    patch.active ? 1 : 0,
    id,
  );
}

export async function setPin(db: SQLiteDatabase, id: number, pin: string) {
  const salt = Crypto.randomUUID();
  await db.runAsync(`UPDATE users SET pin_hash = ?, pin_salt = ?, updated_at = datetime('now') WHERE id = ?`, await hashPin(pin, salt), salt, id);
}

export async function verifyPin(db: SQLiteDatabase, id: number, pin: string) {
  const row = await db.getFirstAsync<{ pin_hash: string; pin_salt: string }>('SELECT pin_hash, pin_salt FROM users WHERE id = ? AND active = 1', id);
  if (!row) return false;
  return (await hashPin(pin, row.pin_salt)) === row.pin_hash;
}

/** True when changing `id` this way would leave the app without an active admin. */
export async function wouldRemoveLastAdmin(db: SQLiteDatabase, id: number, next: { role: Role; active: boolean }) {
  if (next.role === 'admin' && next.active) return false;
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?", id);
  return (row?.n ?? 0) === 0;
}
