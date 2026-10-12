import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductRow } from '@/components/ProductRow';
import { Card, EmptyState, IconCircle, type IconName } from '@/components/ui';
import type { Settings } from '@/db/settings';
import { getSettings } from '@/db/settings';
import { computeAlerts, groupAlerts, type StockAlert } from '@/lib/alerts';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function AlertsScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const { data } = useFocusQuery(async (db) => {
    const settings = await getSettings(db);
    return { settings, groups: groupAlerts(await computeAlerts(db, settings)) };
  });
  if (!data) return <SafeAreaView style={styles.safe} />;
  const { settings, groups } = data;
  const total = groups.outOfStock.length + groups.lowStock.length + groups.expired.length + groups.expiring.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={font.title}>Alertas</Text>
        <Text style={[font.small, { marginBottom: spacing.xl }]}>
          {total === 0 ? 'Sin pendientes' : `${total} ${total === 1 ? 'producto requiere' : 'productos requieren'} tu atención`}
        </Text>
        {total === 0 ? (
          <EmptyState icon="checkmark-done" title="Todo en orden" message="No tienes productos con poco stock ni por vencer." />
        ) : (
          <>
            <Group title="Vencidos" icon="close-circle" color={colors.danger} bg={colors.dangerSoft} alerts={groups.expired} settings={settings} />
            <Group title="Agotados" icon="alert-circle" color={colors.danger} bg={colors.dangerSoft} alerts={groups.outOfStock} settings={settings} />
            <Group
              title={`Por vencer (próximos ${settings.expiryWarningDays} días)`}
              icon="time"
              color={colors.warning}
              bg={colors.warningSoft}
              alerts={groups.expiring}
              settings={settings}
            />
            <Group title="Poco stock" icon="trending-down" color={colors.warning} bg={colors.warningSoft} alerts={groups.lowStock} settings={settings} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, icon, color, bg, alerts, settings }: { title: string; icon: IconName; color: string; bg: string; alerts: StockAlert[]; settings: Settings }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  if (alerts.length === 0) return null;
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View style={styles.groupHeader}>
        <IconCircle icon={icon} color={color} bg={bg} size={32} />
        <Text style={[font.h3, { flex: 1 }]}>{title}</Text>
        <Text style={[font.h3, { color }]}>{alerts.length}</Text>
      </View>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {alerts.map((a, i) => (
          <View key={a.product.id} style={i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }}>
            <ProductRow product={a.product} settings={settings} onPress={() => router.push({ pathname: '/product/[id]', params: { id: a.product.id } })} />
          </View>
        ))}
      </Card>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 48 },
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  }),
);
