import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Pill } from '@/components/ui';
import { initials } from '@/features/auth/components/UserAvatar';
import { fullName, STATUS_LABELS, type Member, type MemberStatus } from '@/features/members/db/members';
import { makeStyles, spacing, useTheme } from '@/theme';

const STATUS_TONES = { active: 'success', prospect: 'info', inactive: 'neutral' } as const;

export function StatusPill({ status }: { status: MemberStatus }) {
  return <Pill label={STATUS_LABELS[status]} tone={STATUS_TONES[status]} />;
}

export function MemberAvatar({ member, size = 48 }: { member: Pick<Member, 'first_name' | 'last_name' | 'photo_uri'>; size?: number }) {
  const { colors } = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (member.photo_uri) return <Image source={{ uri: member.photo_uri }} style={box} contentFit="cover" transition={150} />;
  return (
    <View style={[box, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: size * 0.36, fontWeight: '800', color: colors.primaryDark }}>{initials(fullName(member))}</Text>
    </View>
  );
}

export function MemberRow({ member, selected, onPress }: { member: Member; selected?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { font } = useTheme();
  const detail = [member.dni && `DNI ${member.dni}`, member.phone].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && { opacity: 0.75 }]}>
      <MemberAvatar member={member} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={font.h3} numberOfLines={1}>
          {fullName(member)}
        </Text>
        {!!detail && (
          <Text style={font.small} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      <StatusPill status={member.status} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  }),
);
