import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductRow } from '@/components/ProductRow';
import { Button, EmptyState } from '@/components/ui';
import { listProducts } from '@/db/products';
import { getSettings } from '@/db/settings';
import { alertsForProduct } from '@/lib/alerts';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'low', label: 'Poco stock' },
  { key: 'expiry', label: 'Por vencer' },
  { key: 'noprice', label: 'Sin precio' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

export default function InventoryScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const { data } = useFocusQuery(async (db) => ({ products: await listProducts(db, search), settings: await getSettings(db) }), [search]);

  const products = useMemo(() => {
    if (!data) return [];
    return data.products.filter((p) => {
      if (filter === 'all') return true;
      if (filter === 'noprice') return p.price == null;
      const kinds = alertsForProduct(p, data.settings).map((a) => a.kind);
      if (filter === 'low') return kinds.includes('low_stock') || kinds.includes('out_of_stock');
      return kinds.includes('expiring') || kinds.includes('expired');
    });
  }, [data, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={font.title}>Almacén</Text>
          <Text style={font.small}>{data ? `${data.products.length} productos registrados` : ' '}</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => router.push({ pathname: '/scan', params: { mode: 'add' } })}>
          <Ionicons name="add" size={26} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.faint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, marca o código"
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && { color: colors.white }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={products.length ? styles.list : { flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <ProductRow product={item} settings={data!.settings} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })} />
        )}
        ListEmptyComponent={
          data ? (
            data.products.length === 0 && !search ? (
              <EmptyState icon="barcode-outline" title="Tu almacén está vacío" message="Escanea el código de barras de tus productos para empezar a registrarlos.">
                <Button title="Escanear producto" icon="scan" onPress={() => router.push({ pathname: '/scan', params: { mode: 'add' } })} style={{ marginTop: spacing.md }} />
              </EmptyState>
            ) : (
              <EmptyState icon="search" title="Sin resultados" message="No hay productos que coincidan con tu búsqueda o filtro." />
            )
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    addBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow },
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
    searchInput: { flex: 1, height: 48, fontSize: 15, color: colors.ink },
    chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
    list: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.xl },
    sep: { height: 1, backgroundColor: colors.border, marginLeft: 80 },
  }),
);
