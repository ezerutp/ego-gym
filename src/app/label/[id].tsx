import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { shareViewAsImage } from '@/components/ReceiptPaper';
import { Button, Card, Chip, Stepper } from '@/components/ui';
import { BarcodeLabel } from '@/features/store/components/BarcodeLabel';
import { getProduct } from '@/features/store/db/products';
import { LABELS_PER_SHEET, labelsPdf, printLabels } from '@/features/store/lib/labelPdf';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

type Busy = 'print' | 'pdf' | 'image' | null;

export default function LabelScreen() {
  const styles = useStyles();
  const { font } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState<Busy>(null);
  const labelRef = useRef<View>(null);
  const { data: product } = useFocusQuery((db) => getProduct(db, Number(id)), [id]);
  if (!product) return null;

  const run = async (kind: Busy, action: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await action();
    } catch (e) {
      Alert.alert('No se pudo generar la etiqueta', String(e));
    } finally {
      setBusy(null);
    }
  };

  const sharePdf = () =>
    run('pdf', async () => {
      if (!(await Sharing.isAvailableAsync())) return Alert.alert('No disponible', 'Este dispositivo no permite compartir archivos.');
      const uri = await labelsPdf(product, count);
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Etiquetas de ${product.name}`, UTI: 'com.adobe.pdf' });
    });

  const shareImage = () =>
    run('image', async () => {
      if (!(await shareViewAsImage(labelRef, `Etiqueta de ${product.name}`))) Alert.alert('No disponible', 'Este dispositivo no permite compartir archivos.');
    });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Etiqueta' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.preview}>
          <BarcodeLabel ref={labelRef} product={product} width={Math.min(width - spacing.xl * 2, 420)} />
        </View>
        <Text style={[font.small, { textAlign: 'center' }]}>Tamaño real: 5 × 3 cm, con borde redondeado para recortar.</Text>

        <Card style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>¿Cuántas etiquetas?</Text>
              <Text style={font.small}>Van en una hoja A4 (hasta {LABELS_PER_SHEET}).</Text>
            </View>
            <Stepper value={count} onChange={setCount} min={1} max={LABELS_PER_SHEET} />
          </View>
          <View style={styles.chips}>
            <Chip label="Solo una" selected={count === 1} onPress={() => setCount(1)} />
            <Chip label={`Hoja completa (${LABELS_PER_SHEET})`} selected={count === LABELS_PER_SHEET} onPress={() => setCount(LABELS_PER_SHEET)} />
          </View>
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Imprimir" icon="print-outline" loading={busy === 'print'} disabled={!!busy} onPress={() => run('print', () => printLabels(product, count))} />
        <View style={styles.row}>
          <Button title="PDF" icon="document-outline" variant="secondary" loading={busy === 'pdf'} disabled={!!busy} onPress={sharePdf} style={{ flex: 1 }} />
          <Button title="Imagen" icon="image-outline" variant="secondary" loading={busy === 'image'} disabled={!!busy} onPress={shareImage} style={{ flex: 1 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm, width: '100%', maxWidth: 640, alignSelf: 'center' },
    preview: { alignItems: 'center', paddingVertical: spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    footer: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
