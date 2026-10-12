import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/components/ui';
import type { Settings } from '@/db/settings';
import { captureRef } from 'react-native-view-shot';

import { lightTheme, radius, spacing, type Theme } from '@/theme';

export async function captureViewAsImage(ref: RefObject<View | null>) {
  const path = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** Captures a receipt view as a PNG and opens the share sheet (WhatsApp is usually the first option). */
export async function shareViewAsImage(ref: RefObject<View | null>, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(await captureViewAsImage(ref), { mimeType: 'image/png', dialogTitle });
  return true;
}

export function BusinessHeader({ settings, icon }: { settings: Settings; icon: IconName }) {
  return (
    <>
      <View style={paper.logo}>
        <Ionicons name={icon} size={26} color={lightTheme.colors.white} />
      </View>
      <Text style={paper.store}>{settings.storeName}</Text>
      {!!settings.storeAddress && <Text style={paper.storeMeta}>{settings.storeAddress}</Text>}
      {!!settings.storeRuc && <Text style={paper.storeMeta}>RUC {settings.storeRuc}</Text>}
      {!!settings.storePhone && <Text style={paper.storeMeta}>Tel. {settings.storePhone}</Text>}
    </>
  );
}

export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={paper.metaRow}>
      <Text style={paper.metaLabel}>{label}</Text>
      <Text style={paper.metaValue}>{value}</Text>
    </View>
  );
}

export function Dashed() {
  return <View style={paper.dashed} />;
}

const MONO = { fontVariant: ['tabular-nums' as const] };

/** The receipt is shared as an image, so it always looks like white paper, even in dark mode. */
export const paper = paperStyles(lightTheme);

function paperStyles({ colors, font }: Theme) {
  return StyleSheet.create({
    ticketWrap: { backgroundColor: colors.background, padding: spacing.sm, borderRadius: radius.lg + spacing.sm },
    ticket: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'stretch' },
    logo: { alignSelf: 'center', width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    store: { ...font.h2, textAlign: 'center' },
    storeMeta: { ...font.small, textAlign: 'center' },
    dashed: { borderBottomWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, marginVertical: spacing.lg },
    docTitle: { textAlign: 'center', fontWeight: '800', letterSpacing: 2, color: colors.ink, fontSize: 13 },
    docNumber: { textAlign: 'center', fontWeight: '700', color: colors.primary, fontSize: 16, marginBottom: spacing.md, ...MONO },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    metaLabel: font.small,
    metaValue: { fontSize: 13, color: colors.ink, fontWeight: '600', ...MONO },
    itemsHeader: { flexDirection: 'row', marginBottom: spacing.sm },
    th: { ...font.tiny, textTransform: 'uppercase' },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
    itemName: { fontSize: 14, color: colors.ink, fontWeight: '600' },
    itemUnit: { fontSize: 12, color: colors.muted, ...MONO },
    itemQty: { fontSize: 14, color: colors.ink, textAlign: 'center', ...MONO },
    itemTotal: { fontSize: 14, color: colors.ink, textAlign: 'right', fontWeight: '600', ...MONO },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    totalLabel: { fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: 1 },
    totalValue: { fontSize: 26, fontWeight: '800', color: colors.ink, ...MONO },
    footer: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.ink },
    disclaimer: { textAlign: 'center', fontSize: 10, color: colors.faint, marginTop: spacing.sm },
  });
}
