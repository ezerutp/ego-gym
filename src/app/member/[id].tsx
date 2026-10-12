import { router, useLocalSearchParams } from 'expo-router';

import { MemberDetail } from '@/features/members/components/MemberDetail';

export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MemberDetail id={Number(id)} onDeleted={() => router.back()} />;
}
