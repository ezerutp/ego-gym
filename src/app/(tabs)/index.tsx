import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, IconCircle, SectionTitle, type IconName } from '@/components/ui';
import { getTodaySummary, listRecentSales } from '@/db/sales';
import { getSettings } from '@/db/settings';
import { computeAlerts, groupAlerts } from '@/lib/alerts';
import { formatDateTime, money, receiptNumber } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

export default function HomeScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const { data } = useFocusQuery(async (db) => {
    const settings = await getSettings(db);
    const [today, recent, alerts, totals] = await Promise.all([
      getTodaySummary(db),
      listRecentSales(db, 5),
      computeAlerts(db, settings),
      db.getFirstAsync<{ products: number; units: number | null }>('SELECT COUNT(*) AS products, SUM(stock) AS units FROM products'),
    ]);
    return { settings, today, recent, groups: groupAlerts(alerts), alertCount: alerts.length, totals };
  });

  if (!data) return <SafeAreaView style={styles.safe} />;
  const { settings, today, recent, groups, alertCount, totals } = data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={font.small}>{greeting()}</Text>
            <Text style={font.title} numberOfLines={1}>
              {settings.storeName}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/alerts')} style={styles.bell} hitSlop={8}>
            <Ionicons name="notifications-outline" size={24} color={colors.ink} />
            {alertCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Ventas de hoy</Text>
          <Text style={styles.heroValue}>{money(today.total)}</Text>
          <View style={styles.heroRow}>
            <HeroStat label="Boletas" value={String(today.count)} />
            <View style={styles.heroDivider} />
            <HeroStat label="Productos" value={String(totals?.products ?? 0)} />
            <View style={styles.heroDivider} />
            <HeroStat label="Unidades" value={String(totals?.units ?? 0)} />
          </View>
        </View>

        <View style={styles.actions}>
          <QuickAction icon="add-circle" label="Ingresar productos" onPress={() => router.push({ pathname: '/scan', params: { mode: 'add' } })} />
          <QuickAction icon="cart" label="Nueva venta" onPress={() => router.push({ pathname: '/scan', params: { mode: 'sell' } })} />
          <QuickAction icon="cube" label="Ver almacén" onPress={() => router.navigate('/inventory')} />
        </View>

        <SectionTitle title="Alertas" action={alertCount ? 'Ver todas' : undefined} onAction={() => router.push('/alerts')} />
        <View style={styles.alertGrid}>
          <AlertTile
            icon="trending-down"
            tone="warning"
            value={groups.lowStock.length + groups.outOfStock.length}
            label="Poco stock"
            detail={groups.outOfStock.length ? `${groups.outOfStock.length} agotados` : 'Reponer pronto'}
          />
          <AlertTile
            icon="time"
            tone="danger"
            value={groups.expiring.length + groups.expired.length}
            label="Por vencer"
            detail={groups.expired.length ? `${groups.expired.length} vencidos` : `Próximos ${settings.expiryWarningDays} días`}
          />
        </View>

        <SectionTitle title="Últimas ventas" />
        {recent.length === 0 ? (
          <Card>
            <EmptyState icon="receipt-outline" title="Aún no hay ventas" message="Escanea productos en la pestaña Vender para generar tu primera boleta." />
          </Card>
        ) : (
          <Card style={{ padding: 0 }}>
            {recent.map((sale, i) => (
              <Pressable
                key={sale.id}
                onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: sale.id } })}
                style={[styles.saleRow, i > 0 && styles.saleBorder]}
              >
                <IconCircle icon="receipt-outline" color={colors.primary} bg={colors.primarySoft} />
                <View style={{ flex: 1 }}>
                  <Text style={font.h3}>{receiptNumber(sale.id)}</Text>
                  <Text style={font.small}>
                    {formatDateTime(sale.created_at)} · {sale.items} {sale.items === 1 ? 'unidad' : 'unidades'}
                  </Text>
                </View>
                <Text style={styles.saleTotal}>{money(sale.total)}</Text>
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días 👋';
  if (h < 19) return 'Buenas tardes 👋';
  return 'Buenas noches 👋';
}

function HeroStat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.97 }] }]}>
      <IconCircle icon={icon} color={colors.primary} bg={colors.primarySoft} size={44} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function AlertTile({ icon, tone, value, label, detail }: { icon: IconName; tone: 'warning' | 'danger'; value: number; label: string; detail: string }) {
  const { colors, font } = useTheme();
  const fg = tone === 'warning' ? colors.warning : colors.danger;
  const bg = tone === 'warning' ? colors.warningSoft : colors.dangerSoft;
  return (
    <Card style={{ flex: 1, gap: spacing.sm }} onPress={() => router.push('/alerts')}>
      <IconCircle icon={icon} color={fg} bg={bg} size={36} />
      <Text style={[font.title, { fontSize: 26 }]}>{value}</Text>
      <View>
        <Text style={font.h3}>{label}</Text>
        <Text style={font.small}>{detail}</Text>
      </View>
    </Card>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 48 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
    bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
    bellDot: { position: 'absolute', top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.surface },
    hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, gap: 4 },
    heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
    heroValue: { color: colors.white, fontSize: 38, fontWeight: '800', letterSpacing: -1 },
    heroRow: { flexDirection: 'row', marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
    heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: spacing.md },
    heroStatValue: { color: colors.white, fontSize: 18, fontWeight: '800' },
    heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    action: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: spacing.sm, ...shadow },
    actionLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'center' },
    alertGrid: { flexDirection: 'row', gap: spacing.md },
    saleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    saleBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    saleTotal: { fontSize: 16, fontWeight: '800', color: colors.ink },
  }),
);
