import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getSettings } from '@/db/settings';
import { computeAttention } from '@/features/alerts/lib/attention';
import { fullName, type Member } from '@/features/members/db/members';
import type { Product } from '@/features/store/db/products';
import { minStockFor } from '@/features/store/lib/alerts';
import { parseIsoDay, todayIso } from '@/lib/format';

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
    content: { title: 'EGO Gym', body: 'Así se verán tus alertas de membresías, deudas y almacén.' },
    trigger: { channelId: CHANNEL_ID },
  });
  return true;
}

export async function setupNotifications() {
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alertas de EGO Gym',
      description: 'Membresías por vencer, deudas, poco stock y productos por vencer',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Android keeps at most ~500 alarms per app; membership reminders take the nearest ones. */
const MAX_MEMBER_REMINDERS = 60;

/**
 * Local notifications carry fixed content, so every time memberships, payments, stock or settings
 * change we cancel everything and rebuild: one daily summary plus reminders per membership and product.
 */
export async function rescheduleAlerts(db: SQLiteDatabase) {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const settings = await getSettings(db);
  if (!settings.notificationsEnabled) return;

  const a = await computeAttention(db, settings);
  const lowCount = a.store.lowStock.length + a.store.outOfStock.length;
  const expCount = a.store.expiring.length + a.store.expired.length;
  const parts = [];
  if (a.expiring.length) parts.push(`${a.expiring.length} ${a.expiring.length === 1 ? 'membresía por vencer' : 'membresías por vencer'}`);
  if (a.debts.length) parts.push(`${a.debts.length} ${a.debts.length === 1 ? 'cliente con deuda' : 'clientes con deuda'}`);
  if (lowCount) parts.push(`${lowCount} con poco stock`);
  if (expCount) parts.push(`${expCount} productos por vencer`);

  if (parts.length > 0) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Resumen del día', body: `Tienes ${joinParts(parts)}.`, data: { url: '/notifications' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.notifyHour,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
  }

  const now = Date.now();
  const atNotifyHour = (day: string, offsetDays = 0) => {
    const d = parseIsoDay(day);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(settings.notifyHour, 0, 0, 0);
    return d;
  };

  const members = await db.getAllAsync<Member & { end_date: string }>(
    `SELECT m.*, MAX(s.end_date) AS end_date FROM members m JOIN subscriptions s ON s.member_id = m.id
     WHERE m.status = 'active' GROUP BY m.id HAVING end_date >= ? ORDER BY end_date LIMIT ?`,
    todayIso(),
    MAX_MEMBER_REMINDERS,
  );
  for (const m of members) {
    const name = fullName(m);
    const reminders = [
      { at: atNotifyHour(m.end_date, -settings.membershipWarningDays), body: `La membresía de ${name} vence en ${settings.membershipWarningDays} días.` },
      { at: atNotifyHour(m.end_date), body: `La membresía de ${name} vence hoy.` },
    ];
    for (const r of reminders) {
      if (r.at.getTime() <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Membresía por vencer', body: r.body, data: { url: `/member/${m.id}` } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL_ID },
      });
    }
  }

  const products = await db.getAllAsync<Product>('SELECT * FROM products WHERE expiry_date IS NOT NULL');
  for (const p of products) {
    const reminders = [
      { at: atNotifyHour(p.expiry_date!, -settings.expiryWarningDays), body: `${p.name} vence en ${settings.expiryWarningDays} días.` },
      { at: atNotifyHour(p.expiry_date!), body: `${p.name} vence hoy. Revisa tu stock.` },
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

function joinParts(parts: string[]) {
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`;
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

/** Fires right away when a scheduled report has been generated. */
export async function notifyReportReady(db: SQLiteDatabase, title: string, reportId: number) {
  if (!Notifications || !(await getSettings(db)).notificationsEnabled) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Reporte listo', body: `${title} ya está disponible para compartir.`, data: { url: `/reports/${reportId}` } },
    trigger: { channelId: CHANNEL_ID },
  });
}
