import type { SQLiteDatabase } from 'expo-sqlite';

import type { Settings } from '@/db/settings';
import { listMembers, type MemberListItem } from '@/features/members/db/members';
import { computeAlerts, groupAlerts } from '@/features/store/lib/alerts';
import { addDays, todayIso } from '@/lib/format';

/** Older expired memberships stop showing up as pending: they are former clients by then. */
export const EXPIRED_LOOKBACK_DAYS = 30;

export type Attention = {
  expiring: MemberListItem[];
  expired: MemberListItem[];
  debts: MemberListItem[];
  store: ReturnType<typeof groupAlerts>;
};

export async function computeAttention(db: SQLiteDatabase, settings: Settings): Promise<Attention> {
  const today = todayIso();
  const warningLimit = addDays(today, settings.membershipWarningDays);
  const since = addDays(today, -EXPIRED_LOOKBACK_DAYS);
  const [expiring, expired, debts, storeAlerts] = await Promise.all([
    listMembers(db, { membership: { kind: 'expiring', today, warningLimit } }),
    listMembers(db, { membership: { kind: 'expired', today, warningLimit } }),
    listMembers(db, { withDebt: true }),
    computeAlerts(db, settings),
  ]);
  return {
    expiring,
    expired: expired.filter((m) => m.membership_end! >= since).reverse(),
    debts,
    store: groupAlerts(storeAlerts),
  };
}

export function attentionCount(a: Attention) {
  const store = a.store.outOfStock.length + a.store.lowStock.length + a.store.expired.length + a.store.expiring.length;
  return a.expiring.length + a.expired.length + a.debts.length + store;
}
