import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { DATABASE_NAME, migrateDb } from '@/db/schema';
import { getSettings } from '@/db/settings';
import { LockScreen } from '@/features/auth/components/LockScreen';
import { session, useSession } from '@/features/auth/lib/session';
import { runDueDeliveries } from '@/features/integrations/lib/deliver';
import { registerReportsTask } from '@/features/reports/lib/background';
import { runDueReports } from '@/features/reports/lib/runner';
import { onNotificationTap, rescheduleAlerts, setupNotifications } from '@/lib/notifications';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const { colors, dark } = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  // Navigation containers paint their own background; match it to avoid flashes between screens.
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.ink, border: colors.border },
  };
  return (
    <ThemeProvider value={navTheme}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDb}>
        <NotificationBootstrap />
        <AutoLock />
        <ReportsBootstrap />
        <StatusBar style={dark ? 'light' : 'dark'} />
        {/* Sees every touch without claiming it, to know when the tablet was last used. */}
        <View style={{ flex: 1 }} onStartShouldSetResponderCapture={markActivity}>
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
              headerTitleStyle: { fontWeight: '700', color: colors.ink },
              headerTintColor: colors.ink,
              contentStyle: { backgroundColor: colors.background },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="product/new" options={{ title: 'Nuevo producto' }} />
            <Stack.Screen name="product/[id]" options={{ title: 'Producto' }} />
            <Stack.Screen name="receipt/[id]" options={{ title: 'Boleta' }} />
            <Stack.Screen name="member/[id]" options={{ title: 'Cliente' }} />
            <Stack.Screen name="member/form" options={{ title: 'Cliente' }} />
            <Stack.Screen name="member/enroll" options={{ title: 'Inscribir' }} />
            <Stack.Screen name="member/pay" options={{ title: 'Registrar pago' }} />
            <Stack.Screen name="payment/[id]" options={{ title: 'Boleta' }} />
            <Stack.Screen name="charge" options={{ title: 'Cobrar' }} />
            <Stack.Screen name="notifications" options={{ title: 'Requiere atención' }} />
            <Stack.Screen name="reports/index" options={{ title: 'Reportes' }} />
            <Stack.Screen name="reports/[id]" options={{ title: 'Reporte' }} />
            <Stack.Screen name="reports/schedule" options={{ title: 'Programar reporte' }} />
            <Stack.Screen name="integrations" options={{ title: 'Integraciones' }} />
            <Stack.Screen name="plans/index" options={{ title: 'Planes' }} />
            <Stack.Screen name="plans/[id]" options={{ title: 'Plan' }} />
            <Stack.Screen name="coaches/index" options={{ title: 'Coaches' }} />
            <Stack.Screen name="coaches/[id]" options={{ title: 'Coach' }} />
            <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
            <Stack.Screen name="users/index" options={{ title: 'Usuarios' }} />
            <Stack.Screen name="users/[id]" options={{ title: 'Usuario' }} />
          </Stack>
          <LockGate />
        </View>
      </SQLiteProvider>
    </ThemeProvider>
  );
}

function NotificationBootstrap() {
  const db = useSQLiteContext();

  useEffect(() => {
    setupNotifications()
      .then((granted) => (granted ? rescheduleAlerts(db) : undefined))
      .catch(() => {});

    return onNotificationTap((url) => router.push(url as never));
  }, [db]);

  return null;
}

/**
 * Owns the session subscription so signing in or out never re-renders the root layout:
 * on the phone, a root re-render with the navigator inside was computed but never shown.
 */
function LockGate() {
  const user = useSession();
  const wasSignedIn = useRef(!!user);

  useEffect(() => {
    // Closes pushed screens (camera, forms) so the next user starts at home.
    if (wasSignedIn.current && !user && router.canDismiss()) router.dismissAll();
    wasSignedIn.current = !!user;
  }, [user]);

  if (user) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LockScreen />
    </View>
  );
}

function markActivity() {
  session.touch();
  return false;
}

/** Scheduled reports and Telegram sends also run on every launch and return to the app, as Android may delay the background task. */
function ReportsBootstrap() {
  const db = useSQLiteContext();

  useEffect(() => {
    const run = () => runDueReports(db).then(() => runDueDeliveries(db)).catch(() => {});
    registerReportsTask();
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, [db]);

  return null;
}

const AUTO_LOCK_CHECK_MS = 15_000;

function AutoLock() {
  const db = useSQLiteContext();

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!session.get()) return;
      const { autoLockMinutes } = await getSettings(db);
      if (autoLockMinutes > 0 && session.idleMs() > autoLockMinutes * 60_000) session.signOut();
    }, AUTO_LOCK_CHECK_MS);
    return () => clearInterval(timer);
  }, [db]);

  return null;
}
