import { Text, View } from 'react-native';

import { Chip } from '@/components/ui';
import { PAYMENT_METHODS, type PaymentMethod } from '@/features/payments/db/payments';
import { spacing, useTheme } from '@/theme';

const METHODS = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

export function PaymentMethodPicker({ value, onChange }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Método de pago</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {METHODS.map((m) => (
          <Chip key={m} label={PAYMENT_METHODS[m]} selected={value === m} onPress={() => onChange(m)} />
        ))}
      </View>
    </View>
  );
}
