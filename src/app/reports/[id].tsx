import { router, Stack, useLocalSearchParams } from 'expo-router';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, SectionTitle } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { deleteReport, getReport } from '@/features/reports/db/reports';
import { buildReport, describePeriod } from '@/features/reports/lib/build';
import { attachPdf } from '@/features/reports/lib/runner';
import { formatDateTime } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

export default function ReportScreen() {
  return (
    <AdminOnly>
      <ReportScreenContent />
    </AdminOnly>
  );
}

function ReportScreenContent() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [busy, setBusy] = useState(false);
  const { data, reload } = useFocusQuery(
    async (db) => {
      const report = await getReport(db, Number(id));
      return report ? { report, view: await buildReport(db, report.kind, report.period_start, report.period_end) } : null;
    },
    [id],
  );
  if (!data) return null;
  const { report, view } = data;

  const sharePdf = async () => {
    setBusy(true);
    try {
      const existing = report.pdf_uri && new File(report.pdf_uri).exists ? report.pdf_uri : null;
      const uri = existing ?? (await attachPdf(db, report.id, report.kind, report.period_start, report.period_end));
      if (!existing) reload();
      if (!(await Sharing.isAvailableAsync())) return Alert.alert('No disponible', 'Este dispositivo no permite compartir archivos.');
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: report.title, UTI: 'com.adobe.pdf' });
    } catch (e) {
      Alert.alert('No se pudo generar el PDF', String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Eliminar reporte', '¿Eliminar este reporte del historial?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteReport(db, report.id);
          router.back();
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: report.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 2 }}>
          <Text style={font.title}>{report.title}</Text>
          <Text style={font.small}>
            {describePeriod(report.period_start, report.period_end)} · generado el {formatDateTime(report.created_at)}
          </Text>
        </View>

        <View style={styles.kpis}>
          {view.highlights.map((h) => (
            <Card key={h.label} style={styles.kpi}>
              <Text style={font.small}>{h.label}</Text>
              <Text style={[font.h2, { color: colors.ink }]}>{h.value}</Text>
            </Card>
          ))}
        </View>

        {view.tables.map((t) => (
          <View key={t.title}>
            <SectionTitle title={t.title} />
            <Card style={{ padding: 0 }}>
              {t.rows.length === 0 ? (
                <Text style={[font.small, { padding: spacing.lg }]}>{t.empty}</Text>
              ) : (
                <>
                  <View style={[styles.tr, styles.th]}>
                    {t.columns.map((c, i) => (
                      <Text key={c} style={[font.tiny, styles.cell, i > 0 && styles.right]}>
                        {c.toUpperCase()}
                      </Text>
                    ))}
                  </View>
                  {t.rows.map((row, r) => (
                    <View key={r} style={[styles.tr, styles.border]}>
                      {row.map((cell, i) => (
                        <Text key={i} style={[font.body, styles.cell, i > 0 && styles.right]} numberOfLines={2}>
                          {cell}
                        </Text>
                      ))}
                    </View>
                  ))}
                </>
              )}
            </Card>
          </View>
        ))}
        <Text style={[font.small, { marginTop: spacing.lg }]}>
          Los clientes por vencer y con deuda muestran la situación al momento de abrir el reporte.
        </Text>
        <Button title="Eliminar reporte" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: spacing.lg }} />
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Compartir PDF" icon="document" loading={busy} onPress={sharePdf} />
        <View style={styles.actionRow}>
          <Button title="Compartir texto" icon="chatbubble-ellipses-outline" variant="secondary" onPress={() => Share.share({ message: report.text })} style={{ flex: 1 }} />
          <Button title="Enviar al admin · Próximamente" icon="paper-plane-outline" variant="secondary" disabled onPress={() => {}} style={{ flex: 1 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 32, gap: spacing.md, width: '100%', maxWidth: 900, alignSelf: 'center' },
    kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    kpi: { flexGrow: 1, flexBasis: 200, gap: 4 },
    tr: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    th: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
    border: { borderTopWidth: 1, borderTopColor: colors.border },
    cell: { flex: 1 },
    right: { textAlign: 'right' },
    actions: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    actionRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  }),
);
