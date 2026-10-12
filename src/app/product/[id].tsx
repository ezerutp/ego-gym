import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Button, Card, Field, Pill, ProductThumb, SectionTitle, Stepper } from '@/components/ui';
import { adjustStock, deleteProduct, getProduct, listMovements, updateProduct } from '@/db/products';
import { getSettings } from '@/db/settings';
import { alertsForProduct, minStockFor } from '@/lib/alerts';
import { cart } from '@/lib/cart';
import { describeExpiry, formatDateTime, formatDay, money, parseMoney } from '@/lib/format';
import { notifyLowStock, rescheduleAlerts } from '@/lib/notifications';
import { persistLocalImage } from '@/lib/productLookup';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

export default function ProductDetailScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const db = useSQLiteContext();
  const { data, reload } = useFocusQuery(
    async (db) => {
      const [product, settings, movements] = await Promise.all([getProduct(db, id), getSettings(db), listMovements(db, id)]);
      return { product, settings, movements };
    },
    [id],
  );
  const [editing, setEditing] = useState(false);
  const [adjust, setAdjust] = useState(1);
  const [form, setForm] = useState({ name: '', brand: '', quantityLabel: '', price: '', minStock: '', expiry: null as string | null, image: null as string | null });

  if (!data) return null;
  const { product, settings, movements } = data;
  if (!product) {
    return (
      <View style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={font.h3}>Este producto ya no existe</Text>
      </View>
    );
  }

  const alerts = alertsForProduct(product, settings);

  const startEdit = () => {
    setForm({
      name: product.name,
      brand: product.brand ?? '',
      quantityLabel: product.quantity_label ?? '',
      price: product.price != null ? product.price.toFixed(2) : '',
      minStock: product.min_stock != null ? String(product.min_stock) : '',
      expiry: product.expiry_date,
      image: product.image_uri,
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Falta el nombre');
    const image = form.image && form.image !== product.image_uri ? await persistLocalImage(form.image, product.barcode) : form.image;
    await updateProduct(db, product.id, {
      name: form.name,
      brand: form.brand.trim() || null,
      quantity_label: form.quantityLabel.trim() || null,
      image_uri: image,
      price: parseMoney(form.price),
      min_stock: form.minStock ? parseInt(form.minStock, 10) : null,
      expiry_date: form.expiry,
    });
    setEditing(false);
    rescheduleAlerts(db).catch(() => {});
    reload();
  };

  const applyAdjust = async (sign: 1 | -1) => {
    await adjustStock(db, product.id, sign * adjust, sign > 0 ? 'ingreso' : 'salida / merma');
    if (sign < 0) notifyLowStock(db, [product.id]).catch(() => {});
    rescheduleAlerts(db).catch(() => {});
    setAdjust(1);
    reload();
  };

  const remove = () =>
    Alert.alert('Eliminar producto', `¿Seguro que quieres eliminar "${product.name}" de tu almacén?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          cart.remove(product.id);
          await deleteProduct(db, product.id);
          rescheduleAlerts(db).catch(() => {});
          router.back();
        },
      },
    ]);

  if (editing) {
    const set = (k: keyof typeof form) => (v: string | null) => setForm((f) => ({ ...f, [k]: v }));
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Editar producto' }} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={[styles.content, { gap: spacing.lg }]} keyboardShouldPersistTaps="handled">
            <PhotoPicker uri={form.image} onChange={set('image')} />
            <Field label="Nombre *" value={form.name} onChangeText={set('name')} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label="Marca" value={form.brand} onChangeText={set('brand')} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Presentación" value={form.quantityLabel} onChangeText={set('quantityLabel')} />
              </View>
            </View>
            <Field label="Precio de venta" prefix="S/" value={form.price} onChangeText={set('price')} keyboardType="decimal-pad" placeholder="0.00" />
            <Field
              label="Stock mínimo"
              value={form.minStock}
              onChangeText={(t) => set('minStock')(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder={`Por defecto: ${settings.lowStockThreshold}`}
            />
            <DateField label="Fecha de vencimiento" value={form.expiry} onChange={set('expiry')} />
          </ScrollView>
          <View style={styles.footer}>
            <Button title="Guardar cambios" icon="checkmark" onPress={save} />
            <Button title="Cancelar" variant="ghost" onPress={() => setEditing(false)} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={startEdit} hitSlop={10} style={styles.headerBtn}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Editar</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <ProductThumb uri={product.image_uri} size={120} />
          <Text style={[font.h2, { textAlign: 'center' }]}>{product.name}</Text>
          <Text style={font.small}>{[product.brand, product.quantity_label, product.barcode].filter(Boolean).join(' · ')}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {alerts.map((a) => (
              <Pill
                key={a.kind}
                tone={a.kind === 'low_stock' || a.kind === 'expiring' ? 'warning' : 'danger'}
                label={{ out_of_stock: 'Agotado', low_stock: 'Poco stock', expired: 'Vencido', expiring: describeExpiry(product.expiry_date!) }[a.kind]}
              />
            ))}
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label="En stock" value={String(product.stock)} highlight />
          <Stat label="Precio" value={money(product.price)} />
          <Stat label="Mínimo" value={String(minStockFor(product, settings))} />
        </View>
        {product.expiry_date && (
          <Card style={styles.expiryCard}>
            <Ionicons name="calendar" size={20} color={colors.muted} />
            <Text style={[font.body, { flex: 1 }]}>Vence el {formatDay(product.expiry_date)}</Text>
            <Text style={font.small}>{describeExpiry(product.expiry_date)}</Text>
          </Card>
        )}

        <SectionTitle title="Ajustar stock" />
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={font.body}>Cantidad</Text>
            <Stepper value={adjust} onChange={setAdjust} min={1} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Restar" icon="remove-circle-outline" variant="secondary" style={{ flex: 1 }} onPress={() => applyAdjust(-1)} />
            <Button title="Sumar" icon="add-circle-outline" style={{ flex: 1 }} onPress={() => applyAdjust(1)} />
          </View>
        </Card>

        <SectionTitle title="Movimientos" />
        <Card style={{ padding: 0 }}>
          {movements.length === 0 && <Text style={[font.small, { padding: spacing.lg }]}>Sin movimientos todavía.</Text>}
          {movements.map((m, i) => (
            <View key={m.id} style={[styles.movement, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Ionicons name={m.delta > 0 ? 'arrow-down-circle' : 'arrow-up-circle'} size={22} color={m.delta > 0 ? colors.primary : colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[font.body, { textTransform: 'capitalize' }]}>{m.reason}</Text>
                <Text style={font.small}>{formatDateTime(m.created_at)}</Text>
              </View>
              <Text style={{ fontWeight: '800', color: m.delta > 0 ? colors.primary : colors.warning }}>
                {m.delta > 0 ? `+${m.delta}` : m.delta}
              </Text>
            </View>
          ))}
        </Card>

        <Button title="Eliminar producto" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  return (
    <View style={[styles.stat, highlight && { backgroundColor: colors.primary }]}>
      <Text style={[styles.statValue, highlight && { color: colors.white }]}>{value}</Text>
      <Text style={[font.small, highlight && { color: 'rgba(255,255,255,0.8)' }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 48 },
    headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    stats: { flexDirection: 'row', gap: spacing.md },
    stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: 2 },
    statValue: { fontSize: 20, fontWeight: '800', color: colors.ink },
    expiryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
    movement: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    footer: { padding: spacing.lg, gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
