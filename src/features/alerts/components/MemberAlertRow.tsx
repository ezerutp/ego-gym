import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Settings } from '@/db/settings';
import { debtMessage, expiredMessage, expiringMessage } from '@/features/alerts/lib/messages';
import { MemberAvatar } from '@/features/members/components/MemberBits';
import { fullName, type MemberListItem } from '@/features/members/db/members';
import { openWhatsApp } from '@/features/members/lib/contact';
import { membershipState } from '@/features/memberships/lib/status';
import { getOldestDueSubscription } from '@/features/payments/db/payments';
import { money } from '@/lib/format';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

export type MemberAlertKind = 'expiring' | 'expired' | 'debt';

type Props = { member: MemberListItem; kind: MemberAlertKind; settings: Settings };

export function MemberAlertRow({ member, kind, settings }: Props) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const end = member.membership_end;
  const detail = kind === 'debt' ? `Debe ${money(member.debt)}` : membershipState(end, settings.membershipWarningDays).detail;
  const tone = kind === 'expiring' ? colors.warning : colors.danger;

  const whatsapp = async () => {
    const text =
      kind === 'debt' ? debtMessage(member, member.debt, settings) : kind === 'expired' ? expiredMessage(member, end!, settings) : expiringMessage(member, end!, settings);
    if (!(await openWhatsApp(member.phone, text))) {
      Alert.alert('Sin número', `${fullName(member)} no tiene un celular registrado.`);
    }
  };

  const act = async () => {
    if (kind === 'debt') {
      const due = await getOldestDueSubscription(db, member.id);
      if (due) router.push({ pathname: '/member/pay', params: { subscriptionId: due.id } });
    } else {
      router.push({ pathname: '/member/enroll', params: { memberId: member.id } });
    }
  };

  return (
    <Pressable onPress={() => router.push({ pathname: '/member/[id]', params: { id: member.id } })} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      <MemberAvatar member={member} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={font.h3} numberOfLines={1}>
          {fullName(member)}
        </Text>
        <Text style={[font.small, { color: tone, fontWeight: '600' }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Pressable onPress={whatsapp} hitSlop={6} style={[styles.iconBtn, { backgroundColor: colors.whatsappSoft }]}>
        <Ionicons name="logo-whatsapp" size={22} color={colors.whatsappDark} />
      </Pressable>
      <Pressable onPress={act} hitSlop={6} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
        <Ionicons name={kind === 'debt' ? 'cash' : 'refresh'} size={18} color={colors.white} />
        <Text style={styles.actionText}>{kind === 'debt' ? 'Cobrar' : 'Renovar'}</Text>
      </Pressable>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: spacing.md, borderRadius: 22 },
    actionText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  }),
);
