import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { cartCount, useCart } from '@/lib/cart';
import { makeStyles, useTheme } from '@/theme';

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Inicio', icon: 'home-outline', iconActive: 'home' },
  inventory: { label: 'Almacén', icon: 'cube-outline', iconActive: 'cube' },
  alerts: { label: 'Alertas', icon: 'notifications-outline', iconActive: 'notifications' },
  settings: { label: 'Ajustes', icon: 'settings-outline', iconActive: 'settings' },
};

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="settings" />
      {/* Reached from the central scan button and the home screen, not from its own tab */}
      <Tabs.Screen name="sell" />
    </Tabs>
  );
}

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabBar({ state, navigation }: TabBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const items = useCart();
  const count = cartCount(items);

  const renderTab = (name: keyof typeof TABS) => {
    const index = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[index];
    const meta = TABS[name];
    const focused = state.index === index;
    return (
      <Pressable
        key={route.key}
        style={styles.tab}
        onPress={() => {
          Haptics.selectionAsync();
          if (!focused) navigation.navigate(route.name);
        }}
      >
        <View>
          <Ionicons name={focused ? meta.iconActive : meta.icon} size={24} color={focused ? colors.primary : colors.faint} />
        </View>
        <Text style={[styles.label, { color: focused ? colors.primary : colors.faint }]}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {renderTab('index')}
      {renderTab('inventory')}
      <View style={styles.tab}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({ pathname: '/scan', params: { mode: 'sell' } });
          }}
          style={({ pressed }) => [styles.scanButton, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <Ionicons name="scan" size={28} color={colors.white} />
          {count > 0 && (
            <View style={[styles.badge, { top: -4, right: -4 }]}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          )}
        </Pressable>
        <Text style={[styles.label, { color: colors.primary, marginTop: 2 }]}>Vender</Text>
      </View>
      {renderTab('alerts')}
      {renderTab('settings')}
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      paddingTop: 10,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      ...shadow,
      shadowOffset: { width: 0, height: -4 },
      elevation: 12,
    },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
    label: { fontSize: 11, fontWeight: '600' },
    scanButton: {
      width: 62,
      height: 62,
      borderRadius: 31,
      marginTop: -34,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 5,
      borderColor: colors.background,
      ...shadow,
      shadowOpacity: 0.25,
      elevation: 8,
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -10,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  }),
);
