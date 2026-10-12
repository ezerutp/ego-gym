import type { SQLiteDatabase } from 'expo-sqlite';

import { PRODUCT_SOURCES, type ProductSourceId } from '@/lib/productLookup';

export type Settings = {
  storeName: string;
  storeAddress: string;
  storeRuc: string;
  storePhone: string;
  lowStockThreshold: number;
  expiryWarningDays: number;
  notificationsEnabled: boolean;
  notifyHour: number;
  receiptFooter: string;
  syncEnabled: boolean;
  productSources: ProductSourceId[];
};

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'Mi Bodega',
  storeAddress: '',
  storeRuc: '',
  storePhone: '',
  lowStockThreshold: 5,
  expiryWarningDays: 7,
  notificationsEnabled: true,
  notifyHour: 8,
  receiptFooter: '¡Gracias por su compra!',
  syncEnabled: false,
  productSources: PRODUCT_SOURCES.map((s) => s.id),
};

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(db: SQLiteDatabase, patch: Partial<Settings>) {
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(patch)) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        JSON.stringify(value),
      );
    }
  });
}
