import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, Stepper } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { deleteSchedule, getSchedule, saveSchedule, type Frequency, type ReportFormat, type ReportSchedule } from '@/features/reports/db/reports';
import { REPORT_KINDS, type ReportKind } from '@/features/reports/lib/build';
import { runDueReports } from '@/features/reports/lib/runner';
import { describeSchedule, FREQUENCIES, WEEKDAYS } from '@/features/reports/lib/schedule';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

const KINDS = Object.keys(REPORT_KINDS) as ReportKind[];
const FREQS = Object.keys(FREQUENCIES) as Frequency[];
const DEFAULT_HOUR: Record<Frequency, number> = { daily: 21, weekly: 21, monthly: 8 };

export default function ScheduleScreen() {
  return (
    <AdminOnly>
      <ScheduleScreenContent />
    </AdminOnly>
  );
}

function ScheduleScreenContent() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data } = useFocusQuery(async (db) => (id ? await getSchedule(db, Number(id)) : null), [id]);
  if (id && !data) return null;
  return <ScheduleForm key={id ?? 'new'} schedule={data ?? null} />;
}

function ScheduleForm({ schedule }: { schedule: ReportSchedule | null }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [kind, setKind] = useState<ReportKind>(schedule?.kind ?? 'summary');
  const [frequency, setFrequency] = useState<Frequency>(schedule?.frequency ?? 'daily');
  const [weekday, setWeekday] = useState(schedule?.weekday ?? 0);
  const [monthDay, setMonthDay] = useState(schedule?.month_day ?? 1);
  const [hour, setHour] = useState(schedule?.hour ?? 21);
  const [format, setFormat] = useState<ReportFormat>(schedule?.format ?? 'pdf');
  const [active, setActive] = useState(schedule ? schedule.active === 1 : true);
  const [saving, setSaving] = useState(false);
  const when = { frequency, weekday, month_day: monthDay, hour };

  const chooseFrequency = (f: Frequency) => {
    setFrequency(f);
    if (!schedule) setHour(DEFAULT_HOUR[f]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSchedule(db, schedule?.id ?? null, {
        kind,
        frequency,
        weekday: frequency === 'weekly' ? weekday : null,
        month_day: frequency === 'monthly' ? monthDay : null,
        hour,
        format,
        active,
      });
      runDueReports(db).catch(() => {});
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Eliminar programación', 'Los reportes ya generados se mantienen en el historial.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteSchedule(db, schedule!.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: schedule ? 'Editar programación' : 'Programar reporte' }} />
      <Card style={{ gap: spacing.lg }}>
        <Group label="Reporte">
          {KINDS.map((k) => (
            <Chip key={k} label={REPORT_KINDS[k].label} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </Group>
        <Group label="Frecuencia" hint={FREQUENCIES[frequency].hint}>
          {FREQS.map((f) => (
            <Chip key={f} label={FREQUENCIES[f].label} selected={frequency === f} onPress={() => chooseFrequency(f)} />
          ))}
        </Group>
        {frequency === 'weekly' && (
          <Group label="Día de la semana">
            {WEEKDAYS.map((d, i) => (
              <Chip key={d} label={d} selected={weekday === i} onPress={() => setWeekday(i)} />
            ))}
          </Group>
        )}
        {frequency === 'monthly' && (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>Día del mes</Text>
              <Text style={font.small}>Del 1 al 28, para que exista en todos los meses</Text>
            </View>
            <Stepper value={monthDay} onChange={setMonthDay} min={1} max={28} />
          </View>
        )}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={font.h3}>Hora</Text>
            <Text style={font.small}>{`${String(hour).padStart(2, '0')}:00 h`}</Text>
          </View>
          <Stepper value={hour} onChange={setHour} min={0} max={23} />
        </View>
        <Group label="Formato">
          <Chip label="PDF" selected={format === 'pdf'} onPress={() => setFormat('pdf')} />
          <Chip label="Solo texto" selected={format === 'text'} onPress={() => setFormat('text')} />
        </Group>
        {schedule && (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>Activo</Text>
              <Text style={font.small}>Pausado, deja de generarse hasta que lo vuelvas a activar.</Text>
            </View>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
        )}
      </Card>

      <Card style={{ backgroundColor: colors.primarySoft, gap: 4 }}>
        <Text style={font.h3}>{describeSchedule(when)}</Text>
        <Text style={font.small}>
          Se genera al abrir la app o en segundo plano cerca de esa hora, y avisa con una notificación. El envío automático por Telegram llegará con las integraciones.
        </Text>
      </Card>

      <Button title={schedule ? 'Guardar cambios' : 'Programar'} icon="alarm" loading={saving} onPress={save} />
      {schedule && <Button title="Eliminar programación" icon="trash-outline" variant="danger" onPress={remove} />}
    </ScrollView>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const styles = useStyles();
  const { font } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>{children}</View>
      {hint && <Text style={font.small}>{hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  }),
);
