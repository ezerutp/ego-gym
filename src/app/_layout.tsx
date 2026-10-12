import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DATABASE_NAME, migrateDb } from '@/db/schema';
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
        <StatusBar style={dark ? 'light' : 'dark'} />
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
        </Stack>
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
