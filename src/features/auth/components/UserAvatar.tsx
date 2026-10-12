import { Text, View } from 'react-native';

import type { Role } from '@/features/auth/db/users';
import { useTheme } from '@/theme';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function UserAvatar({ name, role, size = 48 }: { name: string; role: Role; size?: number }) {
  const { colors } = useTheme();
  const admin = role === 'admin';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: admin ? colors.primary : colors.infoSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: admin ? colors.white : colors.info }}>{initials(name)}</Text>
    </View>
  );
}
