import type { Member } from '@/features/members/db/members';
import { formatDay, money } from '@/lib/format';

type Who = Pick<Member, 'first_name' | 'last_name'>;

export function expiringMessage(member: Who, endDate: string, gymName: string) {
  return `Hola ${member.first_name}, te recordamos que tu membresía en ${gymName} vence el ${formatDay(endDate)}. ¡Te esperamos para renovarla! 💪`;
}

export function expiredMessage(member: Who, endDate: string, gymName: string) {
  return `Hola ${member.first_name}, tu membresía en ${gymName} venció el ${formatDay(endDate)}. ¡Te esperamos para renovarla y seguir entrenando! 💪`;
}

export function debtMessage(member: Who, debt: number, gymName: string) {
  return `Hola ${member.first_name}, te recordamos que tienes un saldo pendiente de ${money(debt)} en ${gymName}. Puedes acercarte a recepción para regularizarlo. ¡Gracias!`;
}
