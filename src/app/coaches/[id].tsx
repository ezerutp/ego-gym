import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { PhotoPicker } from '@/components/PhotoPicker';
import { Button, Card, Field, SectionTitle } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { MemberRow } from '@/features/members/components/MemberBits';
import { persistMemberPhoto } from '@/features/members/lib/contact';
import { getCoach, listCoachClients, saveCoach, type Coach } from '@/features/memberships/db/coaches';
import { formatDay } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function CoachScreen() {
  return (
    <AdminOnly>
      <CoachScreenContent />
    </AdminOnly>
  );
}

function CoachScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { data } = useFocusQuery(
    async (db) => (isNew ? null : { coach: await getCoach(db, Number(id)), clients: await listCoachClients(db, Number(id)) }),
    [id],
  );
  if (!isNew && !data?.coach) return null;
  return <CoachForm key={id} coach={data?.coach ?? null} clients={data?.clients ?? []} />;
}

type Clients = Awaited<ReturnType<typeof listCoachClients>>;

function CoachForm({ coach, clients }: { coach: Coach | null; clients: Clients }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [name, setName] = useState(coach?.name ?? '');
  const [phone, setPhone] = useState(coach?.phone ?? '');
  const [specialty, setSpecialty] = useState(coach?.specialty ?? '');
  const [photo, setPhoto] = useState(coach?.photo_uri ?? null);
  const [active, setActive] = useState(coach ? coach.active === 1 : true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) return Alert.alert('Falta el nombre', 'Escribe el nombre del coach.');
    setSaving(true);
    try {
      const photoUri = photo ? await persistMemberPhoto(photo) : null;
      await saveCoach(db, coach?.id ?? null, { name, phone, specialty, photo_uri: photoUri, active });
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen options={{ title: coach ? coach.name : 'Nuevo coach' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.lg }}>
          <PhotoPicker uri={photo} onChange={setPhoto} title="Foto del coach" icon="person-outline" />
          <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej.: Luis Ramírez" />
          <View style={styles.pair}>
            <View style={styles.half}>
              <Field label="Celular" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 12))} keyboardType="phone-pad" />
            </View>
            <View style={styles.half}>
              <Field label="Especialidad" value={specialty} onChangeText={setSpecialty} placeholder="Ej.: Fuerza, funcional" />
            </View>
          </View>
          {coach && (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>Activo</Text>
                <Text style={font.small}>Un coach inactivo ya no aparece al inscribir.</Text>
              </View>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>
          )}
        </Card>
        <Button title={coach ? 'Guardar cambios' : 'Registrar coach'} icon="checkmark" loading={saving} onPress={save} />

        {coach && (
          <>
            <SectionTitle title={`Clientes con personalizado (${clients.length})`} />
            {clients.length === 0 ? (
              <Text style={font.small}>Todavía no tiene clientes con personalizado vigente.</Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {clients.map((m) => (
                  <View key={m.id} style={{ gap: 4 }}>
                    <MemberRow member={m} onPress={() => router.push({ pathname: '/member/[id]', params: { id: m.id } })} />
                    <Text style={[font.small, { marginLeft: spacing.md }]}>Personalizado hasta el {formatDay(m.personal_end)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    half: { flexGrow: 1, flexBasis: 200 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  }),
);
