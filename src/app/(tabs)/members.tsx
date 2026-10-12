import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState } from '@/components/ui';
import { MemberDetail } from '@/features/members/components/MemberDetail';
import { MemberRow } from '@/features/members/components/MemberBits';
import { countMembersByStatus, listMembers, type MemberStatus } from '@/features/members/db/members';
import { useIsWide } from '@/lib/layout';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const FILTERS: { key: MemberStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'prospect', label: 'Prospectos' },
  { key: 'inactive', label: 'Inactivos' },
];

export default function MembersScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const wide = useIsWide();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MemberStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, reload } = useFocusQuery(
    async (db) => {
      const [members, counts] = await Promise.all([listMembers(db, { search, status: filter === 'all' ? undefined : filter }), countMembersByStatus(db)]);
      return { members, counts };
    },
    [search, filter],
  );

  const total = data ? data.counts.active + data.counts.prospect + data.counts.inactive : 0;
  const countFor = (key: MemberStatus | 'all') => (!data ? 0 : key === 'all' ? total : data.counts[key]);
  const openNew = () => router.push('/member/form');
  const open = (id: number) => (wide ? setSelectedId(id) : router.push({ pathname: '/member/[id]', params: { id } }));

  const list = (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={font.title}>Clientes</Text>
          <Text style={font.small}>
            {data ? `${data.counts.active} activos · ${data.counts.prospect} prospectos` : ' '}
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openNew}>
          <Ionicons name="person-add" size={22} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.faint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, DNI o celular"
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.faint} />
          </Pressable>
        )}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.filter, active && styles.filterActive]}>
                <Text style={[styles.filterText, active && { color: colors.white }]}>
                  {f.label} · {countFor(f.key)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={data?.members ?? []}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <MemberRow member={item} selected={wide && item.id === selectedId} onPress={() => open(item.id)} />}
        ListEmptyComponent={
          data ? (
            total === 0 ? (
              <EmptyState icon="people-outline" title="Aún no hay clientes" message="Registra a tus clientes y prospectos con su foto y datos de contacto.">
                <Button title="Registrar cliente" icon="person-add" onPress={openNew} style={{ marginTop: spacing.md }} />
              </EmptyState>
            ) : (
              <EmptyState icon="search-outline" title="Sin resultados" message="Prueba con otro nombre, DNI o filtro." />
            )
          ) : null
        }
      />
    </View>
  );

  if (!wide) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {list}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, styles.split]} edges={['top']}>
      <View style={styles.listPane}>{list}</View>
      <View style={styles.detailPane}>
        {selectedId ? (
          <MemberDetail
            key={selectedId}
            id={selectedId}
            onChanged={reload}
            onDeleted={() => {
              setSelectedId(null);
              reload();
            }}
          />
        ) : (
          <EmptyState icon="person-circle-outline" title="Elige un cliente" message="Toca un cliente de la lista para ver su ficha." />
        )}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    split: { flexDirection: 'row' },
    listPane: { width: 420, borderRightWidth: 1, borderRightColor: colors.border },
    detailPane: { flex: 1, justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, minHeight: 48, fontSize: 16, color: colors.ink },
    filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
    filter: {
      paddingHorizontal: spacing.lg,
      minHeight: 38,
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: 13, fontWeight: '700', color: colors.text },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: 48, gap: spacing.sm, flexGrow: 1 },
  }),
);
