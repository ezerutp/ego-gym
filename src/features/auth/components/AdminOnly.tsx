import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button, EmptyState } from '@/components/ui';
import { useSession } from '@/features/auth/lib/session';
import { spacing } from '@/theme';

/** Guards admin screens inside the screen itself, so the navigator's screen list never changes. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const user = useSession();
  if (user?.role === 'admin') return children;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
      <EmptyState icon="lock-closed-outline" title="Solo administrador" message="Pide al administrador que entre con su PIN para ver esta sección.">
        <Button title="Volver" icon="arrow-back" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </EmptyState>
    </View>
  );
}
