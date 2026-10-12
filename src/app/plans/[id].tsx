import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, Field, Stepper } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { describeDuration, getPlan, PLAN_KINDS, savePlan, type Plan, type PlanKind } from '@/features/memberships/db/plans';
import { parseMoney } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

const KINDS = Object.keys(PLAN_KINDS) as PlanKind[];
const DEFAULT_DAYS: Record<PlanKind, number> = { monthly: 30, alternate: 30, daily: 1, promo: 30, other: 30 };

export default function PlanScreen() {
  return (
    <AdminOnly>
      <PlanScreenContent />
    </AdminOnly>
  );
}

function PlanScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { data } = useFocusQuery(async (db) => (isNew ? null : await getPlan(db, Number(id))), [id]);
  if (!isNew && !data) return null;
  return <PlanForm key={id} plan={data ?? null} />;
}

function PlanForm({ plan }: { plan: Plan | null }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [name, setName] = useState(plan?.name ?? '');
  const [kind, setKind] = useState<PlanKind>(plan?.kind ?? 'monthly');
  const [price, setPrice] = useState(plan && plan.price > 0 ? String(plan.price) : '');
  const [days, setDays] = useState(plan?.duration_days ?? 30);
  const [active, setActive] = useState(plan ? plan.active === 1 : true);
  const [saving, setSaving] = useState(false);

  const chooseKind = (k: PlanKind) => {
    setKind(k);
    if (!plan) setDays(DEFAULT_DAYS[k]);
    if (!name.trim() || Object.values(PLAN_KINDS).some((p) => p.label === name)) setName(PLAN_KINDS[k].label);
  };

  const save = async () => {
    const amount = parseMoney(price);
    if (name.trim().length < 2) return Alert.alert('Falta el nombre', 'Escribe el nombre del plan.');
    if (amount == null || amount <= 0) return Alert.alert('Falta el precio', 'Escribe el precio del plan.');
    setSaving(true);
    try {
      await savePlan(db, plan?.id ?? null, { name, kind, price: amount, duration_days: days, active });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen options={{ title: plan ? plan.name : 'Nuevo plan' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.lg }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.chips}>
              {KINDS.map((k) => (
                <Chip key={k} label={PLAN_KINDS[k].label} selected={kind === k} onPress={() => chooseKind(k)} />
              ))}
            </View>
            <Text style={font.small}>{PLAN_KINDS[kind].hint}</Text>
          </View>
          <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej.: Mensual" />
          <Field label="Precio" prefix="S/" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>Duración</Text>
              <Text style={font.small}>{describeDuration(days)}</Text>
            </View>
            <Stepper value={days} onChange={setDays} min={1} max={365} />
          </View>
          {plan && (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>Activo</Text>
                <Text style={font.small}>Un plan inactivo ya no aparece al inscribir, pero se mantiene en las membresías pasadas.</Text>
              </View>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>
          )}
        </Card>
        <Button title={plan ? 'Guardar cambios' : 'Crear plan'} icon="checkmark" loading={saving} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  }),
);
