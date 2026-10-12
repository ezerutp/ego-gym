import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Field } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { createUser, getUser, PIN_LENGTH, ROLE_LABELS, setPin, updateUser, wouldRemoveLastAdmin, type Role, type User } from '@/features/auth/db/users';
import { session } from '@/features/auth/lib/session';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const ROLES: { role: Role; hint: string }[] = [
  { role: 'reception', hint: 'Clientes, cobros, ventas y almacén' },
  { role: 'admin', hint: 'Acceso completo, incluida la configuración' },
];

export default function UserScreen() {
  return (
    <AdminOnly>
      <UserScreenContent />
    </AdminOnly>
  );
}

function UserScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { data } = useFocusQuery(async (db) => (isNew ? null : await getUser(db, Number(id))), [id]);

  if (!isNew && !data) return null;
  return <UserForm key={id} user={data ?? null} />;
}

const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_LENGTH);

function UserForm({ user }: { user: User | null }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'reception');
  const [active, setActive] = useState(user ? user.active === 1 : true);
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) return Alert.alert('Falta el nombre', 'Escribe el nombre de la persona.');
    const changingPin = !user || pin.length > 0 || confirm.length > 0;
    if (changingPin && pin.length !== PIN_LENGTH) return Alert.alert('PIN incompleto', `El PIN debe tener ${PIN_LENGTH} dígitos.`);
    if (changingPin && pin !== confirm) return Alert.alert('PIN distinto', 'El PIN y su confirmación no coinciden.');
    if (user && (await wouldRemoveLastAdmin(db, user.id, { role, active }))) {
      return Alert.alert('Se necesita un administrador', 'Debe quedar al menos un administrador activo.');
    }

    setSaving(true);
    try {
      if (user) {
        await updateUser(db, user.id, { name, role, active });
        if (changingPin) await setPin(db, user.id, pin);
      } else {
        await createUser(db, { name, role, pin });
      }
      router.back();
      // Applied after leaving: a role change can drop access to this admin-only screen.
      if (user && !active && session.get()?.id === user.id) session.signOut();
      else if (user) session.update({ id: user.id, name: name.trim(), role });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen options={{ title: user ? user.name : 'Nuevo usuario' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.lg }}>
          <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej.: María Torres" />
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Rol</Text>
            <View style={styles.roles}>
              {ROLES.map((r) => {
                const selected = role === r.role;
                return (
                  <Pressable key={r.role} onPress={() => setRole(r.role)} style={[styles.role, selected && styles.roleSelected]}>
                    <Text style={[font.h3, selected && { color: colors.primaryDark }]}>{ROLE_LABELS[r.role]}</Text>
                    <Text style={font.small}>{r.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {user && (
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>Activo</Text>
                <Text style={font.small}>Un usuario desactivado ya no aparece al entrar.</Text>
              </View>
              <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>
          )}
        </Card>

        <Card style={{ gap: spacing.lg }}>
          <View>
            <Text style={font.h3}>{user ? 'Cambiar PIN' : 'PIN'}</Text>
            <Text style={font.small}>{user ? 'Déjalo vacío para mantener el PIN actual.' : `${PIN_LENGTH} dígitos para entrar a la app.`}</Text>
          </View>
          <View style={styles.pinRow}>
            <View style={{ flex: 1 }}>
              <Field label="PIN" value={pin} onChangeText={(v) => setPinValue(onlyDigits(v))} keyboardType="number-pad" secureTextEntry maxLength={PIN_LENGTH} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Confirmar PIN" value={confirm} onChangeText={(v) => setConfirm(onlyDigits(v))} keyboardType="number-pad" secureTextEntry maxLength={PIN_LENGTH} />
            </View>
          </View>
        </Card>

        <Button title={user ? 'Guardar cambios' : 'Crear usuario'} icon="checkmark" loading={saving} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
    roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    role: { flexGrow: 1, flexBasis: 220, padding: spacing.lg, gap: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    roleSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    pinRow: { flexDirection: 'row', gap: spacing.md },
  }),
);
