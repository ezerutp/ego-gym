import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Button, Card, Chip, EmptyState, Field, SectionTitle } from '@/components/ui';
import { getSettings } from '@/db/settings';
import { session } from '@/features/auth/lib/session';
import { PaymentMethodPicker } from '@/features/payments/components/PaymentMethodPicker';
import type { PaymentMethod } from '@/features/payments/db/payments';
import { MemberAvatar } from '@/features/members/components/MemberBits';
import { fullName, getMember } from '@/features/members/db/members';
import { listCoaches } from '@/features/memberships/db/coaches';
import { describeDuration, listPlans, type Plan } from '@/features/memberships/db/plans';
import { createSubscription, getLatestSubscription } from '@/features/memberships/db/subscriptions';
import { describeRelativeDay, endDateFor, membershipState, renewalStart } from '@/features/memberships/lib/status';
import { formatDay, money, parseMoney } from '@/lib/format';
import { useIsWide } from '@/lib/layout';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';
import { rescheduleAlerts } from '@/lib/notifications';

async function loadEnrollData(db: SQLiteDatabase, memberId: number) {
  const [member, plans, coaches, latest, settings] = await Promise.all([
    getMember(db, memberId),
    listPlans(db),
    listCoaches(db),
    getLatestSubscription(db, memberId),
    getSettings(db),
  ]);
  return member ? { member, plans, coaches, latest, settings } : null;
}

type EnrollData = NonNullable<Awaited<ReturnType<typeof loadEnrollData>>>;

export default function EnrollScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { data } = useFocusQuery((db) => loadEnrollData(db, Number(memberId)), [memberId]);
  if (!data) return null;
  return <EnrollForm key={memberId} {...data} />;
}

function EnrollForm({ member, plans, coaches, latest, settings }: EnrollData) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const wide = useIsWide();
  const previousPlan = plans.find((p) => p.id === latest?.plan_id) ?? null;
  const [plan, setPlan] = useState<Plan | null>(previousPlan);
  const [start, setStart] = useState(renewalStart(latest?.end_date ?? null));
  const [end, setEnd] = useState(previousPlan ? endDateFor(start, previousPlan.duration_days) : null);
  const [price, setPrice] = useState(previousPlan && previousPlan.price > 0 ? String(previousPlan.price) : '');
  const [withPersonal, setWithPersonal] = useState(!!latest?.coach_id);
  const [coachId, setCoachId] = useState<number | null>(latest?.coach_id ?? null);
  const [personalPrice, setPersonalPrice] = useState(latest?.personal_price ? String(latest.personal_price) : '');
  const [notes, setNotes] = useState('');
  const [paidNow, setPaidNow] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [saving, setSaving] = useState(false);
  const current = membershipState(latest?.end_date ?? null, settings.membershipWarningDays);
  const total = (parseMoney(price) ?? 0) + (withPersonal ? (parseMoney(personalPrice) ?? 0) : 0);
  // Follows the total until the user types a different amount (a partial payment).
  const paidText = paidNow ?? (total > 0 ? String(total) : '');
  const paid = parseMoney(paidText) ?? 0;
  const pending = Math.max(Math.round((total - paid) * 100) / 100, 0);

  const choosePlan = (p: Plan) => {
    setPlan(p);
    setEnd(endDateFor(start, p.duration_days));
    setPrice(p.price > 0 ? String(p.price) : '');
  };

  const changeStart = (value: string | null) => {
    if (!value) return;
    setStart(value);
    if (plan) setEnd(endDateFor(value, plan.duration_days));
  };

  const save = async () => {
    const amount = parseMoney(price);
    const personalAmount = parseMoney(personalPrice);
    if (!plan || !end) return Alert.alert('Elige un plan', 'Selecciona el plan en el que se inscribe el cliente.');
    if (amount == null || amount < 0) return Alert.alert('Falta el precio', 'Escribe el precio acordado del plan.');
    if (end < start) return Alert.alert('Fechas inválidas', 'La fecha de fin no puede ser anterior al inicio.');
    if (withPersonal && !coachId) return Alert.alert('Elige un coach', 'Selecciona el coach del personalizado.');
    if (withPersonal && (personalAmount == null || personalAmount <= 0)) return Alert.alert('Falta el precio', 'Escribe el precio del personalizado.');
    if (paid > total) return Alert.alert('Monto mayor al total', `El pago no puede ser mayor a ${money(total)}.`);

    setSaving(true);
    try {
      const { paymentId } = await createSubscription(
        db,
        {
          memberId: member.id,
          planId: plan.id,
          planName: plan.name,
          startDate: start,
          endDate: end,
          price: amount,
          notes,
          personal: withPersonal && coachId ? { coachId, price: personalAmount! } : null,
          payment: paid > 0 ? { amount: paid, method } : null,
        },
        session.get()?.id ?? null,
      );
      rescheduleAlerts(db).catch(() => {});
      if (paymentId) router.replace({ pathname: '/payment/[id]', params: { id: paymentId, fresh: '1' } });
      else router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e));
    } finally {
      setSaving(false);
    }
  };

  const planPicker = (
    <View style={{ gap: spacing.md }}>
      <SectionTitle title="Plan" />
      {plans.length === 0 ? (
        <Card>
          <EmptyState icon="pricetags-outline" title="No hay planes activos" message="El administrador puede crearlos en Más → Planes." />
        </Card>
      ) : (
        <View style={styles.plans}>
          {plans.map((p) => {
            const selected = plan?.id === p.id;
            return (
              <Pressable key={p.id} onPress={() => choosePlan(p)} style={[styles.plan, selected && styles.planSelected]}>
                <Text style={[font.h3, selected && { color: colors.primaryDark }]}>{p.name}</Text>
                <Text style={font.small}>{describeDuration(p.duration_days)}</Text>
                <Text style={[styles.planPrice, p.price <= 0 && { color: colors.warning }]}>{p.price > 0 ? money(p.price) : 'Sin precio'}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  const details = (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.lg }}>
        <View style={styles.pair}>
          <View style={styles.half}>
            <DateField label="Inicio" value={start} onChange={changeStart} describe={describeRelativeDay} />
          </View>
          <View style={styles.half}>
            <DateField label="Fin" value={end} onChange={(v) => v && setEnd(v)} describe={describeRelativeDay} placeholder="Elige un plan" />
          </View>
        </View>
        <Field label="Precio acordado" prefix="S/" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
      </Card>

      <Card style={{ gap: spacing.lg }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={font.h3}>Personalizado con coach</Text>
            <Text style={font.small}>Se suma al precio y dura lo mismo que la membresía.</Text>
          </View>
          <Switch value={withPersonal} onValueChange={setWithPersonal} trackColor={{ true: colors.primary, false: colors.border }} />
        </View>
        {withPersonal &&
          (coaches.length === 0 ? (
            <Text style={font.small}>No hay coaches activos. El administrador puede registrarlos en Más → Coaches.</Text>
          ) : (
            <>
              <View style={styles.chips}>
                {coaches.map((c) => (
                  <Chip key={c.id} label={c.name} selected={coachId === c.id} onPress={() => setCoachId(c.id)} />
                ))}
              </View>
              <Field label="Precio del personalizado" prefix="S/" value={personalPrice} onChangeText={setPersonalPrice} keyboardType="decimal-pad" />
            </>
          ))}
      </Card>

      <Field label="Notas (opcional)" value={notes} onChangeText={setNotes} placeholder="Ej.: promo con su hermano" />

      <Card style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={font.small}>Total acordado</Text>
          <Text style={[font.title, { fontSize: 26 }]}>{money(total)}</Text>
          {plan && end && (
            <Text style={font.small}>
              {plan.name} del {formatDay(start)} al {formatDay(end)}
            </Text>
          )}
        </View>
      </Card>

      <Card style={{ gap: spacing.lg }}>
        <Text style={font.h3}>Pago ahora</Text>
        <Field
          label="Monto pagado"
          prefix="S/"
          value={paidText}
          onChangeText={setPaidNow}
          keyboardType="decimal-pad"
          hint={pending > 0 ? `Quedará una deuda de ${money(pending)}` : 'Pago completo'}
        />
        <PaymentMethodPicker value={method} onChange={setMethod} />
      </Card>
      <Button
        title={paid > 0 ? `${latest ? 'Renovar' : 'Inscribir'} y cobrar ${money(paid)}` : latest ? 'Renovar sin cobrar' : 'Inscribir sin cobrar'}
        icon="checkmark"
        loading={saving}
        onPress={save}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen options={{ title: latest ? 'Renovar membresía' : 'Inscribir en un plan' }} />
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} keyboardShouldPersistTaps="handled">
        <Card style={styles.memberCard}>
          <MemberAvatar member={member} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={font.h2}>{fullName(member)}</Text>
            <Text style={font.small}>
              {current.label} · {current.detail}
            </Text>
          </View>
        </Card>
        {wide ? (
          <View style={styles.columns}>
            <View style={styles.column}>{planPicker}</View>
            <View style={styles.column}>{details}</View>
          </View>
        ) : (
          <>
            {planPicker}
            {details}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 },
    contentWide: { padding: spacing.xl, width: '100%', maxWidth: 1100, alignSelf: 'center' },
    columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
    column: { flex: 1 },
    memberCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    plans: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    plan: {
      flexGrow: 1,
      flexBasis: 150,
      gap: 2,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    planSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    planPrice: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: spacing.sm },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    half: { flexGrow: 1, flexBasis: 200 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft },
  }),
);
