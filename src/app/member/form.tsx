import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Button, Card, Chip, Field } from '@/components/ui';
import { session } from '@/features/auth/lib/session';
import {
  createMember,
  findMemberByDni,
  fullName,
  getMember,
  PROSPECT_SOURCES,
  STATUS_LABELS,
  updateMember,
  type Member,
  type MemberInput,
  type MemberStatus,
} from '@/features/members/db/members';
import { describeAge, persistMemberPhoto } from '@/features/members/lib/contact';
import { useIsWide } from '@/lib/layout';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

const STATUSES: MemberStatus[] = ['prospect', 'active', 'inactive'];

const EMPTY: MemberInput = {
  first_name: '',
  last_name: '',
  dni: null,
  phone: null,
  photo_uri: null,
  birth_date: null,
  emergency_name: null,
  emergency_phone: null,
  notes: null,
  status: 'prospect',
  source: null,
};

export default function MemberFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data } = useFocusQuery(async (db) => (id ? await getMember(db, Number(id)) : null), [id]);
  if (id && !data) return null;
  return <MemberForm key={id ?? 'new'} member={data ?? null} />;
}

function MemberForm({ member }: { member: Member | null }) {
  const styles = useStyles();
  const { font } = useTheme();
  const db = useSQLiteContext();
  const wide = useIsWide();
  const [form, setForm] = useState<MemberInput>(member ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof MemberInput>(key: K, value: MemberInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

  const save = async () => {
    if (form.first_name.trim().length < 2) return Alert.alert('Falta el nombre', 'Escribe al menos el nombre del cliente.');
    if (form.dni && form.dni.length !== 8) return Alert.alert('DNI incompleto', 'El DNI debe tener 8 dígitos.');
    if (form.dni) {
      const other = await findMemberByDni(db, form.dni, member?.id);
      if (other) return Alert.alert('DNI repetido', `Ese DNI ya está registrado para ${fullName(other)}.`);
    }

    setSaving(true);
    try {
      const photo = form.photo_uri ? await persistMemberPhoto(form.photo_uri) : null;
      const input = { ...form, photo_uri: photo };
      if (member) await updateMember(db, member.id, input);
      else await createMember(db, input, session.get()?.id ?? null);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e));
    } finally {
      setSaving(false);
    }
  };

  const personal = (
    <Card style={styles.card}>
      <PhotoPicker uri={form.photo_uri} onChange={(uri) => set('photo_uri', uri)} title="Foto del cliente" icon="person-outline" />
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label="Nombres *" value={form.first_name} onChangeText={(v) => set('first_name', v)} placeholder="Ej.: María" autoFocus={!member} />
        </View>
        <View style={styles.half}>
          <Field label="Apellidos" value={form.last_name} onChangeText={(v) => set('last_name', v)} placeholder="Ej.: Torres Díaz" />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label="DNI" value={form.dni ?? ''} onChangeText={(v) => set('dni', digits(v, 8))} keyboardType="number-pad" maxLength={8} />
        </View>
        <View style={styles.half}>
          <Field label="Celular" value={form.phone ?? ''} onChangeText={(v) => set('phone', digits(v, 12))} keyboardType="phone-pad" placeholder="9 dígitos" />
        </View>
      </View>
      <DateField
        label="Fecha de nacimiento"
        value={form.birth_date}
        onChange={(v) => set('birth_date', v)}
        describe={describeAge}
        maximumDate={new Date()}
      />
    </Card>
  );

  const membership = (
    <Card style={styles.card}>
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Estado</Text>
        <View style={styles.chips}>
          {STATUSES.map((s) => (
            <Chip key={s} label={STATUS_LABELS[s]} selected={form.status === s} onPress={() => set('status', s)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>¿Cómo nos conoció?</Text>
        <View style={styles.chips}>
          {PROSPECT_SOURCES.map((s) => (
            <Chip key={s} label={s} selected={form.source === s} onPress={() => set('source', form.source === s ? null : s)} />
          ))}
        </View>
      </View>
    </Card>
  );

  const extra = (
    <Card style={styles.card}>
      <Text style={font.h3}>Contacto de emergencia</Text>
      <View style={styles.pair}>
        <View style={styles.half}>
          <Field label="Nombre" value={form.emergency_name ?? ''} onChangeText={(v) => set('emergency_name', v)} />
        </View>
        <View style={styles.half}>
          <Field label="Celular" value={form.emergency_phone ?? ''} onChangeText={(v) => set('emergency_phone', digits(v, 12))} keyboardType="phone-pad" />
        </View>
      </View>
      <Field
        label="Notas"
        value={form.notes ?? ''}
        onChangeText={(v) => set('notes', v)}
        placeholder="Lesiones, objetivos, horarios preferidos…"
        multiline
        style={{ minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md }}
      />
    </Card>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen options={{ title: member ? 'Editar cliente' : 'Nuevo cliente' }} />
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]} keyboardShouldPersistTaps="handled">
        {wide ? (
          <View style={styles.columns}>
            <View style={styles.column}>{personal}</View>
            <View style={styles.column}>
              {membership}
              {extra}
            </View>
          </View>
        ) : (
          <>
            {personal}
            {membership}
            {extra}
          </>
        )}
        <Button title={member ? 'Guardar cambios' : 'Registrar cliente'} icon="checkmark" loading={saving} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 },
    contentWide: { padding: spacing.xl, width: '100%', maxWidth: 1100, alignSelf: 'center' },
    columns: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
    column: { flex: 1, gap: spacing.lg },
    card: { gap: spacing.lg },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    half: { flexGrow: 1, flexBasis: 200 },
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  }),
);
