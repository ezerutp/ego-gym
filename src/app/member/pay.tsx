import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field } from '@/components/ui';
import { session } from '@/features/auth/lib/session';
import { MemberAvatar } from '@/features/members/components/MemberBits';
import { fullName, getMember } from '@/features/members/db/members';
import { getSubscription } from '@/features/memberships/db/subscriptions';
import { PaymentMethodPicker } from '@/features/payments/components/PaymentMethodPicker';
import { insertPayment, type PaymentMethod } from '@/features/payments/db/payments';
import { formatDay, money, parseMoney } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';
import { rescheduleAlerts } from '@/lib/notifications';

async function loadPayData(db: SQLiteDatabase, subscriptionId: number) {
  const subscription = await getSubscription(db, subscriptionId);
  const member = subscription ? await getMember(db, subscription.member_id) : null;
  return subscription && member ? { subscription, member } : null;
}

type PayData = NonNullable<Awaited<ReturnType<typeof loadPayData>>>;

export default function PayScreen() {
  const { subscriptionId } = useLocalSearchParams<{ subscriptionId: string }>();
  const { data } = useFocusQuery((db) => loadPayData(db, Number(subscriptionId)), [subscriptionId]);
  if (!data) return null;
  return <PayForm key={subscriptionId} {...data} />;
}

function PayForm({ subscription: sub, member }: PayData) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const due = Math.max(Math.round((sub.total - sub.paid) * 100) / 100, 0);
  const [amount, setAmount] = useState(due > 0 ? String(due) : '');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const value = parseMoney(amount) ?? 0;

  const save = async () => {
    if (value <= 0) return Alert.alert('Falta el monto', 'Escribe cuánto está pagando el cliente.');
    if (value > due) return Alert.alert('Monto mayor a la deuda', `La deuda de esta membresía es ${money(due)}.`);
    setSaving(true);
    try {
      const paymentId = await insertPayment(
        db,
        { subscriptionId: sub.id, memberId: member.id, amount: value, method, notes },
        session.get()?.id ?? null,
      );
      rescheduleAlerts(db).catch(() => {});
      router.replace({ pathname: '/payment/[id]', params: { id: paymentId, fresh: '1' } });
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.memberCard}>
          <MemberAvatar member={member} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={font.h2}>{fullName(member)}</Text>
            <Text style={font.small}>
              {sub.plan_name} · {formatDay(sub.start_date)} al {formatDay(sub.end_date)}
            </Text>
          </View>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Line label="Total de la membresía" value={money(sub.total)} />
          <Line label="Pagado" value={money(sub.paid)} />
          <Line label="Deuda" value={money(due)} color={due > 0 ? colors.danger : colors.primary} bold />
        </Card>

        <Card style={{ gap: spacing.lg }}>
          <Field
            label="Monto a pagar"
            prefix="S/"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            hint={value > 0 && value < due ? `Quedará una deuda de ${money(due - value)}` : undefined}
          />
          <PaymentMethodPicker value={method} onChange={setMethod} />
          <Field label="Notas (opcional)" value={notes} onChangeText={setNotes} placeholder="Ej.: abono de la segunda quincena" />
        </Card>

        <Button title={value > 0 ? `Cobrar ${money(value)}` : 'Cobrar'} icon="cash" loading={saving} onPress={save} disabled={due <= 0} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Line({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  const { font } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={font.small}>{label}</Text>
      <Text style={[font.body, { fontWeight: bold ? '800' : '600' }, color && { color }]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' },
    memberCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  }),
);
