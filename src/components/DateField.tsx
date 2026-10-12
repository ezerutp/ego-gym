import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { describeExpiry, formatDay, parseIsoDay, toIsoDay } from '@/lib/format';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

type Props = { label: string; value: string | null; onChange: (value: string | null) => void; placeholder?: string };

export function DateField({ label, value, onChange, placeholder = 'Sin fecha' }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const open = () => {
    DateTimePickerAndroid.open({
      value: value ? parseIsoDay(value) : new Date(),
      mode: 'date',
      title: label,
      onValueChange: (_event, date) => onChange(toIsoDay(date)),
    });
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={open} style={styles.box}>
        <Ionicons name="calendar-outline" size={20} color={colors.muted} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.value, !value && { color: colors.faint }]}>{value ? formatDay(value) : placeholder}</Text>
          {value && <Text style={styles.sub}>{describeExpiry(value)}</Text>}
        </View>
        {value && (
          <Pressable hitSlop={10} onPress={() => onChange(null)}>
            <Ionicons name="close-circle" size={20} color={colors.faint} />
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 52,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    value: { fontSize: 16, color: colors.ink },
    sub: { fontSize: 12, color: colors.muted },
  }),
);
