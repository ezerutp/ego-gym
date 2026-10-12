import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, IconCircle, Pill, SectionTitle } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { listReports, listSchedules } from '@/features/reports/db/reports';
import { describePeriod, REPORT_KINDS, type ReportKind } from '@/features/reports/lib/build';
import { generateReport } from '@/features/reports/lib/runner';
import { describeSchedule, quickPeriods } from '@/features/reports/lib/schedule';
import { formatDateTime } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

const KINDS = Object.keys(REPORT_KINDS) as ReportKind[];

export default function ReportsScreen() {
  return (
    <AdminOnly>
      <ReportsScreenContent />
    </AdminOnly>
  );
}

function ReportsScreenContent() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const periods = quickPeriods();
  const [kind, setKind] = useState<ReportKind>('summary');
  const [periodKey, setPeriodKey] = useState('today');
  const [generating, setGenerating] = useState(false);
  const { data } = useFocusQuery(async (db) => ({ schedules: await listSchedules(db), reports: await listReports(db) }));

  const generate = async () => {
    const period = periods.find((p) => p.key === periodKey)!;
    setGenerating(true);
    try {
      const id = await generateReport(db, kind, period.start, period.end);
      router.push({ pathname: '/reports/[id]', params: { id } });
    } catch (e) {
      Alert.alert('No se pudo generar', String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle title="Generar ahora" />
      <Card style={{ gap: spacing.lg }}>
        <View style={styles.chips}>
          {KINDS.map((k) => (
            <Chip key={k} label={REPORT_KINDS[k].label} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <Text style={font.small}>{REPORT_KINDS[kind].hint}</Text>
        <View style={styles.chips}>
          {periods.map((p) => (
            <Chip key={p.key} label={p.label} selected={periodKey === p.key} onPress={() => setPeriodKey(p.key)} />
          ))}
        </View>
        <Button title="Generar reporte" icon="document-text" loading={generating} onPress={generate} />
      </Card>

      <SectionTitle title="Programados" action="Programar" onAction={() => router.push('/reports/schedule')} />
      {data?.schedules.length ? (
        <Card style={{ padding: 0 }}>
          {data.schedules.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => router.push({ pathname: '/reports/schedule', params: { id: s.id } })}
              style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && { opacity: 0.7 }, !s.active && { opacity: 0.5 }]}
            >
              <IconCircle icon="alarm" color={colors.primary} bg={colors.primarySoft} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>{REPORT_KINDS[s.kind].label}</Text>
                <Text style={font.small}>
                  {describeSchedule(s)} · {s.format === 'pdf' ? 'PDF' : 'Texto'}
                </Text>
              </View>
              {!s.active && <Pill label="Pausado" />}
              <Ionicons name="chevron-forward" size={20} color={colors.faint} />
            </Pressable>
          ))}
        </Card>
      ) : (
        <Card>
          <Text style={font.small}>Aún no hay reportes programados. Programa uno para que se genere solo cada día, semana o mes.</Text>
        </Card>
      )}

      <SectionTitle title="Historial" />
      {data?.reports.length ? (
        <Card style={{ padding: 0 }}>
          {data.reports.map((r, i) => (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: '/reports/[id]', params: { id: r.id } })}
              style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name={r.pdf_uri ? 'document' : 'document-text-outline'} size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>{r.title}</Text>
                <Text style={font.small}>
                  {describePeriod(r.period_start, r.period_end)} · {r.schedule_id ? 'Programado' : 'Manual'} · {formatDateTime(r.created_at)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.faint} />
            </Pressable>
          ))}
        </Card>
      ) : (
        <Card>
          <Text style={font.small}>Los reportes que generes aparecerán aquí.</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    border: { borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
