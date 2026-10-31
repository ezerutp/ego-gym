import type { Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/features/store/db/products';
import { code128Bars } from '@/features/store/lib/code128';
import { LABEL_MM } from '@/features/store/lib/labelPdf';
import { money } from '@/lib/format';
import { lightTheme } from '@/theme';

/** Printed sticker, so it always looks like white paper, even in dark mode. */
export function BarcodeLabel({ product, width, ref }: { product: Product; width: number; ref?: Ref<View> }) {
  const mm = width / LABEL_MM.width;
  const { bars, modules } = code128Bars(product.barcode);
  const barsWidth = width - 6 * mm;
  const unit = barsWidth / modules;

  return (
    <View ref={ref} collapsable={false} style={[styles.label, { width, height: LABEL_MM.height * mm, borderRadius: 3 * mm, padding: 2 * mm, paddingHorizontal: 3 * mm }]}>
      <View style={styles.top}>
        <Text style={[styles.name, { fontSize: 3.2 * mm }]} numberOfLines={1}>
          {product.name}
        </Text>
        {product.price != null && <Text style={[styles.price, { fontSize: 3.6 * mm }]}>{money(product.price)}</Text>}
      </View>
      <View style={{ flex: 1, width: barsWidth, marginTop: 1.5 * mm }}>
        {bars.map((b, i) => (
          <View key={i} style={[styles.bar, { left: b.left * unit, width: b.width * unit }]} />
        ))}
      </View>
      <Text style={[styles.code, { fontSize: 2.6 * mm, letterSpacing: 0.4 * mm, marginTop: 0.5 * mm }]}>{product.barcode}</Text>
    </View>
  );
}

const { colors } = lightTheme;
const styles = StyleSheet.create({
  label: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#B5B5B5' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 },
  name: { flex: 1, fontWeight: '700', color: colors.ink },
  price: { fontWeight: '800', color: colors.primary },
  bar: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#000' },
  code: { textAlign: 'center', color: colors.ink, fontFamily: 'monospace' },
});
