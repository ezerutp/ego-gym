import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, IconCircle, SectionTitle, type IconName } from '@/components/ui';
import { useCan } from '@/features/auth/lib/session';
import { MemberAvatar, StatusPill } from '@/features/members/components/MemberBits';
import { deleteMember, fullName, getMember, updateMember, type Member } from '@/features/members/db/members';
import { callPhone, describeAge, openWhatsApp } from '@/features/members/lib/contact';
import { MembershipCard } from '@/features/memberships/components/MembershipCard';
import { formatDateTime, formatDay } from '@/lib/format';
import { useFocusQuery } from '@/lib/useFocusQuery';
import { makeStyles, spacing, useTheme } from '@/theme';
import { rescheduleAlerts } from '@/lib/notifications';

type Props = { id: number; onDeleted?: () => void; onChanged?: () => void };

export function MemberDetail({ id, onDeleted, onChanged }: Props) {
  const { data: member, reload } = useFocusQuery((db) => getMember(db, id), [id]);
  if (member === undefined) return null;
  if (member === null) {
    return <EmptyState icon="person-outline" title="Cliente no encontrado" message="Puede que haya sido eliminado." />;
  }
  const changed = () => {
    reload();
    onChanged?.();
  };
  return <MemberDetailContent member={member} onChanged={changed} onDeleted={onDeleted} />;
}

function MemberDetailContent({ member, onChanged, onDeleted }: { member: Member; onChanged: () => void; onDeleted?: () => void }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  const db = useSQLiteContext();
  const canDelete = useCan('delete_records');
  const name = fullName(member);

  const whatsapp = async () => {
    if (!(await openWhatsApp(member.phone, `Hola ${member.first_name}`))) {
      Alert.alert('Sin número', 'Registra un celular de 9 dígitos para escribirle por WhatsApp.');
    }
  };

  const activate = async () => {
    await updateMember(db, member.id, { ...member, status: 'active' });
    onChanged();
  };

  const remove = () =>
    Alert.alert('Eliminar cliente', `¿Seguro que quieres eliminar a ${name}? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteMember(db, member.id);
          rescheduleAlerts(db).catch(() => {});
          onDeleted?.();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MemberAvatar member={member} size={96} />
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text style={[font.title, { textAlign: 'center' }]}>{name}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <StatusPill status={member.status} />
            {member.birth_date && <Text style={font.small}>{describeAge(member.birth_date)}</Text>}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="WhatsApp" icon="logo-whatsapp" variant="secondary" onPress={whatsapp} style={styles.action} />
        {member.phone && <Button title="Llamar" icon="call" variant="secondary" onPress={() => callPhone(member.phone!)} style={styles.action} />}
        <Button
          title="Editar"
          icon="create-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/member/form', params: { id: member.id } })}
          style={styles.action}
        />
      </View>

      {member.status === 'prospect' && (
        <Card style={styles.prospect}>
          <IconCircle icon="sparkles" color={colors.info} bg={colors.infoSoft} />
          <View style={{ flex: 1 }}>
            <Text style={font.h3}>Prospecto</Text>
            <Text style={font.small}>{member.source ? `Llegó por: ${member.source}` : 'Aún no se ha inscrito en un plan.'}</Text>
          </View>
          <Button title="Marcar como activo" icon="checkmark" variant="secondary" onPress={activate} />
        </Card>
      )}

      <MembershipCard memberId={member.id} onChanged={onChanged} />

      <SectionTitle title="Datos" />
      <Card style={{ padding: 0 }}>
        <InfoRow icon="card-outline" label="DNI" value={member.dni} />
        <InfoRow icon="call-outline" label="Celular" value={member.phone} />
        <InfoRow icon="gift-outline" label="Fecha de nacimiento" value={member.birth_date && formatDay(member.birth_date)} />
        <InfoRow
          icon="medkit-outline"
          label="Contacto de emergencia"
          value={[member.emergency_name, member.emergency_phone].filter(Boolean).join(' · ') || null}
        />
        {member.status !== 'prospect' && <InfoRow icon="megaphone-outline" label="¿Cómo nos conoció?" value={member.source} />}
        <InfoRow icon="time-outline" label="Registrado" value={formatDateTime(member.created_at)} />
      </Card>

      {member.notes && (
        <>
          <SectionTitle title="Notas" />
          <Card>
            <Text style={font.body}>{member.notes}</Text>
          </Card>
        </>
      )}

      {canDelete && <Button title="Eliminar cliente" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: spacing.xl }} />}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string | null }) {
  const styles = useStyles();
  const { colors, font } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <Text style={[font.small, { flex: 1 }]}>{label}</Text>
      <Text style={[font.body, !value && { color: colors.faint }, styles.infoValue]}>{value || '—'}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    content: { padding: spacing.lg, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
    header: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    action: { flexGrow: 1, flexBasis: 140 },
    prospect: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, flexWrap: 'wrap' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
    infoValue: { flexShrink: 1, textAlign: 'right', fontWeight: '600' },
  }),
);
