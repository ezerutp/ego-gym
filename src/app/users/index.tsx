import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Pill } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { listUsers, ROLE_LABELS } from '@/features/auth/db/users';
import { useSession } from '@/features/auth/lib/session';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function UsersScreen() {
  return (
    <AdminOnly>
      <UsersScreenContent />
    </AdminOnly>
  );
}

function UsersScreenContent() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const me = useSession();
  const { data: users } = useFocusQuery((db) => listUsers(db, { includeInactive: true }));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={font.small}>Cada persona entra con su PIN. Solo el administrador puede cambiar planes, precios, reportes, integraciones, usuarios y ajustes, y borrar registros.</Text>
      <Card style={{ padding: 0 }}>
        {users?.map((user, i) => (
          <Pressable
            key={user.id}
            onPress={() => router.push({ pathname: '/users/[id]', params: { id: user.id } })}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.7 }, !user.active && { opacity: 0.5 }]}
          >
            <UserAvatar name={user.name} role={user.role} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={font.h3}>
                {user.name}
                {user.id === me?.id ? ' (tú)' : ''}
              </Text>
              <Text style={font.small}>{ROLE_LABELS[user.role]}</Text>
            </View>
            {!user.active && <Pill label="Desactivado" />}
            <Ionicons name="chevron-forward" size={20} color={colors.faint} />
          </Pressable>
        ))}
      </Card>
      <Button title="Nuevo usuario" icon="person-add" onPress={() => router.push({ pathname: '/users/[id]', params: { id: 'new' } })} />
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
