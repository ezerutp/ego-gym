import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Pill, SectionTitle } from '@/components/ui';
import { getSettings } from '@/db/settings';
import { useCan } from '@/features/auth/lib/session';
import { deleteSubscription, listMemberSubscriptions, type Subscription } from '@/features/memberships/db/subscriptions';
import { deletePayment, listMemberPayments, PAYMENT_METHODS, paymentReceiptNumber, type Payment } from '@/features/payments/db/payments';
import { membershipState, type MembershipKind } from '@/features/memberships/lib/status';
import { formatDateTime, formatDay, money } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';
import { rescheduleAlerts } from '@/lib/notifications';

export const MEMBERSHIP_TONES: Record<MembershipKind, 'success' | 'warning' | 'danger' | 'neutral'> = {
  current: 'success',
  expiring: 'warning',
  expired: 'danger',
  none: 'neutral',
};

export function MembershipCard({ memberId, onChanged }: { memberId: number; onChanged?: () => void }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const canDelete = useCan('delete_records');
  const { data, reload } = useFocusQuery(
    async (db) => {
      const [subscriptions, payments, settings] = await Promise.all([
        listMemberSubscriptions(db, memberId),
        listMemberPayments(db, memberId),
        getSettings(db),
      ]);
      return { subscriptions, payments, warningDays: settings.membershipWarningDays };
    },
    [memberId],
  );
  if (!data) return null;

  const [latest, ...history] = data.subscriptions;
  const state = membershipState(latest?.end_date ?? null, data.warningDays);
  const enroll = () => router.push({ pathname: '/member/enroll', params: { memberId } });
  const pay = (sub: Subscription) => router.push({ pathname: '/member/pay', params: { subscriptionId: sub.id } });
  const totalDue = data.subscriptions.reduce((sum, sub) => sum + dueOf(sub), 0);

  const removePayment = (payment: Payment) =>
    Alert.alert('Anular pago', `¿Anular el pago ${paymentReceiptNumber(payment.id)} de ${money(payment.amount)}? La deuda volverá a aparecer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          await deletePayment(db, payment.id);
          rescheduleAlerts(db).catch(() => {});
          reload();
          onChanged?.();
        },
      },
    ]);

  const remove = (sub: Subscription) =>
    Alert.alert('Anular membresía', `¿Anular ${sub.plan_name} del ${formatDay(sub.start_date)} al ${formatDay(sub.end_date)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          await deleteSubscription(db, sub.id);
          rescheduleAlerts(db).catch(() => {});
          reload();
          onChanged?.();
        },
      },
    ]);

  return (
    <>
      <SectionTitle title="Membresía" />
      <Card style={{ gap: spacing.md }}>
        <View style={styles.headRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={font.h2}>{latest ? latest.plan_name : 'Sin membresía'}</Text>
            <Text style={font.small}>{state.detail}</Text>
          </View>
          <Pill label={state.label} tone={MEMBERSHIP_TONES[state.kind]} />
        </View>
        {latest && <PeriodDetails sub={latest} />}
        {totalDue > 0 && (
          <View style={styles.debt}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={[font.body, { flex: 1, color: colors.danger, fontWeight: '700' }]}>Debe {money(totalDue)}</Text>
          </View>
        )}
        <View style={styles.buttons}>
          {totalDue > 0 && (
            <Button
              title="Registrar pago"
              icon="cash"
              onPress={() => pay(data.subscriptions.filter((s) => dueOf(s) > 0).at(-1)!)}
              style={styles.button}
            />
          )}
          <Button
            title={latest ? 'Renovar membresía' : 'Inscribir en un plan'}
            icon={latest ? 'refresh' : 'add-circle'}
            variant={totalDue > 0 ? 'secondary' : 'primary'}
            onPress={enroll}
            style={styles.button}
          />
        </View>
      </Card>

      {data.subscriptions.length > 0 && (
        <>
          <SectionTitle title="Historial" />
          <Card style={{ padding: 0 }}>
            {[latest, ...history].map((sub, i) => (
              <View key={sub.id} style={[styles.historyRow, i > 0 && styles.border]}>
                <View style={{ flex: 1 }}>
                  <Text style={font.h3}>{sub.plan_name}</Text>
                  <Text style={font.small}>
                    {formatDay(sub.start_date)} – {formatDay(sub.end_date)}
                    {sub.coach_name ? ` · Personalizado con ${sub.coach_name}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={font.h3}>{money(sub.total)}</Text>
                  {dueOf(sub) > 0 && (
                    <Text onPress={() => pay(sub)} style={[font.small, { color: colors.danger, fontWeight: '700' }]}>
                      Debe {money(dueOf(sub))}
                    </Text>
                  )}
                </View>
                {canDelete && (
                  <Pressable onPress={() => remove(sub)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            ))}
          </Card>
        </>
      )}

      {data.payments.length > 0 && (
        <>
          <SectionTitle title="Pagos" />
          <Card style={{ padding: 0 }}>
            {data.payments.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => router.push({ pathname: '/payment/[id]', params: { id: p.id } })}
                style={({ pressed }) => [styles.historyRow, i > 0 && styles.border, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={font.h3}>{paymentReceiptNumber(p.id)}</Text>
                  <Text style={font.small}>
                    {formatDateTime(p.created_at)} · {PAYMENT_METHODS[p.method]} · {p.plan_name}
                  </Text>
                </View>
                <Text style={font.h3}>{money(p.amount)}</Text>
                {canDelete && (
                  <Pressable onPress={() => removePayment(p)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                )}
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

function dueOf(sub: Subscription) {
  return Math.max(Math.round((sub.total - sub.paid) * 100) / 100, 0);
}

function PeriodDetails({ sub }: { sub: Subscription }) {
  const styles = useStyles();
  const { font } = useTheme();
  return (
    <View style={styles.details}>
      <Detail label="Periodo" value={`${formatDay(sub.start_date)} – ${formatDay(sub.end_date)}`} />
      <Detail label="Precio del plan" value={money(sub.price)} />
      {sub.coach_name && <Detail label="Personalizado" value={`${sub.coach_name} · ${money(sub.personal_price)}`} />}
      <Detail label="Pagado" value={`${money(sub.paid)} de ${money(sub.total)}`} />
      {sub.notes && <Text style={font.small}>{sub.notes}</Text>}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { font } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Text style={font.small}>{label}</Text>
      <Text style={[font.body, { fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    details: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    debt: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    button: { flexGrow: 1, flexBasis: 180 },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    border: { borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
