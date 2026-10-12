import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, IconCircle, Pill, type IconName } from '@/components/ui';
import { useIsWide } from '@/lib/layout';
import { makeStyles, spacing, useTheme } from '@/theme';

type Item = { icon: IconName; title: string; subtitle: string; href?: Href };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Gimnasio',
    items: [
      { icon: 'pricetags', title: 'Planes', subtitle: 'Mensual, interdiario, pase diario, promociones' },
      { icon: 'barbell', title: 'Coaches', subtitle: 'Personalizados y clientes asignados' },
      { icon: 'document-text', title: 'Reportes', subtitle: 'Ventas, clientes y cobros programados' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { icon: 'paper-plane', title: 'Integraciones', subtitle: 'Telegram y WhatsApp' },
      { icon: 'people-circle', title: 'Usuarios', subtitle: 'Administrador y recepcionistas con PIN' },
      { icon: 'settings', title: 'Ajustes', subtitle: 'Datos del gimnasio, alertas y almacén', href: '/settings' },
    ],
  },
];

export default function MoreScreen() {
  const styles = useStyles();
  const { font } = useTheme();
  const wide = useIsWide();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]}>
        <Text style={font.title}>Más</Text>
        {GROUPS.map((group) => (
          <View key={group.title} style={{ gap: spacing.sm }}>
            <Text style={[font.tiny, styles.groupTitle]}>{group.title.toUpperCase()}</Text>
            <Card style={{ padding: 0 }}>
              {group.items.map((item, i) => (
                <Row key={item.title} item={item} first={i === 0} />
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ item, first }: { item: Item; first: boolean }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const href = item.href;
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
      {href ? <Ionicons name="chevron-forward" size={20} color={colors.faint} /> : <Pill label="Próximamente" tone="info" />}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.lg },
    contentWide: { padding: spacing.xxl, width: '100%', maxWidth: 820, alignSelf: 'center' },
    groupTitle: { marginLeft: spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  }),
);
