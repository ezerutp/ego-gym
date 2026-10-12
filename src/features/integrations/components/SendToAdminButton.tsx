import { useState } from 'react';
import { Alert, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui';
import type { SendResult } from '@/features/integrations/lib/deliver';

/** "Enviar al admin": sends through Telegram and reports the result in an alert. */
export function SendToAdminButton({ onSend, style }: { onSend: () => Promise<SendResult>; style?: StyleProp<ViewStyle> }) {
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try {
      const result = await onSend();
      if (result.ok) Alert.alert('Enviado', 'Se envió al Telegram del administrador.');
      else Alert.alert('No se pudo enviar', result.error);
    } catch (e) {
      Alert.alert('No se pudo enviar', String(e));
    } finally {
      setSending(false);
    }
  };
  return <Button title="Enviar al admin" icon="paper-plane-outline" variant="secondary" loading={sending} onPress={send} style={style} />;
}
