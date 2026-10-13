import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSettings } from '@/db/settings';
import { telegramReady } from '@/features/integrations/lib/deliver';
import { sendText } from '@/features/integrations/lib/telegram';

export const RESET_CODE_LENGTH = 6;
export const RESET_TTL_MINUTES = 10;
export const RESET_MAX_ATTEMPTS = 3;

type ResetRow = { id: number; code_hash: string; code_salt: string; expires_at: string; attempts: number };

function hashResetCode(code: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${code}`);
}

function expired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

async function pendingReset(db: SQLiteDatabase, userId: number) {
  return db.getFirstAsync<ResetRow>(
    `SELECT id, code_hash, code_salt, expires_at, attempts FROM pin_resets
     WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1`,
    userId,
  );
}

/** Creates a one-time code for `userId`, invalidating any previous pending one. */
export async function requestPinReset(db: SQLiteDatabase, userId: number) {
  await db.runAsync('UPDATE pin_resets SET used = 1 WHERE user_id = ? AND used = 0', userId);
  const bytes = await Crypto.getRandomBytesAsync(RESET_CODE_LENGTH);
  const code = Array.from(bytes, (b) => String(b % 10)).join('');
  const salt = Crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();
  await db.runAsync('INSERT INTO pin_resets (user_id, code_hash, code_salt, expires_at) VALUES (?, ?, ?, ?)', userId, await hashResetCode(code, salt), salt, expiresAt);
  return code;
}

export type VerifyReset = { ok: true } | { ok: false; reason: 'wrong' | 'expired' | 'exhausted' };

export async function verifyPinReset(db: SQLiteDatabase, userId: number, code: string): Promise<VerifyReset> {
  const row = await pendingReset(db, userId);
  if (!row) return { ok: false, reason: 'expired' };
  if (expired(row.expires_at)) {
    await db.runAsync('UPDATE pin_resets SET used = 1 WHERE id = ?', row.id);
    return { ok: false, reason: 'expired' };
  }
  if (row.attempts >= RESET_MAX_ATTEMPTS) {
    await db.runAsync('UPDATE pin_resets SET used = 1 WHERE id = ?', row.id);
    return { ok: false, reason: 'exhausted' };
  }
  if ((await hashResetCode(code.trim(), row.code_salt)) !== row.code_hash) {
    await db.runAsync('UPDATE pin_resets SET attempts = attempts + 1 WHERE id = ?', row.id);
    return { ok: false, reason: row.attempts + 1 >= RESET_MAX_ATTEMPTS ? 'exhausted' : 'wrong' };
  }
  await db.runAsync('UPDATE pin_resets SET used = 1 WHERE id = ?', row.id);
  return { ok: true };
}

/** Sends a fresh reset code to the admin's Telegram. Throws when Telegram is not ready. */
export async function sendResetCode(db: SQLiteDatabase, userId: number, userName: string) {
  const settings = await getSettings(db);
  if (!telegramReady(settings)) throw new Error('Telegram no está configurado. Usa el código de recuperación o pide a otro administrador que cambie tu PIN.');
  const code = await requestPinReset(db, userId);
  await sendText(
    settings.telegramToken,
    settings.telegramChatId,
    `🔑 ${userName} olvidó su PIN de ${settings.storeName}.\nCódigo: ${code}\nVence en ${RESET_TTL_MINUTES} minutos. Si no lo pediste, ignora este mensaje.`,
  );
}
