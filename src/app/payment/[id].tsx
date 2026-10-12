import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BusinessHeader, captureViewAsImage, Dashed, MetaRow, paper, shareViewAsImage } from '@/components/ReceiptPaper';
import { Button } from '@/components/ui';
import { getSettings } from '@/db/settings';
import { SendToAdminButton } from '@/features/integrations/components/SendToAdminButton';
import { sendReceiptImage } from '@/features/integrations/lib/deliver';
import { getPaymentReceipt, PAYMENT_METHODS, paymentReceiptNumber } from '@/features/payments/db/payments';
import { formatDateTime, formatDay, money } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { lightTheme, makeStyles, radius, spacing, useTheme } from '@/theme';

export default function PaymentReceiptScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; fresh?: string }>();
  const id = Number(params.id);
  const fresh = params.fresh === '1';
  const db = useSQLiteContext();
  const ticketRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const { data } = useFocusQuery(async (db) => ({ receipt: await getPaymentReceipt(db, id), settings: await getSettings(db) }), [id]);

  if (!data?.receipt) return null;
  const { receipt: r, settings } = data;
  const number = paymentReceiptNumber(r.id);

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
      <Stack.Screen options={{ title: number }} />
      <ScrollView contentContainerStyle={styles.content}>
        {fresh && (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={{ color: colors.primaryDark, fontWeight: '700', flex: 1 }}>
              Cobro registrado.{r.due_after > 0 ? ` Queda una deuda de ${money(r.due_after)}.` : ''}
            </Text>
          </View>
        )}

        {/* Everything inside this view becomes the shared image */}
        <View ref={ticketRef} collapsable={false} style={paper.ticketWrap}>
          <View style={paper.ticket}>
            <BusinessHeader settings={settings} icon="barbell" />
            <Dashed />
            <Text style={paper.docTitle}>BOLETA DE MEMBRESÍA</Text>
            <Text style={paper.docNumber}>{number}</Text>
            <MetaRow label="Fecha" value={formatDateTime(r.created_at)} />
            <MetaRow label="Cliente" value={r.member_name} />
            {r.member_dni && <MetaRow label="DNI" value={r.member_dni} />}
            {r.user_name && <MetaRow label="Atendió" value={r.user_name} />}
            <Dashed />

            <View style={paper.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={paper.itemName}>Plan {r.plan_name}</Text>
                <Text style={paper.itemUnit}>
                  {formatDay(r.start_date)} al {formatDay(r.end_date)}
                </Text>
              </View>
              <Text style={[paper.itemTotal, { width: 90 }]}>{money(r.plan_price)}</Text>
            </View>
            {r.personal_price != null && (
              <View style={paper.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={paper.itemName}>Personalizado</Text>
                  <Text style={paper.itemUnit}>{r.coach_name ? `Coach ${r.coach_name}` : 'Coach'}</Text>
                </View>
                <Text style={[paper.itemTotal, { width: 90 }]}>{money(r.personal_price)}</Text>
              </View>
            )}

            <Dashed />
            <MetaRow label="Total de la membresía" value={money(r.total)} />
            <MetaRow label={`Este pago (${PAYMENT_METHODS[r.method]})`} value={money(r.amount)} />
            <MetaRow label="Pagado a la fecha" value={money(r.paid_to_date)} />
            <View style={[paper.totalRow, { marginTop: spacing.md }]}>
              <Text style={paper.totalLabel}>{r.due_after > 0 ? 'PENDIENTE' : 'PAGADO'}</Text>
              <Text style={[paper.totalValue, { color: r.due_after > 0 ? lightTheme.colors.danger : lightTheme.colors.primary }]}>
                {r.due_after > 0 ? money(r.due_after) : '✓'}
              </Text>
            </View>
            <Dashed />
            <Text style={paper.footer}>Vigente hasta el {formatDay(r.end_date)}</Text>
            <Text style={paper.disclaimer}>Comprobante interno, no válido como comprobante electrónico SUNAT.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Compartir por WhatsApp" icon="logo-whatsapp" loading={sharing} onPress={share} style={{ backgroundColor: colors.whatsapp, borderColor: colors.whatsapp }} />
        <SendToAdminButton
          onSend={async () => {
            const caption = `🧾 ${number} · ${r.member_name} · ${money(r.amount)} (${PAYMENT_METHODS[r.method]})${r.due_after > 0 ? ` · Pendiente ${money(r.due_after)}` : ''}`;
            return sendReceiptImage(db, 'receipt', r.id, number, await captureViewAsImage(ticketRef), caption);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, width: '100%', maxWidth: 520, alignSelf: 'center' },
    success: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
    actions: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
