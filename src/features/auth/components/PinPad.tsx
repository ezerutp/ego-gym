import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PIN_LENGTH } from '@/features/auth/db/users';
import { makeStyles, spacing, useTheme } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

type Props = {
  value: string;
  onChange: (pin: string) => void;
  /** Called once the PIN reaches its full length. */
  onComplete: (pin: string) => void;
  disabled?: boolean;
  error?: boolean;
};

export function PinPad({ value, onChange, onComplete, disabled, error }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();

  const press = (key: (typeof KEYS)[number]) => {
    if (disabled) return;
    Haptics.selectionAsync();
    if (key === 'del') return onChange(value.slice(0, -1));
    if (value.length >= PIN_LENGTH) return;
    const next = value + key;
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i < value.length && { backgroundColor: error ? colors.danger : colors.primary, borderColor: error ? colors.danger : colors.primary }]}
          />
        ))}
      </View>
      <View style={[styles.grid, disabled && { opacity: 0.4 }]}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              onPress={() => press(key)}
              disabled={disabled}
              style={({ pressed }) => [styles.key, styles.keyButton, pressed && { backgroundColor: colors.primarySoft }]}
            >
              {key === 'del' ? <Ionicons name="backspace-outline" size={26} color={colors.ink} /> : <Text style={styles.keyText}>{key}</Text>}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const KEY_SIZE = 76;

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', gap: spacing.xl },
    dots: { flexDirection: 'row', gap: spacing.lg },
    dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.faint },
    grid: { width: KEY_SIZE * 3 + spacing.lg * 2, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
    key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
    keyButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    keyText: { fontSize: 28, fontWeight: '600', color: colors.ink },
  }),
);
