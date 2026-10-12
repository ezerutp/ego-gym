import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ProductThumb } from '@/components/ui';
import { getProductByBarcode } from '@/db/products';
import { cart, cartCount, cartTotal, useCart } from '@/lib/cart';
import { money } from '@/lib/format';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar'];
const FRAME_W = 280;
const FRAME_H = 180;

type Toast = { tone: 'success' | 'error'; title: string; subtitle?: string; imageUri?: string | null };

export default function ScanScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { mode = 'add' } = useLocalSearchParams<{ mode?: 'add' | 'sell' }>();
  const isSell = mode === 'sell';
  const db = useSQLiteContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const items = useCart();
  const hideToast = useCallback(() => setToast(null), []);
  const busy = useRef(false);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const handleCode = async (code: string) => {
    const now = Date.now();
    if (busy.current) return;
    if (code === lastScan.current.code && now - lastScan.current.at < 2000) return;
    busy.current = true;
    lastScan.current = { code, at: now };

    try {
      if (!isSell) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: '/product/new', params: { code } });
        return;
      }

      const product = await getProductByBarcode(db, code);
      if (!product) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await new Promise<void>((resolve) =>
          Alert.alert('Producto no registrado', `El código ${code} no está en tu almacén.`, [
            { text: 'Seguir escaneando', style: 'cancel', onPress: () => resolve() },
            {
              text: 'Registrarlo',
              onPress: () => {
                router.replace({ pathname: '/product/new', params: { code } });
                resolve();
              },
            },
          ]),
        );
        return;
      }
      if (cart.add(product)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setToast({ tone: 'success', title: product.name, subtitle: `+1 · ${money(product.price)}`, imageUri: product.image_uri });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setToast({ tone: 'error', title: product.name, subtitle: product.stock === 0 ? 'Sin stock' : `Solo hay ${product.stock} en stock`, imageUri: product.image_uri });
      }
    } finally {
      // Small pause so a code held in front of the camera isn't counted many times.
      setTimeout(() => (busy.current = false), isSell ? 900 : 0);
    }
  };

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.black, styles.center]}>
        <Ionicons name="camera-outline" size={56} color={colors.white} />
        <Text style={styles.permTitle}>Necesitamos tu cámara</Text>
        <Text style={styles.permText}>La usamos para leer los códigos de barras de tus productos.</Text>
        <Button title="Permitir cámara" icon="camera" onPress={requestPermission} style={{ alignSelf: 'stretch', marginTop: spacing.xl }} />
        <Button title="Volver" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.black}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={manualOpen ? undefined : (r) => handleCode(r.data)}
      />
      <ScanOverlay />

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.topBar}>
          <RoundButton icon="close" onPress={() => router.back()} />
          <View style={styles.modeChip}>
            <Ionicons name={isSell ? 'cart' : 'add-circle'} size={16} color={colors.white} />
            <Text style={styles.modeText}>{isSell ? 'Modo venta' : 'Ingreso al almacén'}</Text>
          </View>
          <RoundButton icon={torch ? 'flash' : 'flash-off'} onPress={() => setTorch((t) => !t)} />
        </View>

        <Text style={styles.hint}>Apunta al código de barras del producto</Text>

        <View style={{ flex: 1 }} />

        {toast && <ToastCard toast={toast} onHide={hideToast} />}

        <KeyboardAvoidingView behavior="padding">
          <View style={styles.bottom}>
            {manualOpen ? (
              <View style={styles.manualRow}>
                <TextInput
                  autoFocus
                  value={manualCode}
                  onChangeText={(t) => setManualCode(t.replace(/\D/g, ''))}
                  placeholder="Escribe el código"
                  placeholderTextColor={colors.faint}
                  keyboardType="number-pad"
                  style={styles.manualInput}
                  onSubmitEditing={() => manualCode && handleCode(manualCode)}
                />
                <Pressable
                  style={styles.manualGo}
                  onPress={() => {
                    if (!manualCode) return setManualOpen(false);
                    handleCode(manualCode);
                    setManualCode('');
                  }}
                >
                  <Ionicons name={manualCode ? 'arrow-forward' : 'close'} size={22} color={colors.white} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.manualLink} onPress={() => setManualOpen(true)}>
                <Ionicons name="keypad-outline" size={18} color={colors.white} />
                <Text style={styles.manualLinkText}>Ingresar código manualmente</Text>
              </Pressable>
            )}

            {isSell && (
              <Pressable
                style={styles.cartBar}
                onPress={() => {
                  router.back();
                  router.navigate('/sell');
                }}
              >
                <View style={styles.cartCount}>
                  <Text style={styles.cartCountText}>{cartCount(items)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartLabel}>Ver carrito</Text>
                  <Text style={styles.cartSub}>{items.length} productos distintos</Text>
                </View>
                <Text style={styles.cartTotal}>{money(cartTotal(items))}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ScanOverlay() {
  const styles = useStyles();
  const [line] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(line, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(line, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [line]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.shade} />
      <View style={{ flexDirection: 'row', height: FRAME_H }}>
        <View style={styles.shade} />
        <View style={styles.frame}>
          <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 }]} />
          <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 }]} />
          <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 }]} />
          <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 }]} />
          <Animated.View
            style={[styles.laser, { transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [16, FRAME_H - 16] }) }] }]}
          />
        </View>
        <View style={styles.shade} />
      </View>
      <View style={styles.shade} />
    </View>
  );
}

function ToastCard({ toast, onHide }: { toast: Toast; onHide: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(onHide);
    }, 1800);
    return () => clearTimeout(t);
  }, [toast, anim, onHide]);

  const ok = toast.tone === 'success';
  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
      ]}
    >
      <ProductThumb uri={toast.imageUri ?? null} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.toastTitle} numberOfLines={1}>
          {toast.title}
        </Text>
        <Text style={[styles.toastSub, { color: ok ? colors.primary : colors.danger }]}>{toast.subtitle}</Text>
      </View>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={26} color={ok ? colors.primary : colors.danger} />
    </Animated.View>
  );
}

function RoundButton({ icon, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.round} hitSlop={8}>
      <Ionicons name={icon} size={22} color={colors.white} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    black: { flex: 1, backgroundColor: '#000' },
    center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
    permTitle: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: spacing.lg },
    permText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center' },
    shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    frame: { width: FRAME_W, height: FRAME_H },
    corner: { position: 'absolute', width: 36, height: 36, borderColor: colors.white },
    laser: { position: 'absolute', left: 18, right: 18, height: 2, borderRadius: 1, backgroundColor: '#3CE6A4', shadowColor: '#3CE6A4', shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    modeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
    modeText: { color: colors.white, fontWeight: '700', fontSize: 14 },
    hint: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: spacing.xl, fontSize: 15, fontWeight: '500' },
    bottom: { padding: spacing.lg, gap: spacing.md },
    manualLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    manualLinkText: { color: colors.white, fontWeight: '600', fontSize: 15 },
    manualRow: { flexDirection: 'row', gap: spacing.sm },
    manualInput: { flex: 1, backgroundColor: colors.surface, color: colors.ink, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 18, height: 54, letterSpacing: 1 },
    manualGo: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    cartBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.md },
    cartCount: { minWidth: 40, height: 40, borderRadius: 12, paddingHorizontal: 6, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    cartCountText: { color: colors.white, fontWeight: '800', fontSize: 16 },
    cartLabel: { color: colors.white, fontWeight: '800', fontSize: 16 },
    cartSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
    cartTotal: { color: colors.white, fontWeight: '800', fontSize: 18 },
    toast: { marginHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
    toastTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
    toastSub: { fontSize: 13, fontWeight: '700' },
  }),
);
