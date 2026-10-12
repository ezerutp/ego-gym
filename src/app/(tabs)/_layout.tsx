import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { cartCount, useCart } from '@/features/store/lib/cart';
import { useIsWide } from '@/lib/layout';
import { makeStyles, radius, useTheme } from '@/theme';

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Inicio', icon: 'home-outline', iconActive: 'home' },
  members: { label: 'Clientes', icon: 'people-outline', iconActive: 'people' },
  store: { label: 'Tienda', icon: 'storefront-outline', iconActive: 'storefront' },
  more: { label: 'Más', icon: 'grid-outline', iconActive: 'grid' },
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const wide = useIsWide();
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', sceneStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => (wide ? <SideRail {...props} /> : <TabBar {...props} />)}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="members" />
      <Tabs.Screen name="store" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabItem({ name, state, navigation, vertical }: TabBarProps & { name: keyof typeof TABS; vertical?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const index = state.routes.findIndex((r) => r.name === name);
  const route = state.routes[index];
  const meta = TABS[name];
  const focused = state.index === index;
  const color = focused ? colors.primary : colors.faint;
  return (
    <Pressable
      style={[vertical ? styles.railTab : styles.tab, vertical && focused && styles.railTabActive]}
      onPress={() => {
        Haptics.selectionAsync();
        if (!focused) navigation.navigate(route.name);
      }}
    >
      <Ionicons name={focused ? meta.iconActive : meta.icon} size={24} color={color} />
      <Text style={[styles.label, { color }]}>{meta.label}</Text>
    </Pressable>
  );
}

function SellButton({ size }: { size: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const count = cartCount(useCart());
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: '/scan', params: { mode: 'sell' } });
      }}
      style={({ pressed }) => [styles.sellButton, { width: size, height: size, borderRadius: size / 2 }, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <Ionicons name="scan" size={size * 0.45} color={colors.white} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function TabBar(props: TabBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <TabItem {...props} name="index" />
      <TabItem {...props} name="members" />
      <View style={styles.tab}>
        <View style={styles.sellLift}>
          <SellButton size={62} />
        </View>
        <Text style={[styles.label, { color: colors.primary, marginTop: 2 }]}>Vender</Text>
      </View>
      <TabItem {...props} name="store" />
      <TabItem {...props} name="more" />
    </View>
  );
}

function SideRail(props: TabBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.rail, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingLeft: insets.left + 12 }]}>
      <Text style={styles.brand}>EGO</Text>
      <View style={styles.railAction}>
        <SellButton size={56} />
        <Text style={[styles.label, { color: colors.primary }]}>Vender</Text>
      </View>
      <View style={styles.railTabs}>
        <TabItem {...props} name="index" />
        <TabItem {...props} name="members" />
        <TabItem {...props} name="store" />
      </View>
      <TabItem {...props} name="more" />
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
    sellLift: { marginTop: -34, borderWidth: 5, borderColor: colors.background, borderRadius: 40 },
    sellButton: {
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
      shadowOpacity: 0.25,
      elevation: 8,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
    rail: {
      width: 108,
      paddingRight: 12,
      alignItems: 'stretch',
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    brand: { fontSize: 20, fontWeight: '900', color: colors.primary, letterSpacing: 1, textAlign: 'center' },
    railAction: { alignItems: 'center', gap: 6, marginTop: 28, marginBottom: 20 },
    railTabs: { flex: 1, gap: 6 },
    railTab: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderRadius: radius.md },
    railTabActive: { backgroundColor: colors.primarySoft },
  }),
);
