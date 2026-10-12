import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, IconCircle, Pill, Stepper, type IconName } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { session } from '@/features/auth/lib/session';
import { BackupError, exportBackup, restoreBackup } from '@/features/backup/backup';
import { getSettings, saveSettings, type Settings } from '@/db/settings';
import { PRODUCT_SOURCES } from '@/features/store/lib/productLookup';
import { notificationsAvailable, rescheduleAlerts, sendTestNotification, setupNotifications } from '@/lib/notifications';
import { formatDateTime, isoToDb } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function SettingsScreen() {
  return (
    <AdminOnly>
      <SettingsScreenContent />
    </AdminOnly>
  );
}

function SettingsScreenContent() {
  const styles = useStyles();
  const { data, reload } = useFocusQuery(async (db) => {
    const [settings, stats] = await Promise.all([
      getSettings(db),
      db.getFirstAsync<{ products: number; sales: number }>('SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM sales) AS sales'),
    ]);
    return { settings, stats };
  });

  if (!data) return <SafeAreaView style={styles.safe} />;
  // Keyed on the saved values so the form resets to them after each save.
  return <SettingsForm key={JSON.stringify(data.settings)} initial={data.settings} stats={data.stats} onSaved={reload} />;
}

type FormProps = { initial: Settings; stats: { products: number; sales: number } | null; onSaved: () => void };

function SettingsForm({ initial, stats, onSaved }: FormProps) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    try {
      // Only what changed here: other keys may have been updated meanwhile (Telegram, backups).
      const changed = Object.fromEntries(
        Object.entries(form).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initial[key as keyof Settings])),
      );
      await saveSettings(db, changed);
      if (form.notificationsEnabled) await setupNotifications();
      await rescheduleAlerts(db);
      Alert.alert('Guardado', 'La configuración se actualizó.');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const backup = async () => {
    setBackingUp(true);
    try {
      await exportBackup(db);
      onSaved();
    } catch (e) {
      Alert.alert('No se pudo exportar', String(e));
    } finally {
      setBackingUp(false);
    }
  };

  const restore = () =>
    Alert.alert(
      'Restaurar respaldo',
      'Se reemplazarán TODOS los datos actuales de la tablet por los del respaldo. Esta acción no se puede deshacer. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Elegir archivo',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!(await restoreBackup(db))) return;
              await rescheduleAlerts(db).catch(() => {});
              Alert.alert('Respaldo restaurado', 'Los datos se reemplazaron. Ingresa de nuevo con tu PIN.');
              session.signOut();
            } catch (e) {
              Alert.alert('No se pudo restaurar', e instanceof BackupError ? e.message : String(e));
            }
          },
        },
      ],
    );

  const testNotification = async () => {
    if (!notificationsAvailable) return Alert.alert('No disponible en Expo Go', 'Las notificaciones funcionan al instalar el APK de la app.');
    if (!(await sendTestNotification())) Alert.alert('Permiso requerido', 'Activa las notificaciones de EGO Gym en los ajustes del teléfono.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section icon="storefront" title="Mi gimnasio" subtitle="Aparece en la boleta">
            <Field label="Nombre del gimnasio" value={form.storeName} onChangeText={(v) => set('storeName', v)} />
            <Field label="Dirección" value={form.storeAddress} onChangeText={(v) => set('storeAddress', v)} placeholder="Av. Los Olivos 123, Lima" />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label="RUC" value={form.storeRuc} onChangeText={(v) => set('storeRuc', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={11} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Teléfono" value={form.storePhone} onChangeText={(v) => set('storePhone', v)} keyboardType="phone-pad" />
              </View>
            </View>
            <Field label="Mensaje al pie de la boleta" value={form.receiptFooter} onChangeText={(v) => set('receiptFooter', v)} />
          </Section>

          <Section icon="notifications" title="Alertas y notificaciones" subtitle="Almacén y resumen diario">
            <Row label="Stock mínimo por defecto" hint="Avisar cuando queden estas unidades o menos">
              <Stepper value={form.lowStockThreshold} onChange={(v) => set('lowStockThreshold', v)} min={0} max={999} />
            </Row>
            <Row label="Aviso de vencimiento" hint={`Avisar ${form.expiryWarningDays} días antes de que venza`}>
              <Stepper value={form.expiryWarningDays} onChange={(v) => set('expiryWarningDays', v)} min={1} max={180} />
            </Row>
            <Row label="Notificaciones" hint="Resumen diario de membresías, deudas y almacén, y avisos al instante">
              <Switch
                value={form.notificationsEnabled}
                onValueChange={(v) => set('notificationsEnabled', v)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
              />
            </Row>
            {form.notificationsEnabled && (
              <Row label="Hora del resumen diario" hint={`${String(form.notifyHour).padStart(2, '0')}:00 h`}>
                <Stepper value={form.notifyHour} onChange={(v) => set('notifyHour', v)} min={0} max={23} />
              </Row>
            )}
            <Button title="Probar notificación" icon="notifications-outline" variant="secondary" onPress={testNotification} />
          </Section>

          <Section icon="card" title="Membresías" subtitle="Cuándo avisar">
            <Row label="Días de aviso antes de vencer" hint="La membresía pasa a 'Por vencer' estos días antes de su fin">
              <Stepper value={form.membershipWarningDays} onChange={(v) => set('membershipWarningDays', v)} min={1} max={30} />
            </Row>
          </Section>

          <Section icon="lock-closed" title="Seguridad" subtitle="Bloqueo de la tablet">
            <Row label="Bloquear tras minutos sin uso" hint={form.autoLockMinutes === 0 ? 'Nunca se bloquea sola' : 'Al bloquearse se pide de nuevo el PIN'}>
              <Stepper value={form.autoLockMinutes} onChange={(v) => set('autoLockMinutes', v)} min={0} max={120} />
            </Row>
          </Section>

          <Section icon="search" title="Fuentes de productos" subtitle="Dónde buscar un código nuevo">
            {PRODUCT_SOURCES.map((source) => (
              <Row key={source.id} label={source.name} hint={source.description}>
                <Switch
                  value={form.productSources.includes(source.id)}
                  onValueChange={(on) =>
                    set(
                      'productSources',
                      // Rebuilt from PRODUCT_SOURCES so the priority order never depends on toggle order.
                      PRODUCT_SOURCES.map((s) => s.id).filter((id) => (id === source.id ? on : form.productSources.includes(id))),
                    )
                  }
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.white}
                />
              </Row>
            ))}
            {form.productSources.length === 0 && (
              <Text style={font.small}>Con todas desactivadas, cada producto nuevo se registra a mano.</Text>
            )}
          </Section>

          <Section icon="cloud-upload" title="Sincronización" subtitle="Respaldo en la nube">
            <Row label="Sincronizar base de datos" hint="Respalda tus datos en la nube y úsalos en varios dispositivos.">
              <Switch value={form.syncEnabled} disabled trackColor={{ true: colors.primary, false: colors.border }} />
            </Row>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Pill label="Próximamente" tone="info" icon="time-outline" />
              <Text style={[font.small, { flex: 1 }]}>Por ahora todo se guarda solo en este dispositivo.</Text>
            </View>
            <Button title="Sincronizar ahora" icon="sync" variant="secondary" disabled onPress={() => {}} />
          </Section>

          <Section icon="shield-checkmark" title="Respaldo" subtitle="Copia de seguridad de la base de datos">
            <Text style={font.small}>
              Todo se guarda solo en esta tablet. Exporta un respaldo con frecuencia y guárdalo en Drive, en tu correo o envíalo por WhatsApp. Incluye clientes,
              membresías, pagos, tienda, reportes y ajustes; las fotos no se incluyen.
            </Text>
            <Text style={font.h3}>{form.lastBackupAt ? `Último respaldo: ${formatDateTime(isoToDb(form.lastBackupAt))}` : 'Aún no hay respaldos'}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button title="Exportar respaldo" icon="download-outline" loading={backingUp} onPress={backup} style={{ flexGrow: 1 }} />
              <Button title="Restaurar respaldo" icon="refresh-circle-outline" variant="secondary" onPress={restore} style={{ flexGrow: 1 }} />
            </View>
          </Section>

          <Section icon="server" title="Datos locales" subtitle="Guardados en este dispositivo">
            <Row label="Productos registrados">
              <Text style={font.h3}>{stats?.products ?? 0}</Text>
            </Row>
            <Row label="Ventas registradas">
              <Text style={font.h3}>{stats?.sales ?? 0}</Text>
            </Row>
            <Text style={font.small}>Los nombres e imágenes de productos se obtienen de Open Food Facts, Open Beauty Facts y Open Products Facts, bases de datos públicas y gratuitas.</Text>
          </Section>
        </ScrollView>

        {dirty && (
          <View style={styles.saveBar}>
            <Button title="Guardar cambios" icon="checkmark" loading={saving} onPress={save} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ icon, title, subtitle, children }: { icon: IconName; title: string; subtitle: string; children: React.ReactNode }) {
  const { colors, font } = useTheme();
  return (
    <Card style={{ gap: spacing.lg, marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconCircle icon={icon} color={colors.primary} bg={colors.primarySoft} />
        <View>
          <Text style={font.h3}>{title}</Text>
          <Text style={font.small}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { colors, font } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { fontWeight: '600', color: colors.ink }]}>{label}</Text>
        {hint && <Text style={font.small}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 48 },
    saveBar: { padding: spacing.lg, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
