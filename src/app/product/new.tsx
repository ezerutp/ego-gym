import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/DateField';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Button, Card, Field, IconCircle, Pill, ProductThumb, Stepper } from '@/components/ui';
import { adjustStock, createProduct, getProductByBarcode, updateProduct, type Product } from '@/db/products';
import { getSettings } from '@/db/settings';
import { money, parseMoney } from '@/lib/format';
import { rescheduleAlerts } from '@/lib/notifications';
import { downloadProductImage, lookupBarcode, persistLocalImage, type RemoteProduct } from '@/lib/productLookup';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

type Step = { kind: 'loading' } | { kind: 'existing'; product: Product } | { kind: 'found'; remote: RemoteProduct } | { kind: 'form' };

export default function NewProductScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const db = useSQLiteContext();
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [notFound, setNotFound] = useState<'none' | 'not_found' | 'no_sources'>('none');

  // Form state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantityLabel, setQuantityLabel] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [source, setSource] = useState<Product['source']>('manual');
  const [detailsLocked, setDetailsLocked] = useState(false);
  const [units, setUnits] = useState(1);
  const [price, setPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [expiry, setExpiry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await getProductByBarcode(db, code);
      if (cancelled) return;
      if (existing) {
        setPrice(existing.price != null ? existing.price.toFixed(2) : '');
        setExpiry(existing.expiry_date);
        return setStep({ kind: 'existing', product: existing });
      }
      const { productSources } = await getSettings(db);
      if (cancelled) return;
      if (productSources.length === 0) {
        setNotFound('no_sources');
        return setStep({ kind: 'form' });
      }
      const remote = await lookupBarcode(code, productSources);
      if (cancelled) return;
      if (remote) return setStep({ kind: 'found', remote });
      setNotFound('not_found');
      setStep({ kind: 'form' });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, code]);

  const acceptRemote = (remote: RemoteProduct, locked: boolean) => {
    setName(remote.name);
    setBrand(remote.brand ?? '');
    setQuantityLabel(remote.quantityLabel ?? '');
    setImageUri(remote.imageUrl);
    setSource(remote.source);
    setDetailsLocked(locked);
    setStep({ kind: 'form' });
  };

  const finish = (productId: number) => {
    rescheduleAlerts(db).catch(() => {});
    Alert.alert('¡Listo!', 'El producto se guardó en tu almacén.', [
      { text: 'Ver producto', onPress: () => router.replace({ pathname: '/product/[id]', params: { id: productId } }) },
      { text: 'Escanear otro', onPress: () => router.replace({ pathname: '/scan', params: { mode: 'add' } }) },
    ]);
  };

  const saveNew = async () => {
    if (!name.trim()) return Alert.alert('Falta el nombre', 'Escribe el nombre del producto.');
    setSaving(true);
    try {
      let storedImage = imageUri;
      if (imageUri?.startsWith('http')) storedImage = await downloadProductImage(imageUri, code);
      else if (imageUri) storedImage = await persistLocalImage(imageUri, code);

      const id = await createProduct(db, {
        barcode: code,
        name,
        brand: brand.trim() || null,
        quantity_label: quantityLabel.trim() || null,
        image_uri: storedImage,
        price: parseMoney(price),
        stock: units,
        min_stock: minStock ? parseInt(minStock, 10) : null,
        expiry_date: expiry,
        source,
      });
      finish(id);
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e));
    } finally {
      setSaving(false);
    }
  };

  const restock = async (product: Product) => {
    setSaving(true);
    try {
      await adjustStock(db, product.id, units, 'ingreso');
      await updateProduct(db, product.id, { ...product, price: parseMoney(price), expiry_date: expiry });
      finish(product.id);
    } finally {
      setSaving(false);
    }
  };

  if (step.kind === 'loading') {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: 'Buscando…' }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={font.h3}>Buscando el producto</Text>
        <Text style={font.small}>Código {code}</Text>
      </View>
    );
  }

  if (step.kind === 'found') {
    const r = step.remote;
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Producto encontrado' }} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.foundHeader}>
            <IconCircle icon="sparkles" color={colors.primary} bg={colors.primarySoft} size={48} />
            <Text style={[font.h2, { textAlign: 'center' }]}>Encontré esta información</Text>
            <Text style={[font.small, { textAlign: 'center' }]}>¿Es correcto este producto?</Text>
          </View>
          <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <View style={styles.foundImage}>
              {r.imageUrl ? (
                <Image source={{ uri: r.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" transition={200} />
              ) : (
                <Ionicons name="image-outline" size={48} color={colors.faint} />
              )}
            </View>
            <Text style={[font.h2, { textAlign: 'center' }]}>{r.name}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
              {r.brand && <Pill label={r.brand} tone="success" />}
              {r.quantityLabel && <Pill label={r.quantityLabel} />}
              <Pill label={code} icon="barcode-outline" />
            </View>
          </Card>
          <Text style={[font.small, { textAlign: 'center' }]}>Fuente: {r.sourceName}</Text>
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Sí, es correcto" icon="checkmark" onPress={() => acceptRemote(r, true)} />
          <Button title="No, quiero editarlo" icon="create-outline" variant="secondary" onPress={() => acceptRemote(r, false)} />
        </View>
      </SafeAreaView>
    );
  }

  const existing = step.kind === 'existing' ? step.product : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Ingreso de stock' : 'Nuevo producto' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {existing ? (
            <Card style={styles.summary}>
              <ProductThumb uri={existing.image_uri} size={64} />
              <View style={{ flex: 1, gap: 4 }}>
                <Pill label="Ya está en tu almacén" tone="success" icon="checkmark-circle" />
                <Text style={font.h3}>{existing.name}</Text>
                <Text style={font.small}>
                  Stock actual: {existing.stock} · {money(existing.price)}
                </Text>
              </View>
            </Card>
          ) : detailsLocked ? (
            <Card style={styles.summary}>
              <ProductThumb uri={imageUri} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={font.h3}>{name}</Text>
                <Text style={font.small}>{[brand, quantityLabel].filter(Boolean).join(' · ')}</Text>
              </View>
              <Button title="Editar" variant="ghost" onPress={() => setDetailsLocked(false)} style={{ minHeight: 40, paddingHorizontal: 8 }} />
            </Card>
          ) : (
            <View style={{ gap: spacing.lg }}>
              {notFound !== 'none' && (
                <View style={styles.notice}>
                  <Ionicons name="information-circle" size={22} color={colors.info} />
                  <Text style={{ flex: 1, color: colors.info, fontSize: 14 }}>
                    {notFound === 'no_sources'
                      ? 'La búsqueda en bases públicas está desactivada en Ajustes. Completa los datos y toma una foto del producto.'
                      : 'No encontramos este código en las bases públicas. Completa los datos y toma una foto del producto.'}
                  </Text>
                </View>
              )}
              <PhotoPicker uri={imageUri} onChange={setImageUri} />
              <Field label="Nombre del producto *" value={name} onChangeText={setName} placeholder="Ej. Inca Kola 500 ml" autoFocus={notFound !== 'none'} />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Field label="Marca" value={brand} onChangeText={setBrand} placeholder="Ej. Lindley" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Presentación" value={quantityLabel} onChangeText={setQuantityLabel} placeholder="Ej. 500 ml" />
                </View>
              </View>
              <Field label="Código de barras" value={code} editable={false} style={{ color: colors.muted }} />
            </View>
          )}

          <Card style={{ gap: spacing.lg, marginTop: spacing.lg }}>
            <View style={styles.qtyRow}>
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>{existing ? '¿Cuántas unidades ingresan?' : 'Cantidad en almacén'}</Text>
                <Text style={font.small}>Unidades</Text>
              </View>
              <Stepper value={units} onChange={setUnits} min={existing ? 1 : 0} />
            </View>
            <Field label="Precio de venta (opcional)" prefix="S/" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
            <DateField label="Fecha de vencimiento (opcional)" value={expiry} onChange={setExpiry} />
            {!existing && (
              <Field
                label="Avisarme cuando queden (opcional)"
                value={minStock}
                onChangeText={(t) => setMinStock(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="Usar valor por defecto"
                hint="Si lo dejas vacío se usa el mínimo configurado en Ajustes."
              />
            )}
          </Card>
        </ScrollView>
        <View style={styles.footer}>
          {existing ? (
            <Button title={`Agregar ${units} al stock`} icon="add-circle" loading={saving} onPress={() => restock(existing)} />
          ) : (
            <Button title="Guardar en almacén" icon="checkmark-circle" loading={saving} onPress={saveNew} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.background },
    foundHeader: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    foundImage: { width: 180, height: 180, borderRadius: radius.lg, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    footer: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
    summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    notice: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.infoSoft, padding: spacing.md, borderRadius: radius.md },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  }),
);
