import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, IconCircle, SectionTitle, type IconName } from '@/components/ui';
import { getSettings } from '@/db/settings';
import { countMembersByStatus } from '@/features/members/db/members';
import { countMembershipAlerts } from '@/features/memberships/db/subscriptions';
import { countDebts, getTodayPayments } from '@/features/payments/db/payments';
import { MemberAlertRow } from '@/features/alerts/components/MemberAlertRow';
import { attentionCount, computeAttention } from '@/features/alerts/lib/attention';
import { getTodaySummary } from '@/features/store/db/sales';
import { addDays, money, todayIso } from '@/lib/format';
import { useIsWide } from '@/lib/layout';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const HIGHLIGHTS = 5;

export default function HomeScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const wide = useIsWide();
  const { data } = useFocusQuery(async (db) => {
    const settings = await getSettings(db);
    const day = todayIso();
    const [today, payments, members, memberships, debts] = await Promise.all([
      getTodaySummary(db),
      getTodayPayments(db),
      countMembersByStatus(db),
      countMembershipAlerts(db, day, addDays(day, settings.membershipWarningDays)),
      countDebts(db),
    ]);
    const attention = await computeAttention(db, settings);
    return { settings, today, payments, members, memberships, debts, attention };
  });

  if (!data) return <SafeAreaView style={styles.safe} />;
  const { settings, today, payments, members, memberships, debts, attention } = data;
  const pending = attentionCount(attention);
  const highlights = [
    ...attention.expiring.map((m) => ({ m, kind: 'expiring' as const })),
    ...attention.debts.map((m) => ({ m, kind: 'debt' as const })),
    ...attention.expired.map((m) => ({ m, kind: 'expired' as const })),
  ].slice(0, HIGHLIGHTS);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={font.small}>{greeting()}</Text>
            <Text style={font.title} numberOfLines={1}>
              {settings.storeName}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={styles.bell} hitSlop={8}>
            <Ionicons name="notifications-outline" size={24} color={colors.ink} />
            {pending > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pending > 99 ? '99+' : pending}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <SectionTitle title="Accesos rápidos" />
        <View style={styles.actions}>
          <QuickAction icon="person-add" label="Nuevo cliente" onPress={() => router.push('/member/form')} />
          <QuickAction icon="card" label="Cobrar membresía" onPress={() => router.push('/charge')} />
          <QuickAction icon="cart" label="Nueva venta" onPress={() => router.push({ pathname: '/scan', params: { mode: 'sell' } })} />
          <QuickAction icon="add-circle" label="Ingresar productos" onPress={() => router.push({ pathname: '/scan', params: { mode: 'add' } })} />
        </View>

        <SectionTitle title="Hoy" />
        <View style={styles.grid}>
          <Card style={styles.tile}>
            <IconCircle icon="wallet" color={colors.primary} bg={colors.primarySoft} />
            <Text style={[font.title, { fontSize: 26 }]}>{money(today.total + payments.total)}</Text>
            <Text style={font.small}>
              Ingresos de hoy · Membresías {money(payments.total)} · Tienda {money(today.total)}
            </Text>
          </Card>
          <Card style={styles.tile} onPress={() => router.navigate('/members')}>
            <IconCircle icon="people" color={colors.info} bg={colors.infoSoft} />
            <Text style={[font.title, { fontSize: 26 }]}>{members.active}</Text>
            <Text style={font.small}>
              Clientes activos · {members.prospect} {members.prospect === 1 ? 'prospecto' : 'prospectos'}
            </Text>
          </Card>
          <Card style={styles.tile} onPress={() => router.navigate('/members')}>
            <IconCircle icon="time" color={colors.warning} bg={colors.warningSoft} />
            <Text style={[font.title, { fontSize: 26 }]}>{memberships.expiring}</Text>
            <Text style={font.small}>
              Por vencer en {settings.membershipWarningDays} días · {memberships.expired} {memberships.expired === 1 ? 'vencida' : 'vencidas'}
            </Text>
          </Card>
          <Card style={styles.tile} onPress={() => router.navigate('/members')}>
            <IconCircle icon="alert-circle" color={colors.danger} bg={colors.dangerSoft} />
            <Text style={[font.title, { fontSize: 26 }]}>{money(debts.total)}</Text>
            <Text style={font.small}>
              Deudas · {debts.members} {debts.members === 1 ? 'cliente' : 'clientes'}
            </Text>
          </Card>
        </View>

        <SectionTitle title="Requiere atención" action={pending > 0 ? 'Ver todo' : undefined} onAction={() => router.push('/notifications')} />
        {highlights.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {highlights.map(({ m, kind }) => (
              <MemberAlertRow key={`${kind}-${m.id}`} member={m} kind={kind} settings={settings} />
            ))}
          </View>
        ) : (
          <Card style={styles.allGood}>
            <IconCircle icon="checkmark-done" color={colors.primary} bg={colors.primarySoft} />
            <Text style={[font.body, { flex: 1 }]}>
              {pending > 0 ? 'Los clientes están al día. Revisa las alertas de la tienda.' : 'Todo al día: sin membresías por vencer ni deudas.'}
            </Text>
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

function QuickAction({ icon, label, onPress, soon }: { icon: IconName; label: string; onPress?: () => void; soon?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={soon}
      style={({ pressed }) => [styles.action, soon && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <IconCircle icon={icon} color={colors.primary} bg={colors.primarySoft} size={48} />
      <Text style={styles.actionLabel}>{label}</Text>
      {soon && <Text style={styles.soon}>Próximamente</Text>}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 48 },
    contentWide: { padding: spacing.xxl, width: '100%', maxWidth: 1080, alignSelf: 'center' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    action: {
      flexGrow: 1,
      flexBasis: 150,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      ...shadow,
    },
    actionLabel: { fontSize: 14, fontWeight: '700', color: colors.ink, textAlign: 'center' },
    soon: { fontSize: 11, fontWeight: '600', color: colors.muted },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    bell: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
    allGood: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    tile: { flexGrow: 1, flexBasis: 280, gap: spacing.sm },
  }),
);
