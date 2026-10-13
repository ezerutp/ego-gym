import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, IconCircle, Pill, type IconName } from '@/components/ui';
import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { ROLE_LABELS } from '@/features/auth/db/users';
import { can, session, useSession, type Permission } from '@/features/auth/lib/session';
import { TourTarget } from '@/features/tour/components/TourTarget';
import { resetTours } from '@/features/tour/lib/tour';
import { useAutoTour } from '@/features/tour/lib/useAutoTour';
import { useIsWide } from '@/lib/layout';
import { makeStyles, spacing, useTheme } from '@/theme';

type Item = { icon: IconName; title: string; subtitle: string; href?: Href; permission?: Permission };

const GROUPS: { title: string; tourId: string; items: Item[] }[] = [
  {
    title: 'Gimnasio',
    tourId: 'more-gym',
    items: [
      { icon: 'pricetags', title: 'Planes', subtitle: 'Mensual, interdiario, pase diario, promociones', href: '/plans', permission: 'manage_plans' },
      { icon: 'barbell', title: 'Coaches', subtitle: 'Personalizados y clientes asignados', href: '/coaches', permission: 'manage_plans' },
      { icon: 'document-text', title: 'Reportes', subtitle: 'Ventas, clientes y cobros programados', href: '/reports', permission: 'manage_reports' },
    ],
  },
  {
    title: 'Sistema',
    tourId: 'more-system',
    items: [
      { icon: 'paper-plane', title: 'Integraciones', subtitle: 'Telegram y WhatsApp', href: '/integrations', permission: 'manage_integrations' },
      { icon: 'people-circle', title: 'Usuarios', subtitle: 'Administrador y recepcionistas con PIN', href: '/users', permission: 'manage_users' },
      { icon: 'settings', title: 'Ajustes', subtitle: 'Datos del gimnasio, alertas, bloqueo y almacén', href: '/settings', permission: 'manage_settings' },
    ],
  },
];

export default function MoreScreen() {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const wide = useIsWide();
  const user = useSession();
  useAutoTour('more');

  const replayGuide = async () => {
    if (!user) return;
    await resetTours(db, user.id);
    // The home tour starts by itself when Inicio gets focus again.
    router.navigate('/');
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]}>
        <Text style={font.title}>Más</Text>
        {user && (
          <TourTarget id="more-user">
            <Card style={styles.userCard}>
              <UserAvatar name={user.name} role={user.role} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>{user.name}</Text>
                <Text style={font.small}>{ROLE_LABELS[user.role]}</Text>
              </View>
              <Button title="Cambiar usuario" icon="lock-closed" variant="secondary" onPress={session.signOut} />
            </Card>
          </TourTarget>
        )}
        {GROUPS.map((group) => (
          <TourTarget key={group.title} id={group.tourId} style={{ gap: spacing.sm }}>
            <Text style={[font.tiny, styles.groupTitle]}>{group.title.toUpperCase()}</Text>
            <Card style={{ padding: 0 }}>
              {group.items.map((item, i) => (
                <Row key={item.title} item={item} first={i === 0} />
              ))}
            </Card>
          </TourTarget>
        ))}
        <TourTarget id="more-guide">
          <Card style={{ padding: 0 }}>
            <Pressable onPress={replayGuide} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
              <IconCircle icon="help-buoy" color={colors.primary} bg={colors.primarySoft} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>Ver la guía otra vez</Text>
                <Text style={font.small}>Recorre de nuevo las opciones de la app paso a paso</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.faint} />
            </Pressable>
          </Card>
        </TourTarget>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ item, first }: { item: Item; first: boolean }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const role = useSession()?.role;
  const allowed = !item.permission || can(role, item.permission);
  const href = allowed ? item.href : undefined;
  return (
    <Pressable
      disabled={!href}
      onPress={() => href && router.push(href)}
      style={({ pressed }) => [styles.row, !first && styles.rowBorder, pressed && { opacity: 0.7 }]}
    >
      <IconCircle icon={item.icon} color={colors.primary} bg={colors.primarySoft} />
      <View style={{ flex: 1 }}>
        <Text style={font.h3}>{item.title}</Text>
        <Text style={font.small}>{item.subtitle}</Text>
      </View>
      {!allowed ? (
        <Pill label="Solo admin" icon="lock-closed" />
      ) : href ? (
        <Ionicons name="chevron-forward" size={20} color={colors.faint} />
      ) : (
        <Pill label="Próximamente" tone="info" />
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.lg },
    contentWide: { padding: spacing.xxl, width: '100%', maxWidth: 820, alignSelf: 'center' },
    groupTitle: { marginLeft: spacing.xs },
    userCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
