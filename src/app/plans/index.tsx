import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, IconCircle, Pill } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { describeDuration, listPlans, PLAN_KINDS } from '@/features/memberships/db/plans';
import { money } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function PlansScreen() {
  return (
    <AdminOnly>
      <PlansScreenContent />
    </AdminOnly>
  );
}

function PlansScreenContent() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const { data: plans } = useFocusQuery((db) => listPlans(db, { includeInactive: true }));
  const unpriced = plans?.filter((p) => p.active && p.price <= 0).length ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={font.small}>Los planes activos aparecen al inscribir a un cliente. El precio se puede ajustar en cada inscripción.</Text>
      {unpriced > 0 && (
        <Card style={styles.warning}>
          <Ionicons name="alert-circle" size={22} color={colors.warning} />
          <Text style={[font.small, { flex: 1, color: colors.ink }]}>
            {unpriced === 1 ? 'Hay 1 plan sin precio.' : `Hay ${unpriced} planes sin precio.`} Tócalos para ponerles precio.
          </Text>
        </Card>
      )}
      <Card style={{ padding: 0 }}>
        {plans?.map((plan, i) => (
          <Pressable
            key={plan.id}
            onPress={() => router.push({ pathname: '/plans/[id]', params: { id: plan.id } })}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.7 }, !plan.active && { opacity: 0.5 }]}
          >
            <IconCircle icon="pricetag" color={colors.primary} bg={colors.primarySoft} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={font.h3}>{plan.name}</Text>
              <Text style={font.small}>
                {PLAN_KINDS[plan.kind].label} · {describeDuration(plan.duration_days)}
              </Text>
            </View>
            {!plan.active ? <Pill label="Inactivo" /> : <Text style={[font.h3, plan.price <= 0 && { color: colors.warning }]}>{money(plan.price)}</Text>}
            <Ionicons name="chevron-forward" size={20} color={colors.faint} />
          </Pressable>
        ))}
      </Card>
      <Button title="Nuevo plan" icon="add" onPress={() => router.push({ pathname: '/plans/[id]', params: { id: 'new' } })} />
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
    warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.warningSoft },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
