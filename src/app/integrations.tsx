import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Field, IconCircle, Pill, SectionTitle } from '@/components/ui';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from '@/db/settings';
import { TEMPLATE_VARIABLES } from '@/features/alerts/lib/messages';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { DELIVERY_KINDS, listDeliveries, type Delivery } from '@/features/integrations/db/deliveries';
import { runDueDeliveries, sendReport, sendSummary, sendTestMessage } from '@/features/integrations/lib/deliver';
import { findStartChat, getBot } from '@/features/integrations/lib/telegram';
import { formatDateTime } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function IntegrationsScreen() {
  return (
    <AdminOnly>
      <IntegrationsContent />
    </AdminOnly>
  );
}

function IntegrationsContent() {
  const styles = useStyles();
  const { data, reload } = useFocusQuery(async (db) => ({ settings: await getSettings(db), deliveries: await listDeliveries(db) }));
  if (!data) return null;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TelegramSection settings={data.settings} onChanged={reload} />
        <WhatsAppSection key={JSON.stringify(data.settings)} settings={data.settings} onSaved={reload} />
        <DeliveriesSection deliveries={data.deliveries} onChanged={reload} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TelegramSection({ settings, onChanged }: { settings: Settings; onChanged: () => void }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const hasBot = !!settings.telegramToken;
  const connected = hasBot && !!settings.telegramChatId;

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (e) {
      Alert.alert('Telegram', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const connectBot = () =>
    run('bot', async () => {
      const value = token.trim();
      if (!value) throw new Error('Pega el token que te dio @BotFather.');
      const bot = await getBot(value);
      await saveSettings(db, { telegramToken: value, telegramBotName: bot.username, telegramChatId: '', telegramChatName: '' });
      setToken('');
    });

  const detectChat = () =>
    run('chat', async () => {
      const chat = await findStartChat(settings.telegramToken);
      if (!chat) throw new Error(`Aún no llega el /start. Desde el Telegram del administrador, abre @${settings.telegramBotName}, toca Iniciar y vuelve a intentar.`);
      await saveSettings(db, { telegramChatId: chat.id, telegramChatName: chat.name });
      const result = await sendTestMessage(db);
      if (!result.ok) throw new Error(result.error);
      Alert.alert('¡Listo!', `Conectado con ${chat.name}. Te enviamos un mensaje de prueba.`);
    });

  const test = () =>
    run('test', async () => {
      const result = await sendTestMessage(db);
      if (!result.ok) throw new Error(result.error);
      Alert.alert('Enviado', 'Revisa el Telegram del administrador.');
    });

  const disconnect = () =>
    Alert.alert('Desconectar Telegram', 'Dejarán de enviarse reportes, boletas y el resumen diario.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: () => run('off', () => saveSettings(db, { telegramToken: '', telegramBotName: '', telegramChatId: '', telegramChatName: '' })),
      },
    ]);

  const toggle = (key: 'telegramSendReports' | 'telegramDailySummary', value: boolean) => run(key, () => saveSettings(db, { [key]: value }));

  return (
    <>
      <SectionTitle title="Telegram" />
      <Card style={{ gap: spacing.lg }}>
        <View style={styles.header}>
          <IconCircle icon="paper-plane" color={colors.info} bg={colors.infoSoft} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={font.h3}>Envíos automáticos al administrador</Text>
            <Text style={font.small}>Reportes programados, boletas y el resumen diario llegan solos al Telegram del admin.</Text>
          </View>
          <Pill label={connected ? 'Conectado' : 'Sin conectar'} tone={connected ? 'success' : 'neutral'} />
        </View>

        {!hasBot && (
          <>
            <Step n={1} text="En Telegram, abre @BotFather y envía /newbot. Elige un nombre y un usuario que termine en «bot»." />
            <Step n={2} text="Copia el token que te da (se ve como 123456:ABC…) y pégalo aquí." />
            <Field label="Token del bot" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="123456789:AA…" />
            <Button title="Conectar bot" icon="link" loading={busy === 'bot'} onPress={connectBot} />
          </>
        )}

        {hasBot && !connected && (
          <>
            <Text style={font.body}>
              Bot <Text style={{ fontWeight: '700' }}>@{settings.telegramBotName}</Text> listo.
            </Text>
            <Step n={3} text={`Desde el Telegram del administrador, abre @${settings.telegramBotName} y toca «Iniciar» (envía /start).`} />
            <View style={styles.buttons}>
              <Button title="Abrir el bot" icon="open-outline" variant="secondary" onPress={() => Linking.openURL(`https://t.me/${settings.telegramBotName}`)} style={styles.button} />
              <Button title="Detectar chat" icon="search" loading={busy === 'chat'} onPress={detectChat} style={styles.button} />
            </View>
            <Button title="Cambiar de bot" variant="ghost" onPress={disconnect} />
          </>
        )}

        {connected && (
          <>
            <Text style={font.body}>
              @{settings.telegramBotName} → <Text style={{ fontWeight: '700' }}>{settings.telegramChatName}</Text>
            </Text>
            <ToggleRow
              label="Enviar los reportes programados"
              hint="En PDF o texto, según cada programación"
              value={settings.telegramSendReports}
              onChange={(v) => toggle('telegramSendReports', v)}
            />
            <ToggleRow
              label="Resumen diario de avisos"
              hint={`Por vencer, deudas y almacén, a partir de las ${String(settings.notifyHour).padStart(2, '0')}:00 (hora del resumen en Ajustes)`}
              value={settings.telegramDailySummary}
              onChange={(v) => toggle('telegramDailySummary', v)}
            />
            <View style={styles.buttons}>
              <Button title="Enviar prueba" icon="paper-plane-outline" variant="secondary" loading={busy === 'test'} onPress={test} style={styles.button} />
              <Button title="Desconectar" icon="close-circle-outline" variant="danger" onPress={disconnect} style={styles.button} />
            </View>
          </>
        )}
      </Card>
    </>
  );
}

function WhatsAppSection({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [adminPhone, setAdminPhone] = useState(settings.adminPhone);
  const [expiring, setExpiring] = useState(settings.templateExpiring);
  const [expired, setExpired] = useState(settings.templateExpired);
  const [debt, setDebt] = useState(settings.templateDebt);
  const [saving, setSaving] = useState(false);
  const multiline = { multiline: true, style: { minHeight: 88, textAlignVertical: 'top' as const, paddingTop: spacing.md } };

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(db, { adminPhone: adminPhone.replace(/\D/g, ''), templateExpiring: expiring, templateExpired: expired, templateDebt: debt });
      Alert.alert('Guardado', 'Los mensajes de WhatsApp se actualizaron.');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setExpiring(DEFAULT_SETTINGS.templateExpiring);
    setExpired(DEFAULT_SETTINGS.templateExpired);
    setDebt(DEFAULT_SETTINGS.templateDebt);
  };

  return (
    <>
      <SectionTitle title="WhatsApp" />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <IconCircle icon="logo-whatsapp" color={colors.whatsappDark} bg={colors.whatsappSoft} size={48} />
          <Text style={[font.small, { flex: 1 }]}>
            WhatsApp no permite enviar mensajes solos desde la app: se abre el chat con el texto listo y se toca enviar.
          </Text>
        </View>
        <Field
          label="Celular del administrador"
          value={adminPhone}
          onChangeText={setAdminPhone}
          keyboardType="phone-pad"
          placeholder="9 dígitos"
          hint="Para enviarle reportes por WhatsApp desde la pantalla de cada reporte"
        />
        <Text style={font.h3}>Mensajes para clientes</Text>
        <Text style={font.small}>Puedes usar {TEMPLATE_VARIABLES.join(', ')}.</Text>
        <Field label="Membresía por vencer" value={expiring} onChangeText={setExpiring} {...multiline} />
        <Field label="Membresía vencida" value={expired} onChangeText={setExpired} {...multiline} />
        <Field label="Deuda pendiente" value={debt} onChangeText={setDebt} {...multiline} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button title="Restablecer textos" icon="refresh" variant="secondary" onPress={reset} style={{ flexGrow: 1 }} />
          <Button title="Guardar" icon="checkmark" loading={saving} onPress={save} style={{ flexGrow: 1 }} />
        </View>
      </Card>
    </>
  );
}

function DeliveriesSection({ deliveries, onChanged }: { deliveries: Delivery[]; onChanged: () => void }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [retrying, setRetrying] = useState<number | null>(null);
  if (deliveries.length === 0) return null;

  const retry = async (d: Delivery) => {
    setRetrying(d.id);
    try {
      const result = d.kind === 'report' && d.ref_id ? await sendReport(db, d.ref_id, { deliveryId: d.id }) : await sendSummary(db, d.id);
      if (!result.ok) Alert.alert('No se pudo enviar', result.error);
    } finally {
      setRetrying(null);
      onChanged();
    }
  };

  return (
    <>
      <SectionTitle title="Envíos recientes" action="Reintentar pendientes" onAction={() => runDueDeliveries(db).finally(onChanged)} />
      <Card style={{ padding: 0 }}>
        {deliveries.map((d, i) => {
          const sent = d.status === 'sent';
          const canRetry = !sent && (d.kind === 'summary' || (d.kind === 'report' && !!d.ref_id));
          return (
            <View key={d.id} style={[styles.delivery, i > 0 && styles.border]}>
              <Ionicons name={sent ? 'checkmark-circle' : 'alert-circle'} size={22} color={sent ? colors.primary : colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>{d.title}</Text>
                <Text style={font.small}>
                  {DELIVERY_KINDS[d.kind]} · {formatDateTime(d.sent_at ?? d.created_at)}
                </Text>
                {!sent && d.error && <Text style={[font.small, { color: colors.danger }]}>{d.error}</Text>}
              </View>
              {canRetry && <Button title="Reintentar" variant="secondary" loading={retrying === d.id} onPress={() => retry(d)} style={styles.retry} />}
            </View>
          );
        })}
      </Card>
    </>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const styles = useStyles();
  const { font } = useTheme();
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{n}</Text>
      </View>
      <Text style={[font.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors, font } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={font.h3}>{label}</Text>
        <Text style={font.small}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
    buttons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    button: { flexGrow: 1, flexBasis: 180 },
    step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    stepNumberText: { color: colors.white, fontWeight: '800' },
    delivery: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    border: { borderTopWidth: 1, borderTopColor: colors.border },
    retry: { minHeight: 40 },
  }),
);
