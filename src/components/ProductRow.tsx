import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Pill, ProductThumb } from '@/components/ui';
import type { Product } from '@/db/products';
import type { Settings } from '@/db/settings';
import { alertsForProduct } from '@/lib/alerts';
import { describeExpiry, money } from '@/lib/format';
import { makeStyles, spacing, useTheme } from '@/theme';

export function ProductRow({ product, settings, onPress }: { product: Product; settings: Settings; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const alerts = alertsForProduct(product, settings);
  const stockAlert = alerts.find((a) => a.kind === 'out_of_stock' || a.kind === 'low_stock');
  const expiryAlert = alerts.find((a) => a.kind === 'expired' || a.kind === 'expiring');

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.background }]}>
      <ProductThumb uri={product.image_uri} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[product.brand, product.quantity_label].filter(Boolean).join(' · ') || product.barcode}
        </Text>
        {(stockAlert || expiryAlert) && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {stockAlert && (
              <Pill
                tone={stockAlert.kind === 'out_of_stock' ? 'danger' : 'warning'}
                label={stockAlert.kind === 'out_of_stock' ? 'Agotado' : 'Poco stock'}
              />
            )}
            {expiryAlert && (
              <Pill tone={expiryAlert.kind === 'expired' ? 'danger' : 'warning'} icon="time-outline" label={describeExpiry(product.expiry_date!)} />
            )}
          </View>
        )}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={styles.stock}>{product.stock}</Text>
        <Text style={styles.meta}>{money(product.price)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    name: { fontSize: 15, fontWeight: '700', color: colors.ink },
    meta: { fontSize: 13, color: colors.muted },
    stock: { fontSize: 18, fontWeight: '800', color: colors.ink },
  }),
);
