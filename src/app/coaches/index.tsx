import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Pill } from '@/components/ui';
import { AdminOnly } from '@/features/auth/components/AdminOnly';
import { MemberAvatar } from '@/features/members/components/MemberBits';
import { listCoaches } from '@/features/memberships/db/coaches';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function CoachesScreen() {
  return (
    <AdminOnly>
      <CoachesScreenContent />
    </AdminOnly>
  );
}

function CoachesScreenContent() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const { data: coaches } = useFocusQuery((db) => listCoaches(db, { includeInactive: true }));
  const openNew = () => router.push({ pathname: '/coaches/[id]', params: { id: 'new' } });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={font.small}>Los coaches se asignan al inscribir a un cliente con personalizado.</Text>
      {coaches?.length === 0 ? (
        <Card>
          <EmptyState icon="barbell-outline" title="Aún no hay coaches" message="Registra a tus coaches para asignarles clientes con personalizado." />
        </Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {coaches?.map((coach, i) => (
            <Pressable
              key={coach.id}
              onPress={() => router.push({ pathname: '/coaches/[id]', params: { id: coach.id } })}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.7 }, !coach.active && { opacity: 0.5 }]}
            >
              <MemberAvatar member={{ first_name: coach.name, last_name: '', photo_uri: coach.photo_uri }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={font.h3}>{coach.name}</Text>
                <Text style={font.small}>{coach.specialty || 'Sin especialidad'}</Text>
              </View>
              {coach.active ? (
                <Pill label={`${coach.clients} ${coach.clients === 1 ? 'cliente' : 'clientes'}`} tone={coach.clients ? 'success' : 'neutral'} />
              ) : (
                <Pill label="Inactivo" />
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.faint} />
            </Pressable>
          ))}
        </Card>
      )}
      <Button title="Nuevo coach" icon="person-add" onPress={openNew} />
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 760, alignSelf: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
