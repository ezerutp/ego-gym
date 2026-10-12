import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, IconCircle, SectionTitle, type IconName } from '@/components/ui';
import { getSettings } from '@/db/settings';
import { countMembersByStatus } from '@/features/members/db/members';
import { countMembershipAlerts } from '@/features/memberships/db/subscriptions';
import { countDebts, getTodayPayments } from '@/features/payments/db/payments';
import { getTodaySummary } from '@/features/store/db/sales';
import { addDays, money, todayIso } from '@/lib/format';
import { useIsWide } from '@/lib/layout';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

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
    return { settings, today, payments, members, memberships, debts };
  });

  if (!data) return <SafeAreaView style={styles.safe} />;
  const { settings, today, payments, members, memberships, debts } = data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} showsVerticalScrollIndicator={false}>
        <Text style={font.small}>{greeting()}</Text>
        <Text style={font.title} numberOfLines={1}>
          {settings.storeName}
        </Text>

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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    tile: { flexGrow: 1, flexBasis: 280, gap: spacing.sm },
  }),
);
