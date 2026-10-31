import { getRandomBytes } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getProductByBarcode } from '@/features/store/db/products';

export const EGO_PREFIX = 'EGO';

/** EAN-style mod-10 check digit, so a mistyped or misread digit is rejected instead of matching another product. */
function checkDigit(digits: string) {
  const sum = digits
    .split('')
    .reverse()
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export function isEgoBarcode(code: string) {
  const match = /^EGO(\d{9})(\d)$/.exec(code);
  return !!match && checkDigit(match[1]) === match[2];
}

/** Real EAN/UPC codes are numeric, so the letter prefix can never collide with a scanned product. */
export async function generateEgoBarcode(db: SQLiteDatabase) {
  for (;;) {
    const digits = Array.from(getRandomBytes(9), (b) => b % 10).join('');
    const code = `${EGO_PREFIX}${digits}${checkDigit(digits)}`;
    if (!(await getProductByBarcode(db, code))) return code;
  }
}
