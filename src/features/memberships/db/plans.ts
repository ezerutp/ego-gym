import type { SQLiteDatabase } from 'expo-sqlite';

export type PlanKind = 'monthly' | 'alternate' | 'daily' | 'promo' | 'other';

export type Plan = { id: number; name: string; kind: PlanKind; price: number; duration_days: number; active: number };

export type PlanInput = Omit<Plan, 'id' | 'active'> & { active: boolean };

export const PLAN_KINDS: Record<PlanKind, { label: string; hint: string }> = {
  monthly: { label: 'Mensual', hint: 'Todos los días' },
  alternate: { label: 'Interdiario', hint: 'Día de por medio' },
  daily: { label: 'Diario', hint: 'Pago por día' },
  promo: { label: 'Promoción', hint: 'Precio especial, como el dúo' },
  other: { label: 'Otro', hint: 'Cualquier otro plan' },
};

export function listPlans(db: SQLiteDatabase, { includeInactive = false } = {}) {
  return db.getAllAsync<Plan>(
    `SELECT id, name, kind, price, duration_days, active FROM plans ${includeInactive ? '' : 'WHERE active = 1'}
     ORDER BY active DESC, duration_days DESC, name COLLATE NOCASE`,
  );
}

export function getPlan(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Plan>('SELECT id, name, kind, price, duration_days, active FROM plans WHERE id = ?', id);
}

export async function savePlan(db: SQLiteDatabase, id: number | null, input: PlanInput) {
  const values = [input.name.trim(), input.kind, input.price, input.duration_days, input.active ? 1 : 0];
  if (id) {
    await db.runAsync(
      `UPDATE plans SET name = ?, kind = ?, price = ?, duration_days = ?, active = ?, updated_at = datetime('now') WHERE id = ?`,
      ...values,
      id,
    );
    return id;
  }
  const result = await db.runAsync('INSERT INTO plans (name, kind, price, duration_days, active) VALUES (?, ?, ?, ?, ?)', ...values);
  return result.lastInsertRowId;
}

export function describeDuration(days: number) {
  if (days === 1) return '1 día';
  if (days % 30 === 0) return days === 30 ? '1 mes' : `${days / 30} meses`;
  if (days % 7 === 0) return days === 7 ? '1 semana' : `${days / 7} semanas`;
  return `${days} días`;
}
