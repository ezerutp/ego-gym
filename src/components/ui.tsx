import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { makeStyles, radius, spacing, useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type ButtonProps = {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.5 : 1 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={palette.fg} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const styles = useStyles();
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}

export function ProductThumb({ uri, size = 52 }: { uri: string | null; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: size * 0.28 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <Ionicons name="cube-outline" size={size * 0.45} color={colors.faint} />
      )}
    </View>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const c = {
    neutral: { bg: colors.background, fg: colors.text },
    success: { bg: colors.primarySoft, fg: colors.primaryDark },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: colors.infoSoft, fg: colors.info },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {icon && <Ionicons name={icon} size={12} color={c.fg} />}
      <Text style={[styles.pillText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

type FieldProps = TextInputProps & { label: string; hint?: string; prefix?: string };

export function Field({ label, hint, prefix, style, ...input }: FieldProps) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput placeholderTextColor={colors.faint} style={[styles.input, style]} {...input} />
      </View>
      {hint && <Text style={font.small}>{hint}</Text>}
    </View>
  );
}

export function Stepper({ value, onChange, min = 0, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const change = (next: number) => {
    if (next < min || (max != null && next > max)) return;
    Haptics.selectionAsync();
    onChange(next);
  };
  return (
    <View style={styles.stepper}>
      <Pressable hitSlop={8} onPress={() => change(value - 1)} style={styles.stepperBtn}>
        <Ionicons name="remove" size={20} color={colors.ink} />
      </Pressable>
      <TextInput
        value={String(value)}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/\D/g, '') || '0', 10);
          onChange(max != null ? Math.min(n, max) : n);
        }}
        keyboardType="number-pad"
        style={styles.stepperValue}
        selectTextOnFocus
      />
      <Pressable hitSlop={8} onPress={() => change(value + 1)} style={styles.stepperBtn}>
        <Ionicons name="add" size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={font.h3}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ icon, title, message, children }: { icon: IconName; title: string; message: string; children?: ReactNode }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={[font.h3, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[font.small, { textAlign: 'center', maxWidth: 280 }]}>{message}</Text>
      {children}
    </View>
  );
}

export function IconCircle({ icon, color, bg, size = 40 }: { icon: IconName; color: string; bg: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) =>
  StyleSheet.create({
    button: {
      minHeight: 52,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    buttonText: { fontSize: 16, fontWeight: '700' },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
    thumb: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
    pillText: { fontSize: 12, fontWeight: '700' },
    label: { fontSize: 13, fontWeight: '600', color: colors.text },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
    },
    prefix: { fontSize: 16, color: colors.muted, marginRight: 6, fontWeight: '600' },
    input: { flex: 1, minHeight: 50, fontSize: 16, color: colors.ink },
    stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, padding: 4 },
    stepperBtn: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    stepperValue: { minWidth: 48, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.ink, paddingVertical: 0 },
    sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
    empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  }),
);
