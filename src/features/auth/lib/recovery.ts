import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSettings, saveSettings } from '@/db/settings';

const CODE_BYTES = 8;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, '');
}

export function formatRecoveryCode(code: string) {
  const clean = normalizeRecoveryCode(code);
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

export async function generateRecoveryCode() {
  const bytes = await Crypto.getRandomBytesAsync(CODE_BYTES);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function hashRecoveryCode(code: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${normalizeRecoveryCode(code)}`);
}

export async function storeRecoveryCode(db: SQLiteDatabase, code: string) {
  const salt = Crypto.randomUUID();
  await saveSettings(db, { recoveryCodeHash: await hashRecoveryCode(code, salt), recoveryCodeSalt: salt });
}

export async function hasRecoveryCode(db: SQLiteDatabase) {
  const settings = await getSettings(db);
  return !!settings.recoveryCodeHash;
}

export async function verifyRecoveryCode(db: SQLiteDatabase, code: string) {
  const settings = await getSettings(db);
  if (!settings.recoveryCodeHash || !settings.recoveryCodeSalt) return false;
  return (await hashRecoveryCode(code, settings.recoveryCodeSalt)) === settings.recoveryCodeHash;
}
