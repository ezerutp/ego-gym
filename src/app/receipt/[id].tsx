import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { Button } from '@/components/ui';
import { getSale } from '@/db/sales';
import { getSettings } from '@/db/settings';
import { formatDateTime, money, receiptNumber } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { lightTheme, makeStyles, radius, spacing, useTheme, type Theme } from '@/theme';

export default function ReceiptScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; fresh?: string }>();
  const id = Number(params.id);
  const fresh = params.fresh === '1';
  const ticketRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const { data } = useFocusQuery(async (db) => ({ result: await getSale(db, id), settings: await getSettings(db) }), [id]);

  if (!data?.result) return null;
  const { sale, items } = data.result;
  const { settings } = data;

  const share = async () => {
    setSharing(true);
    try {
      const path = await captureRef(ticketRef, { format: 'png', quality: 1, result: 'tmpfile' });
      const uri = path.startsWith('file://') ? path : `file://${path}`;
      if (!(await Sharing.isAvailableAsync())) return Alert.alert('No disponible', 'Este dispositivo no permite compartir archivos.');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Enviar boleta por WhatsApp' });
    } catch (e) {
      Alert.alert('No se pudo generar la imagen', String(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: receiptNumber(sale.id) }} />
      <ScrollView contentContainerStyle={styles.content}>
        {fresh && (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={{ color: colors.primaryDark, fontWeight: '700', flex: 1 }}>Venta registrada. El stock se actualizó.</Text>
          </View>
        )}

        {/* Everything inside this view becomes the shared image */}
        <View ref={ticketRef} collapsable={false} style={paper.ticketWrap}>
          <View style={paper.ticket}>
            <View style={paper.logo}>
              <Ionicons name="storefront" size={26} color={lightTheme.colors.white} />
            </View>
            <Text style={paper.store}>{settings.storeName}</Text>
            {!!settings.storeAddress && <Text style={paper.storeMeta}>{settings.storeAddress}</Text>}
            {!!settings.storeRuc && <Text style={paper.storeMeta}>RUC {settings.storeRuc}</Text>}
            {!!settings.storePhone && <Text style={paper.storeMeta}>Tel. {settings.storePhone}</Text>}

            <Dashed />
            <Text style={paper.docTitle}>BOLETA DE VENTA</Text>
            <Text style={paper.docNumber}>{receiptNumber(sale.id)}</Text>
            <View style={paper.metaRow}>
              <Text style={paper.metaLabel}>Fecha</Text>
              <Text style={paper.metaValue}>{formatDateTime(sale.created_at)}</Text>
            </View>
            {sale.customer_name && (
              <View style={paper.metaRow}>
                <Text style={paper.metaLabel}>Cliente</Text>
                <Text style={paper.metaValue}>{sale.customer_name}</Text>
              </View>
            )}
            <Dashed />

            <View style={paper.itemsHeader}>
              <Text style={[paper.th, { flex: 1 }]}>Producto</Text>
              <Text style={[paper.th, { width: 44, textAlign: 'center' }]}>Cant.</Text>
              <Text style={[paper.th, { width: 76, textAlign: 'right' }]}>Importe</Text>
            </View>
            {items.map((item) => (
              <View key={item.id} style={paper.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={paper.itemName}>{item.name}</Text>
                  <Text style={paper.itemUnit}>{money(item.unit_price)} c/u</Text>
                </View>
                <Text style={[paper.itemQty, { width: 44 }]}>{item.quantity}</Text>
                <Text style={[paper.itemTotal, { width: 76 }]}>{money(item.unit_price * item.quantity)}</Text>
              </View>
            ))}

            <Dashed />
            <View style={paper.totalRow}>
              <Text style={paper.totalLabel}>TOTAL</Text>
              <Text style={paper.totalValue}>{money(sale.total)}</Text>
            </View>
            <Dashed />
            <Text style={paper.footer}>{settings.receiptFooter}</Text>
            <Text style={paper.disclaimer}>Comprobante interno, no válido como comprobante electrónico SUNAT.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Compartir por WhatsApp" icon="logo-whatsapp" loading={sharing} onPress={share} style={{ backgroundColor: '#25D366', borderColor: '#25D366' }} />
        {fresh && (
          <Button
            title="Nueva venta"
            icon="add"
            variant="secondary"
            onPress={() => {
              router.back();
              router.push({ pathname: '/scan', params: { mode: 'sell' } });
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function Dashed() {
  return <View style={paper.dashed} />;
}

const MONO = { fontVariant: ['tabular-nums' as const] };

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg },
    success: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
    actions: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  }),
);

/** The receipt is shared as an image, so it always looks like white paper, even in dark mode. */
const paper = paperStyles(lightTheme);

function paperStyles({ colors, font }: Theme) {
  return StyleSheet.create({
    ticketWrap: { backgroundColor: colors.background, padding: spacing.sm, borderRadius: radius.lg + spacing.sm },
    ticket: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'stretch' },
    logo: { alignSelf: 'center', width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    store: { ...font.h2, textAlign: 'center' },
    storeMeta: { ...font.small, textAlign: 'center' },
    dashed: { borderBottomWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, marginVertical: spacing.lg },
    docTitle: { textAlign: 'center', fontWeight: '800', letterSpacing: 2, color: colors.ink, fontSize: 13 },
    docNumber: { textAlign: 'center', fontWeight: '700', color: colors.primary, fontSize: 16, marginBottom: spacing.md, ...MONO },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    metaLabel: font.small,
    metaValue: { fontSize: 13, color: colors.ink, fontWeight: '600', ...MONO },
    itemsHeader: { flexDirection: 'row', marginBottom: spacing.sm },
    th: { ...font.tiny, textTransform: 'uppercase' },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
    itemName: { fontSize: 14, color: colors.ink, fontWeight: '600' },
    itemUnit: { fontSize: 12, color: colors.muted, ...MONO },
    itemQty: { fontSize: 14, color: colors.ink, textAlign: 'center', ...MONO },
    itemTotal: { fontSize: 14, color: colors.ink, textAlign: 'right', fontWeight: '600', ...MONO },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    totalLabel: { fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: 1 },
    totalValue: { fontSize: 26, fontWeight: '800', color: colors.ink, ...MONO },
    footer: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.ink },
    disclaimer: { textAlign: 'center', fontSize: 10, color: colors.faint, marginTop: spacing.sm },
  });
}
