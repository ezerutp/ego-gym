import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { setPin, type User } from '@/features/auth/db/users';
import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { PinPad } from '@/features/auth/components/PinPad';
import { normalizeRecoveryCode, verifyRecoveryCode } from '@/features/auth/lib/recovery';
import { session } from '@/features/auth/lib/session';
import { makeStyles, spacing } from '@/theme';

const MAX_FAILURES = 5;

type Step = 'menu' | 'code' | 'new' | 'confirm';

/** Lets a locked-out user define a new PIN after proving ownership. */
export function PinRecovery({ user, onBack }: { user: User; onBack: () => void }) {
  const styles = useStyles();
  const db = useSQLiteContext();
  const [step, setStep] = useState<Step>('menu');
  const [code, setCode] = useState('');
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState('');
  const [pin, setPinValue] = useState('');
  const [firstPin, setFirstPin] = useState('');

  const checkCode = async () => {
    if (normalizeRecoveryCode(code).length !== 8) return setError('El código tiene 8 letras y números.');
    let valid = false;
    try {
      valid = await verifyRecoveryCode(db, code);
    } catch (e) {
      return Alert.alert('No se pudo verificar el código', String(e));
    }
    if (valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCode('');
      setError('');
      setStep('new');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const failed = failures + 1;
    setFailures(failed);
    if (failed >= MAX_FAILURES) {
      Alert.alert('Demasiados intentos', 'Vuelve a la pantalla de entrada e inténtalo más tarde.');
      onBack();
    } else {
      setError('Código incorrecto');
    }
  };

  const onPin = async (value: string) => {
    if (step === 'new') {
      setFirstPin(value);
      setPinValue('');
      setStep('confirm');
      return;
    }
    if (value !== firstPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Los PIN no coinciden, créalo de nuevo');
      setPinValue('');
      setFirstPin('');
      setStep('new');
      return;
    }
    try {
      await setPin(db, user.id, value);
    } catch (e) {
      setPinValue('');
      return Alert.alert('No se pudo guardar el PIN', String(e));
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    session.signIn({ id: user.id, name: user.name, role: user.role });
    onBack();
  };

  return (
    <View style={styles.wrap}>
      <UserAvatar name={user.name} role={user.role} size={64} />
      {step === 'menu' && (
        <>
          <Text style={styles.title}>¿Olvidaste tu PIN, {user.name.split(' ')[0]}?</Text>
          <Text style={styles.hint}>Si tienes el código de recuperación que se anotó al configurar la app, podrás crear un PIN nuevo.</Text>
          <Button title="Tengo el código de recuperación" icon="key-outline" onPress={() => (setStep('code'), setError(''))} />
          <Button title="Volver" variant="ghost" onPress={onBack} />
        </>
      )}
      {step === 'code' && (
        <>
          <Text style={styles.title}>Ingresa el código</Text>
          <Text style={[styles.hint, !!error && styles.error]}>{error || 'Formato XXXX-XXXX, sin importar mayúsculas.'}</Text>
          <View style={styles.field}>
            <Field label="Código de recuperación" value={code} onChangeText={(v) => (setCode(v), setError(''))} autoCapitalize="characters" autoCorrect={false} maxLength={9} placeholder="XXXX-XXXX" autoFocus />
          </View>
          <Button title="Verificar" icon="checkmark" onPress={checkCode} />
          <Button title="Volver" variant="ghost" onPress={onBack} />
        </>
      )}
      {(step === 'new' || step === 'confirm') && (
        <>
          <Text style={styles.title}>{step === 'new' ? 'Crea tu PIN nuevo' : 'Confirma tu PIN nuevo'}</Text>
          <Text style={[styles.hint, !!error && styles.error]}>{error || ' '}</Text>
          <PinPad value={pin} onChange={(v) => (setPinValue(v), setError(''))} onComplete={onPin} error={!!error} />
          <Button title="Volver" variant="ghost" onPress={onBack} />
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, font }) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', gap: spacing.md, width: '100%', maxWidth: 420 },
    title: { ...font.h2, textAlign: 'center' },
    hint: { ...font.small, textAlign: 'center' },
    error: { color: colors.danger, fontWeight: '600' },
    field: { width: '100%' },
  }),
);
