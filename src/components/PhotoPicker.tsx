import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductThumb } from '@/components/ui';
import { makeStyles, spacing, useTheme } from '@/theme';

export function PhotoPicker({ uri, onChange }: { uri: string | null; onChange: (uri: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Activa el acceso a la cámara para tomar la foto.');
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) onChange(result.assets[0].uri);
  };

  const fromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) onChange(result.assets[0].uri);
  };

  const choose = () =>
    Alert.alert('Foto del producto', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Galería', onPress: fromLibrary },
      { text: 'Tomar foto', onPress: fromCamera },
    ]);

  return (
    <Pressable onPress={choose} style={styles.wrap}>
      <ProductThumb uri={uri} size={96} />
      <View style={styles.badge}>
        <Ionicons name="camera" size={16} color={colors.white} />
      </View>
      <Text style={styles.text}>{uri ? 'Cambiar foto' : 'Agregar foto'}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', gap: spacing.sm, alignSelf: 'center' },
    badge: {
      position: 'absolute',
      top: 70,
      right: -6,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
    text: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  }),
);
