import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { cartCount, useCart } from '@/features/store/lib/cart';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const SECTIONS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Resumen', icon: 'stats-chart' },
  inventory: { label: 'Almacén', icon: 'cube' },
  sell: { label: 'Vender', icon: 'cart' },
  alerts: { label: 'Alertas', icon: 'notifications' },
};

export default function StoreLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarPosition: 'top', sceneStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => <SectionBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="inventory" />
      <Tabs.Screen name="sell" />
      <Tabs.Screen name="alerts" />
    </Tabs>
  );
}

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function SectionBar({ state, navigation }: TabBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const count = cartCount(useCart());

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segments}>
        {state.routes.map((route, index) => {
          const meta = SECTIONS[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          const fg = focused ? colors.white : colors.text;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                Haptics.selectionAsync();
                if (!focused) navigation.navigate(route.name);
              }}
              style={[styles.segment, focused && styles.segmentActive]}
            >
              <Ionicons name={meta.icon} size={18} color={fg} />
              <Text style={[styles.segmentLabel, { color: fg }]}>{meta.label}</Text>
              {route.name === 'sell' && count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    bar: { backgroundColor: colors.background, paddingBottom: spacing.xs },
    segments: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segmentLabel: { fontSize: 14, fontWeight: '700' },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  }),
);
