import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { Product } from '@/db/products';
import { getSettings } from '@/db/settings';
import { computeAlerts, groupAlerts, minStockFor } from '@/lib/alerts';
import { parseIsoDay } from '@/lib/format';

const CHANNEL_ID = 'alertas';

/**
 * Since SDK 53, merely importing expo-notifications on Android throws inside Expo Go,
 * so the module is loaded only in real builds and every helper here is a no-op in Expo Go.
 */
export const notificationsAvailable = !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: typeof NotificationsModule | null = notificationsAvailable ? require('expo-notifications') : null;

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Opens the screen a notification points to when the user taps it. */
export function onNotificationTap(open: (url: string) => void) {
  const sub = Notifications?.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => sub?.remove();
}

export async function sendTestNotification() {
  if (!Notifications || !(await setupNotifications())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Bodega Scan', body: 'Así se verán tus alertas de stock y vencimiento.' },
    trigger: { channelId: CHANNEL_ID },
  });
  return true;
}

export async function setupNotifications() {
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alertas de almacén',
      description: 'Poco stock y productos por vencer',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Local notifications carry fixed content, so every time stock or settings change we
 * cancel everything and rebuild: one daily summary plus one reminder per expiring product.
 */
export async function rescheduleAlerts(db: SQLiteDatabase) {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const settings = await getSettings(db);
  if (!settings.notificationsEnabled) return;

  const groups = groupAlerts(await computeAlerts(db, settings));
  const lowCount = groups.lowStock.length + groups.outOfStock.length;
  const expCount = groups.expiring.length + groups.expired.length;

  if (lowCount + expCount > 0) {
    const parts = [];
    if (lowCount) parts.push(`${lowCount} con poco stock`);
    if (expCount) parts.push(`${expCount} por vencer o vencidos`);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Resumen de tu almacén', body: `Tienes ${parts.join(' y ')}.`, data: { url: '/alerts' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.notifyHour,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
  }

  const products = await db.getAllAsync<Product>('SELECT * FROM products WHERE expiry_date IS NOT NULL');
  const now = Date.now();
  for (const p of products) {
    const expiry = parseIsoDay(p.expiry_date!);
    const warnAt = new Date(expiry);
    warnAt.setDate(warnAt.getDate() - settings.expiryWarningDays);
    warnAt.setHours(settings.notifyHour, 0, 0, 0);
    const dueAt = new Date(expiry);
    dueAt.setHours(settings.notifyHour, 0, 0, 0);

    const reminders = [
      { at: warnAt, body: `${p.name} vence en ${settings.expiryWarningDays} días.` },
      { at: dueAt, body: `${p.name} vence hoy. Revisa tu stock.` },
    ];
    for (const r of reminders) {
      if (r.at.getTime() <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Producto por vencer', body: r.body, data: { url: `/product/${p.id}` } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL_ID },
      });
    }
  }
}

/** Fires right away when a sale or adjustment leaves a product at or below its minimum. */
export async function notifyLowStock(db: SQLiteDatabase, productIds: number[]) {
  if (!Notifications) return;
  const settings = await getSettings(db);
  if (!settings.notificationsEnabled || productIds.length === 0) return;
  const placeholders = productIds.map(() => '?').join(',');
  const products = await db.getAllAsync<Product>(`SELECT * FROM products WHERE id IN (${placeholders})`, ...productIds);
  for (const p of products) {
    if (p.stock > minStockFor(p, settings)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: p.stock === 0 ? 'Producto agotado' : 'Poco stock',
        body: p.stock === 0 ? `Se agotó ${p.name}.` : `Quedan ${p.stock} unidades de ${p.name}.`,
        data: { url: `/product/${p.id}` },
      },
      trigger: { channelId: CHANNEL_ID },
    });
  }
}
