import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, Field, ProductThumb, SectionTitle, Stepper } from '@/components/ui';
import { listProducts } from '@/db/products';
import { createSale } from '@/db/sales';
import { cart, cartCount, cartTotal, useCart } from '@/lib/cart';
import { money, parseMoney } from '@/lib/format';
import { notifyLowStock, rescheduleAlerts } from '@/lib/notifications';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

export default function SellScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const items = useCart();
  const [customer, setCustomer] = useState('');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: matches } = useFocusQuery(async (db) => (query.trim().length >= 2 ? listProducts(db, query) : []), [query]);

  const total = cartTotal(items);
  const missingPrice = items.some((l) => l.unitPrice <= 0);

  const checkout = async () => {
    if (missingPrice) return Alert.alert('Faltan precios', 'Hay productos sin precio. Tócalos para ingresar el precio de venta.');
    setSaving(true);
    try {
      const saleId = await createSale(db, items, customer);
      const ids = items.map((l) => l.productId);
      cart.clear();
      setCustomer('');
      notifyLowStock(db, ids).catch(() => {});
      rescheduleAlerts(db).catch(() => {});
      router.push({ pathname: '/receipt/[id]', params: { id: saleId, fresh: '1' } });
    } catch (e) {
      Alert.alert('No se pudo registrar la venta', String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={font.title}>Nueva venta</Text>
            <Text style={font.small}>{items.length ? `${cartCount(items)} unidades en el carrito` : 'Escanea o busca productos'}</Text>
          </View>
          {items.length > 0 && (
            <Pressable
              hitSlop={8}
              onPress={() => Alert.alert('Vaciar carrito', '¿Quitar todos los productos?', [{ text: 'No' }, { text: 'Vaciar', style: 'destructive', onPress: cart.clear }])}
            >
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Vaciar</Text>
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.scanCard} onPress={() => router.push({ pathname: '/scan', params: { mode: 'sell' } })}>
            <View style={styles.scanIcon}>
              <Ionicons name="scan" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { color: colors.white }]}>Escanear productos</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Escanea uno tras otro sin cerrar la cámara</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.white} />
          </Pressable>

          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.faint} />
            <TextInput value={query} onChangeText={setQuery} placeholder="O busca por nombre…" placeholderTextColor={colors.faint} style={styles.searchInput} />
          </View>
          {matches && matches.length > 0 && (
            <Card style={{ padding: 0, marginTop: spacing.sm }}>
              {matches.slice(0, 6).map((p, i) => (
                <Pressable
                  key={p.id}
                  style={[styles.match, i > 0 && styles.border]}
                  onPress={() => {
                    if (!cart.add(p)) return Alert.alert('Sin stock', `No queda stock disponible de ${p.name}.`);
                    setQuery('');
                  }}
                >
                  <ProductThumb uri={p.image_uri} size={36} />
                  <Text style={[font.body, { flex: 1 }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={font.small}>Stock {p.stock}</Text>
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                </Pressable>
              ))}
            </Card>
          )}

          {items.length === 0 ? (
            <EmptyState icon="cart-outline" title="El carrito está vacío" message="Los productos que escanees aparecerán aquí con su precio y cantidad." />
          ) : (
            <>
              <SectionTitle title="Carrito" />
              <Card style={{ padding: 0 }}>
                {items.map((line, i) => (
                  <View key={line.productId} style={[styles.line, i > 0 && styles.border]}>
                    <ProductThumb uri={line.imageUri} size={48} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={font.h3} numberOfLines={2}>
                        {line.name}
                      </Text>
                      <PriceInput value={line.unitPrice} onChange={(v) => cart.setPrice(line.productId, v)} />
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Stepper value={line.quantity} onChange={(q) => cart.setQuantity(line.productId, q)} max={line.maxStock} />
                      <Text style={styles.lineTotal}>{money(line.unitPrice * line.quantity)}</Text>
                    </View>
                  </View>
                ))}
              </Card>
              <View style={{ marginTop: spacing.lg }}>
                <Field label="Cliente (opcional)" value={customer} onChangeText={setCustomer} placeholder="Nombre del cliente" />
              </View>
            </>
          )}
        </ScrollView>

        {items.length > 0 && (
          <View style={styles.checkout}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={font.body}>Total a cobrar</Text>
              <Text style={styles.total}>{money(total)}</Text>
            </View>
            <Button title="Cobrar y generar boleta" icon="receipt" loading={saving} onPress={checkout} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Price stays editable in the cart so products registered without price can still be sold. */
function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const [text, setText] = useState(value > 0 ? value.toFixed(2) : '');
  const missing = value <= 0;
  return (
    <View style={[styles.priceBox, missing && { borderColor: colors.warning, backgroundColor: colors.warningSoft }]}>
      <Text style={{ color: colors.muted, fontWeight: '600' }}>S/</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          onChange(parseMoney(t) ?? 0);
        }}
        placeholder="Precio"
        placeholderTextColor={colors.warning}
        keyboardType="decimal-pad"
        style={styles.priceInput}
      />
      <Text style={font.small}>c/u</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    scanCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
    scanIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, height: 46, fontSize: 15, color: colors.ink },
    match: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
    border: { borderTopWidth: 1, borderTopColor: colors.border },
    line: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center' },
    lineTotal: { fontSize: 15, fontWeight: '800', color: colors.ink },
    priceBox: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 8 },
    priceInput: { minWidth: 56, height: 34, fontSize: 14, fontWeight: '700', color: colors.ink, paddingVertical: 0 },
    checkout: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadow, elevation: 10 },
    total: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  }),
);
