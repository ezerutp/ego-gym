import type { Settings } from '@/db/settings';
import type { Member } from '@/features/members/db/members';
import { formatDay, money } from '@/lib/format';

type Who = Pick<Member, 'first_name' | 'last_name'>;

export const TEMPLATE_VARIABLES = ['{nombre}', '{fecha}', '{monto}', '{gimnasio}'];

/** Replaces the {variables} the admin can use in the templates; unknown ones stay as written. */
export function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

export function expiringMessage(member: Who, endDate: string, settings: Settings) {
  return fillTemplate(settings.templateExpiring, { nombre: member.first_name, fecha: formatDay(endDate), gimnasio: settings.storeName });
}

export function expiredMessage(member: Who, endDate: string, settings: Settings) {
  return fillTemplate(settings.templateExpired, { nombre: member.first_name, fecha: formatDay(endDate), gimnasio: settings.storeName });
}

export function debtMessage(member: Who, debt: number, settings: Settings) {
  return fillTemplate(settings.templateDebt, { nombre: member.first_name, monto: money(debt), gimnasio: settings.storeName });
}
