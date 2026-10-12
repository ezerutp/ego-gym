import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState } from '@/components/ui';
import { makeStyles, spacing, useTheme } from '@/theme';

export default function MembersScreen() {
  const styles = useStyles();
  const { font } = useTheme();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={[font.title, { marginBottom: spacing.lg }]}>Clientes</Text>
      <Card>
        <EmptyState
          icon="people-outline"
          title="Próximamente"
          message="Aquí registrarás a tus clientes y prospectos con foto, su plan y el estado de sus pagos."
        />
      </Card>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  }),
);
