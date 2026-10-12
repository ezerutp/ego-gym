import type { SQLiteDatabase } from 'expo-sqlite';

import { PRODUCT_SOURCES, type ProductSourceId } from '@/features/store/lib/productLookup';

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
  /** Minutes without touches before the tablet locks; 0 never locks. */
  autoLockMinutes: number;
  /** A membership counts as "por vencer" this many days before it ends. */
  membershipWarningDays: number;
  telegramToken: string;
  telegramBotName: string;
  telegramChatId: string;
  telegramChatName: string;
  /** Scheduled reports are also sent to the admin's Telegram. */
  telegramSendReports: boolean;
  /** Sends the "Requiere atención" summary once a day at `notifyHour`. */
  telegramDailySummary: boolean;
  /** Local day (YYYY-MM-DD) of the last Telegram summary, so it goes out once a day. */
  telegramLastSummary: string;
  adminPhone: string;
  templateExpiring: string;
  templateExpired: string;
  templateDebt: string;
  productSources: ProductSourceId[];
};

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'Mi Gimnasio',
  storeAddress: '',
  storeRuc: '',
  storePhone: '',
  lowStockThreshold: 5,
  expiryWarningDays: 7,
  notificationsEnabled: true,
  notifyHour: 8,
  receiptFooter: '¡Gracias por su compra!',
  syncEnabled: false,
  autoLockMinutes: 5,
  membershipWarningDays: 5,
  telegramToken: '',
  telegramBotName: '',
  telegramChatId: '',
  telegramChatName: '',
  telegramSendReports: true,
  telegramDailySummary: true,
  telegramLastSummary: '',
  adminPhone: '',
  templateExpiring: 'Hola {nombre}, te recordamos que tu membresía en {gimnasio} vence el {fecha}. ¡Te esperamos para renovarla! 💪',
  templateExpired: 'Hola {nombre}, tu membresía en {gimnasio} venció el {fecha}. ¡Te esperamos para renovarla y seguir entrenando! 💪',
  templateDebt: 'Hola {nombre}, te recordamos que tienes un saldo pendiente de {monto} en {gimnasio}. Puedes acercarte a recepción para regularizarlo. ¡Gracias!',
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
