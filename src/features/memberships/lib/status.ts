import { addDays, daysUntil, formatDay, todayIso } from '@/lib/format';

export type MembershipKind = 'none' | 'current' | 'expiring' | 'expired';

export type MembershipState = { kind: MembershipKind; label: string; detail: string };

export function membershipState(endDate: string | null, warningDays: number): MembershipState {
  if (!endDate) return { kind: 'none', label: 'Sin membresía', detail: 'Aún no se inscribe en un plan' };
  const days = daysUntil(endDate);
  if (days < 0) return { kind: 'expired', label: 'Vencida', detail: `Venció el ${formatDay(endDate)}` };
  const detail = days === 0 ? 'Vence hoy' : days === 1 ? 'Vence mañana' : `Vence en ${days} días (${formatDay(endDate)})`;
  return { kind: days <= warningDays ? 'expiring' : 'current', label: days <= warningDays ? 'Por vencer' : 'Vigente', detail };
}

/** Plans run on inclusive days: a 30-day plan starting on the 1st ends on the 30th. */
export function endDateFor(startDate: string, durationDays: number) {
  return addDays(startDate, Math.max(durationDays, 1) - 1);
}

/** A renewal starts the day after the current period ends, or today if it already ended. */
export function renewalStart(currentEnd: string | null) {
  const today = todayIso();
  if (!currentEnd || currentEnd < today) return today;
  return addDays(currentEnd, 1);
}

export function describeRelativeDay(value: string) {
  const days = daysUntil(value);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`;
}
