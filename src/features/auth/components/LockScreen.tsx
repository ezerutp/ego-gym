import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field } from '@/components/ui';
import { getSettings } from '@/db/settings';
import { PinPad } from '@/features/auth/components/PinPad';
import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { createUser, listUsers, PIN_LENGTH, ROLE_LABELS, verifyPin, type User } from '@/features/auth/db/users';
import { formatRecoveryCode, generateRecoveryCode, storeRecoveryCode } from '@/features/auth/lib/recovery';
import { session } from '@/features/auth/lib/session';
import { useIsWide } from '@/lib/layout';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

/** Drawn over the whole app while nobody is signed in, outside of navigation on purpose. */
export function LockScreen() {
  const styles = useStyles();
  const db = useSQLiteContext();
  const [data, setData] = useState<{ users: User[]; gymName: string }>();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([listUsers(db), getSettings(db)]).then(([users, settings]) => {
      if (alive) setData({ users, gymName: settings.storeName });
    });
    return () => {
      alive = false;
    };
  }, [db, version]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (!data) return <SafeAreaView style={styles.safe} />;
  if (data.users.length === 0) return <FirstAdminSetup gymName={data.gymName} onCreated={reload} />;
  return <UserLogin users={data.users} gymName={data.gymName} />;
}

function Brand({ gymName, subtitle }: { gymName: string; subtitle: string }) {
  const styles = useStyles();
  const { font } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <Text style={styles.brand}>EGO</Text>
      <Text style={font.h2}>{gymName}</Text>
      <Text style={font.small}>{subtitle}</Text>
    </View>
  );
}

function UserLogin({ users, gymName }: { users: User[]; gymName: string }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const wide = useIsWide();
  const [selected, setSelected] = useState<User | null>(users.length === 1 ? users[0] : null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedFor, setLockedFor] = useState(0);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockedFor]);

  const choose = (user: User) => {
    setSelected(user);
    setPin('');
    setError('');
  };

  const submit = async (value: string) => {
    if (!selected) return;
    let valid = false;
    try {
      valid = await verifyPin(db, selected.id, value);
    } catch (e) {
      setPin('');
      return Alert.alert('No se pudo verificar el PIN', String(e));
    }
    if (valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      session.signIn(selected);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const failed = attempts + 1;
    setAttempts(failed);
    setPin('');
    if (failed >= MAX_ATTEMPTS) {
      setAttempts(0);
      setLockedFor(LOCKOUT_SECONDS);
      setError('');
    } else {
      setError('PIN incorrecto');
    }
  };

  const userList = (
    <ScrollView contentContainerStyle={styles.userList}>
      {users.map((user) => {
        const active = selected?.id === user.id;
        return (
          <Pressable key={user.id} onPress={() => choose(user)} style={[styles.userRow, active && styles.userRowActive]}>
            <UserAvatar name={user.name} role={user.role} />
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>{user.name}</Text>
              <Text style={font.small}>{ROLE_LABELS[user.role]}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const pad = selected && (
    <View style={styles.padArea}>
      {!wide && users.length > 1 && (
        <Pressable onPress={() => setSelected(null)} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Cambiar usuario</Text>
        </Pressable>
      )}
      <UserAvatar name={selected.name} role={selected.role} size={64} />
      <Text style={font.h2}>Hola, {selected.name.split(' ')[0]}</Text>
      <Text style={[font.small, (error || lockedFor > 0) && { color: colors.danger, fontWeight: '600' }]}>
        {lockedFor > 0 ? `Demasiados intentos. Espera ${lockedFor} s` : error || `Ingresa tu PIN de ${PIN_LENGTH} dígitos`}
      </Text>
      <PinPad value={pin} onChange={(v) => (setPin(v), setError(''))} onComplete={submit} disabled={lockedFor > 0} error={!!error} />
    </View>
  );

  if (wide) {
    return (
      <SafeAreaView style={[styles.safe, styles.wideRow]}>
        <View style={styles.side}>
          <Brand gymName={gymName} subtitle="¿Quién está en recepción?" />
          {userList}
        </View>
        <View style={styles.main}>{pad ?? <Text style={font.small}>Elige tu usuario para continuar</Text>}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {pad ?? (
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.xl }}>
          <Brand gymName={gymName} subtitle="¿Quién está en recepción?" />
          {userList}
        </View>
      )}
    </SafeAreaView>
  );
}

function FirstAdminSetup({ gymName, onCreated }: { gymName: string; onCreated: () => void }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const [step, setStep] = useState<'name' | 'pin' | 'confirm' | 'recovery'>('name');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [pendingAdmin, setPendingAdmin] = useState<{ id: number; name: string } | null>(null);
  const [recoveryCode, setRecoveryCode] = useState('');

  const enter = () => {
    if (!pendingAdmin) return;
    session.signIn({ id: pendingAdmin.id, name: pendingAdmin.name, role: 'admin' });
    onCreated();
  };

  const onPin = async (value: string) => {
    if (step === 'pin') {
      setFirstPin(value);
      setPin('');
      setStep('confirm');
      return;
    }
    if (value !== firstPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Los PIN no coinciden, vuelve a crearlo');
      setPin('');
      setFirstPin('');
      setStep('pin');
      return;
    }
    let id: number;
    try {
      id = await createUser(db, { name, role: 'admin', pin: value });
    } catch (e) {
      setPin('');
      return Alert.alert('No se pudo crear el administrador', String(e));
    }
    try {
      const code = await generateRecoveryCode();
      await storeRecoveryCode(db, code);
      setRecoveryCode(code);
    } catch (e) {
      setPin('');
      return Alert.alert('No se pudo crear el código de recuperación', String(e));
    }
    setPendingAdmin({ id, name: name.trim() });
    setPin('');
    setStep('recovery');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
          <Brand gymName={gymName} subtitle="Configuración inicial" />
          <Card style={styles.setupCard}>
            {step === 'name' ? (
              <>
                <Text style={font.h2}>Crea el usuario administrador</Text>
                <Text style={font.small}>
                  El administrador configura planes, precios, reportes, integraciones y usuarios. Luego podrás agregar a los recepcionistas.
                </Text>
                <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej.: Carlos Pérez" autoFocus />
                <Button title="Continuar" icon="arrow-forward" disabled={name.trim().length < 2} onPress={() => setStep('pin')} />
              </>
            ) : step === 'recovery' ? (
              <View style={{ alignItems: 'center', gap: spacing.md }}>
                <Text style={font.h2}>Anota tu código de recuperación</Text>
                <Text style={[font.small, { textAlign: 'center' }]}>
                  Si olvidas tu PIN, este código te dejará crear uno nuevo sin internet. No se volverá a mostrar.
                </Text>
                <Text style={[font.h2, { letterSpacing: 2 }]}>{formatRecoveryCode(recoveryCode)}</Text>
                <Button title="Lo anoté, entrar" icon="checkmark" onPress={enter} />
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: spacing.md }}>
                <Text style={font.h2}>{step === 'pin' ? 'Crea tu PIN' : 'Confirma tu PIN'}</Text>
                <Text style={[font.small, error && { color: colors.danger, fontWeight: '600' }]}>
                  {error || `${PIN_LENGTH} dígitos que usarás para entrar`}
                </Text>
                <PinPad value={pin} onChange={(v) => (setPin(v), setError(''))} onComplete={onPin} error={!!error} />
                <Button title="Cambiar nombre" variant="ghost" onPress={() => (setStep('name'), setPin(''), setFirstPin(''))} />
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    brand: { fontSize: 34, fontWeight: '900', color: colors.primary, letterSpacing: 2 },
    wideRow: { flexDirection: 'row' },
    side: { width: 380, padding: spacing.xxl, gap: spacing.xl, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
    main: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    userList: { gap: spacing.sm },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    userRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    padArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    back: { position: 'absolute', top: spacing.lg, left: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 2 },
    setup: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.xl },
    setupCard: { width: '100%', maxWidth: 480, gap: spacing.lg },
  }),
);
