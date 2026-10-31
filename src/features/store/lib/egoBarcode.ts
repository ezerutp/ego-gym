import { getRandomBytes } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getProductByBarcode } from '@/features/store/db/products';

export const EGO_PREFIX = 'EGO';

export function isEgoBarcode(code: string) {
  return /^EGO\d{10}$/.test(code);
}

/** Real EAN/UPC codes are numeric, so the letter prefix can never collide with a scanned product. */
export async function generateEgoBarcode(db: SQLiteDatabase) {
  for (;;) {
    const digits = Array.from(getRandomBytes(10), (b) => b % 10).join('');
    const code = `${EGO_PREFIX}${digits}`;
    if (!(await getProductByBarcode(db, code))) return code;
  }
}
