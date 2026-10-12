import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, IconCircle, SectionTitle, type IconName } from '@/components/ui';
import { getSettings } from '@/db/settings';
import { MemberAlertRow, type MemberAlertKind } from '@/features/alerts/components/MemberAlertRow';
import { attentionCount, computeAttention, EXPIRED_LOOKBACK_DAYS } from '@/features/alerts/lib/attention';
import type { MemberListItem } from '@/features/members/db/members';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function NotificationsScreen() {
  const styles = useStyles();
  const { font } = useTheme();
  const { data } = useFocusQuery(async (db) => {
    const settings = await getSettings(db);
    return { settings, attention: await computeAttention(db, settings) };
  });
  if (!data) return null;
  const { settings, attention: a } = data;
  const lowStock = a.store.outOfStock.length + a.store.lowStock.length;
  const productExpiry = a.store.expired.length + a.store.expiring.length;

  if (attentionCount(a) === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState icon="checkmark-done-circle-outline" title="Todo al día" message="No hay membresías por vencer, deudas ni alertas del almacén." />
      </View>
    );
  }

  const section = (title: string, kind: MemberAlertKind, members: MemberListItem[]) =>
    members.length > 0 && (
      <>
        <SectionTitle title={`${title} (${members.length})`} />
        <View style={{ gap: spacing.sm }}>
          {members.map((m) => (
            <MemberAlertRow key={m.id} member={m} kind={kind} settings={settings} />
          ))}
        </View>
      </>
    );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {section('Membresías por vencer', 'expiring', a.expiring)}
      {section('Deudas', 'debt', a.debts)}
      {section(`Vencidas en los últimos ${EXPIRED_LOOKBACK_DAYS} días`, 'expired', a.expired)}

      {lowStock + productExpiry > 0 && (
        <>
          <SectionTitle title="Tienda" />
          <Card style={{ padding: 0 }}>
            {lowStock > 0 && (
              <StoreRow icon="trending-down" tone="warning" title={`${lowStock} con poco stock`} detail={`${a.store.outOfStock.length} agotados`} />
            )}
            {productExpiry > 0 && (
              <StoreRow icon="time" tone="danger" title={`${productExpiry} por vencer o vencidos`} detail={`${a.store.expired.length} vencidos`} border={lowStock > 0} />
            )}
          </Card>
        </>
      )}
      <Text style={[font.small, { marginTop: spacing.lg }]}>
        Toca el botón de WhatsApp para enviar un recordatorio ya escrito al cliente.
      </Text>
    </ScrollView>
  );
}

function StoreRow({ icon, tone, title, detail, border }: { icon: IconName; tone: 'warning' | 'danger'; title: string; detail: string; border?: boolean }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  return (
    <Pressable onPress={() => router.navigate('/store/alerts')} style={({ pressed }) => [styles.storeRow, border && styles.border, pressed && { opacity: 0.7 }]}>
      <IconCircle icon={icon} color={tone === 'warning' ? colors.warning : colors.danger} bg={tone === 'warning' ? colors.warningSoft : colors.dangerSoft} />
      <View style={{ flex: 1 }}>
        <Text style={font.h3}>{title}</Text>
        <Text style={font.small}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' },
    empty: { flex: 1, justifyContent: 'center', padding: spacing.lg },
    storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    border: { borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
