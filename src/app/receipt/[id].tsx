import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessHeader, Dashed, MetaRow, paper, shareViewAsImage } from '@/components/ReceiptPaper';
import { Button } from '@/components/ui';
import { getSale } from '@/features/store/db/sales';
import { getSettings } from '@/db/settings';
import { formatDateTime, money, receiptNumber } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

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
      if (!(await shareViewAsImage(ticketRef, 'Enviar boleta por WhatsApp'))) {
        Alert.alert('No disponible', 'Este dispositivo no permite compartir archivos.');
      }
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
            <BusinessHeader settings={settings} icon="storefront" />

            <Dashed />
            <Text style={paper.docTitle}>BOLETA DE VENTA</Text>
            <Text style={paper.docNumber}>{receiptNumber(sale.id)}</Text>
            <MetaRow label="Fecha" value={formatDateTime(sale.created_at)} />
            {sale.customer_name && <MetaRow label="Cliente" value={sale.customer_name} />}
            {sale.user_name && <MetaRow label="Atendió" value={sale.user_name} />}
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

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg },
    success: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
    actions: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  }),
);

