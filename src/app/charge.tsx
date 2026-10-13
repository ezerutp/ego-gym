import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, EmptyState, IconCircle, SectionTitle } from '@/components/ui';
import { getSettings } from '@/db/settings';
import { MemberRow } from '@/features/members/components/MemberBits';
import { listMembers, type MemberListItem } from '@/features/members/db/members';
import { getOldestDueSubscription } from '@/features/payments/db/payments';
import { TourTarget } from '@/features/tour/components/TourTarget';
import { useAutoTour } from '@/features/tour/lib/useAutoTour';
import { todayIso } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

/** Debts first, then memberships that already ended, then everyone else alphabetically. */
function priority(m: MemberListItem, today: string) {
  if (m.debt > 0) return 0;
  if (m.status === 'active' && (!m.membership_end || m.membership_end < today)) return 1;
  return 2;
}

export default function ChargeScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [search, setSearch] = useState('');
  useAutoTour('charge');
  const { data } = useFocusQuery(
    async (db) => {
      const [members, settings] = await Promise.all([listMembers(db, { search }), getSettings(db)]);
      return { members, warningDays: settings.membershipWarningDays };
    },
    [search],
  );

  const members = useMemo(() => {
    const today = todayIso();
    return [...(data?.members ?? [])].sort((a, b) => priority(a, today) - priority(b, today));
  }, [data]);

  const chargeMember = async (member: MemberListItem) => {
    const due = member.debt > 0 ? await getOldestDueSubscription(db, member.id) : null;
    if (due) router.push({ pathname: '/member/pay', params: { subscriptionId: due.id } });
    else router.push({ pathname: '/member/enroll', params: { memberId: member.id } });
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={members}
        keyExtractor={(m) => String(m.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <TourTarget id="charge-store">
              <Pressable
                onPress={() => router.replace({ pathname: '/scan', params: { mode: 'sell' } })}
                style={({ pressed }) => [styles.option, pressed && { opacity: 0.8 }]}
              >
                <IconCircle icon="cart" color={colors.white} bg={colors.primary} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={font.h2}>Venta de la tienda</Text>
                  <Text style={font.small}>Escanea los productos y genera la boleta</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.faint} />
              </Pressable>
            </TourTarget>

            <SectionTitle title="Membresía: elige al cliente" />
            <Text style={font.small}>Si tiene deuda, se registra un abono; si no, se renueva o inscribe en un plan.</Text>
            <TourTarget id="charge-members" style={styles.search}>
              <Ionicons name="search" size={20} color={colors.faint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por nombre, DNI o celular"
                placeholderTextColor={colors.faint}
                style={styles.searchInput}
              />
            </TourTarget>
          </View>
        }
        renderItem={({ item }) => <MemberRow member={item} warningDays={data?.warningDays} onPress={() => chargeMember(item)} />}
        ListEmptyComponent={
          data ? (
            <Card>
              <EmptyState icon="people-outline" title="Sin clientes" message="Registra al cliente en la pestaña Clientes para cobrarle." />
            </Card>
          ) : null
        }
      />
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      ...shadow,
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },
    searchInput: { flex: 1, minHeight: 48, fontSize: 16, color: colors.ink },
  }),
);
