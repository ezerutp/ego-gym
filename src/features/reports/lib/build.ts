import type { SQLiteDatabase } from 'expo-sqlite';

import { getSettings } from '@/db/settings';
import { computeAttention } from '@/features/alerts/lib/attention';
import { fullName, STATUS_LABELS, type MemberStatus } from '@/features/members/db/members';
import { countDebts, PAYMENT_METHODS, type PaymentMethod } from '@/features/payments/db/payments';
import { formatDay, money } from '@/lib/format';

export type ReportKind = 'summary' | 'sales' | 'payments' | 'members';

export const REPORT_KINDS: Record<ReportKind, { label: string; hint: string }> = {
  summary: { label: 'Resumen general', hint: 'Ingresos, clientes, vencimientos y deudas' },
  sales: { label: 'Ventas de la tienda', hint: 'Boletas, total y productos más vendidos' },
  payments: { label: 'Cobros de membresías', hint: 'Cobros por método y detalle' },
  members: { label: 'Clientes', hint: 'Nuevos, por vencer, vencidos y con deuda' },
};

export type ReportTable = { title: string; columns: string[]; rows: string[][]; empty: string };

/** Raw series behind the summary charts; only the summary report sets it. */
export type SummarySeries = {
  daily: { day: string; store: number; subs: number }[];
  /** Percent change vs the previous period, null when there is nothing to compare. */
  deltas: { income: number | null; sales: number | null; payments: number | null; members: number | null };
  amounts: number[];
  byMethod: { method: PaymentMethod; total: number }[];
};

export type ReportData = {
  kind: ReportKind;
  title: string;
  gymName: string;
  periodStart: string;
  periodEnd: string;
  highlights: { label: string; value: string }[];
  tables: ReportTable[];
  series?: SummarySeries;
};

const IN_PERIOD = `date(created_at, 'localtime') BETWEEN ? AND ?`;

export function describePeriod(start: string, end: string) {
  return start === end ? formatDay(start) : `${formatDay(start)} al ${formatDay(end)}`;
}

async function salesTotals(db: SQLiteDatabase, start: string, end: string) {
  const row = await db.getFirstAsync<{ count: number; total: number | null }>(`SELECT COUNT(*) AS count, SUM(total) AS total FROM sales WHERE ${IN_PERIOD}`, start, end);
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}

async function paymentTotals(db: SQLiteDatabase, start: string, end: string) {
  const row = await db.getFirstAsync<{ count: number; total: number | null }>(`SELECT COUNT(*) AS count, SUM(amount) AS total FROM payments WHERE ${IN_PERIOD}`, start, end);
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}

async function newMembers(db: SQLiteDatabase, start: string, end: string) {
  return db.getAllAsync<{ first_name: string; last_name: string; status: MemberStatus; created_at: string }>(
    `SELECT first_name, last_name, status, date(created_at, 'localtime') AS created_at FROM members WHERE ${IN_PERIOD} ORDER BY created_at`,
    start,
    end,
  );
}

async function buildSales(db: SQLiteDatabase, start: string, end: string): Promise<Pick<ReportData, 'highlights' | 'tables'>> {
  const totals = await salesTotals(db, start, end);
  const top = await db.getAllAsync<{ name: string; qty: number; amount: number }>(
    `SELECT i.name, SUM(i.quantity) AS qty, SUM(i.quantity * i.unit_price) AS amount
     FROM sale_items i JOIN sales s ON s.id = i.sale_id
     WHERE date(s.created_at, 'localtime') BETWEEN ? AND ?
     GROUP BY i.name ORDER BY qty DESC LIMIT 15`,
    start,
    end,
  );
  const byDay = await db.getAllAsync<{ day: string; count: number; total: number }>(
    `SELECT date(created_at, 'localtime') AS day, COUNT(*) AS count, SUM(total) AS total FROM sales WHERE ${IN_PERIOD} GROUP BY day ORDER BY day`,
    start,
    end,
  );
  return {
    highlights: [
      { label: 'Total vendido', value: money(totals.total) },
      { label: 'Boletas', value: String(totals.count) },
      { label: 'Ticket promedio', value: money(totals.count ? totals.total / totals.count : 0) },
    ],
    tables: [
      { title: 'Productos más vendidos', columns: ['Producto', 'Cant.', 'Importe'], rows: top.map((t) => [t.name, String(t.qty), money(t.amount)]), empty: 'Sin ventas en el periodo.' },
      { title: 'Ventas por día', columns: ['Día', 'Boletas', 'Total'], rows: byDay.map((d) => [formatDay(d.day), String(d.count), money(d.total)]), empty: 'Sin ventas en el periodo.' },
    ],
  };
}

async function buildPayments(db: SQLiteDatabase, start: string, end: string): Promise<Pick<ReportData, 'highlights' | 'tables'>> {
  const [totals, debts] = await Promise.all([paymentTotals(db, start, end), countDebts(db)]);
  const byMethod = await db.getAllAsync<{ method: PaymentMethod; count: number; total: number }>(
    `SELECT method, COUNT(*) AS count, SUM(amount) AS total FROM payments WHERE ${IN_PERIOD} GROUP BY method ORDER BY total DESC`,
    start,
    end,
  );
  const detail = await db.getAllAsync<{ day: string; first_name: string; last_name: string; plan_name: string; method: PaymentMethod; amount: number }>(
    `SELECT date(p.created_at, 'localtime') AS day, m.first_name, m.last_name, s.plan_name, p.method, p.amount
     FROM payments p JOIN members m ON m.id = p.member_id JOIN subscriptions s ON s.id = p.subscription_id
     WHERE date(p.created_at, 'localtime') BETWEEN ? AND ? ORDER BY p.id`,
    start,
    end,
  );
  return {
    highlights: [
      { label: 'Total cobrado', value: money(totals.total) },
      { label: 'Cobros', value: String(totals.count) },
      { label: 'Deuda pendiente hoy', value: `${money(debts.total)} (${debts.members} clientes)` },
    ],
    tables: [
      {
        title: 'Por método de pago',
        columns: ['Método', 'Cobros', 'Total'],
        rows: byMethod.map((r) => [PAYMENT_METHODS[r.method], String(r.count), money(r.total)]),
        empty: 'Sin cobros en el periodo.',
      },
      {
        title: 'Detalle de cobros',
        columns: ['Fecha', 'Cliente', 'Plan', 'Método', 'Monto'],
        rows: detail.map((d) => [formatDay(d.day), fullName(d), d.plan_name, PAYMENT_METHODS[d.method], money(d.amount)]),
        empty: 'Sin cobros en el periodo.',
      },
    ],
  };
}

async function buildMembers(db: SQLiteDatabase, start: string, end: string): Promise<Pick<ReportData, 'highlights' | 'tables'>> {
  const settings = await getSettings(db);
  const [joined, attention, active] = await Promise.all([
    newMembers(db, start, end),
    computeAttention(db, settings),
    db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM members WHERE status = 'active'"),
  ]);
  return {
    highlights: [
      { label: 'Clientes activos', value: String(active?.n ?? 0) },
      { label: 'Registrados en el periodo', value: String(joined.length) },
      { label: `Por vencer (${settings.membershipWarningDays} días)`, value: String(attention.expiring.length) },
      { label: 'Vencidas (30 días)', value: String(attention.expired.length) },
      { label: 'Con deuda', value: String(attention.debts.length) },
    ],
    tables: [
      {
        title: 'Registrados en el periodo',
        columns: ['Cliente', 'Estado', 'Fecha'],
        rows: joined.map((m) => [fullName(m), STATUS_LABELS[m.status], formatDay(m.created_at)]),
        empty: 'Nadie se registró en el periodo.',
      },
      {
        title: 'Membresías por vencer',
        columns: ['Cliente', 'Celular', 'Vence'],
        rows: attention.expiring.map((m) => [fullName(m), m.phone ?? '—', formatDay(m.membership_end!)]),
        empty: 'Ninguna membresía por vencer.',
      },
      {
        title: 'Clientes con deuda',
        columns: ['Cliente', 'Celular', 'Deuda'],
        rows: attention.debts.map((m) => [fullName(m), m.phone ?? '—', money(m.debt)]),
        empty: 'Nadie tiene deuda.',
      },
    ],
  };
}

async function buildSummary(db: SQLiteDatabase, start: string, end: string): Promise<Pick<ReportData, 'highlights' | 'tables' | 'series'>> {
  const settings = await getSettings(db);
  const days = Math.max(Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86_400_000) + 1, 1);
  const prevEnd = shiftDay(start, -1);
  const prevStart = shiftDay(start, -days);
  const [sales, payments, joined, attention, debts, daily, prevSales, prevPayments, prevNew, payAmounts, saleAmounts, byMethod] = await Promise.all([
    salesTotals(db, start, end),
    paymentTotals(db, start, end),
    newMembers(db, start, end),
    computeAttention(db, settings),
    countDebts(db),
    dailyIncome(db, start, end),
    salesTotals(db, prevStart, prevEnd),
    paymentTotals(db, prevStart, prevEnd),
    db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM members WHERE ${IN_PERIOD}`, prevStart, prevEnd),
    db.getAllAsync<{ v: number }>(`SELECT amount AS v FROM payments WHERE ${IN_PERIOD}`, start, end),
    db.getAllAsync<{ v: number }>(`SELECT total AS v FROM sales WHERE ${IN_PERIOD}`, start, end),
    db.getAllAsync<{ method: PaymentMethod; total: number }>(`SELECT method, SUM(amount) AS total FROM payments WHERE ${IN_PERIOD} GROUP BY method`, start, end),
  ]);
  const income = sales.total + payments.total;
  const prevIncome = prevSales.total + prevPayments.total;
  return {
    highlights: [
      { label: 'Ingresos totales', value: money(income) },
      { label: 'Membresías cobradas', value: `${money(payments.total)} (${payments.count})` },
      { label: 'Ventas de la tienda', value: `${money(sales.total)} (${sales.count})` },
      { label: 'Clientes registrados', value: String(joined.length) },
      { label: 'Membresías por vencer', value: String(attention.expiring.length) },
      { label: 'Deuda pendiente', value: `${money(debts.total)} (${debts.members} clientes)` },
    ],
    tables: [
      {
        title: 'Membresías por vencer',
        columns: ['Cliente', 'Vence'],
        rows: attention.expiring.slice(0, 10).map((m) => [fullName(m), formatDay(m.membership_end!)]),
        empty: 'Ninguna membresía por vencer.',
      },
      {
        title: 'Mayores deudas',
        columns: ['Cliente', 'Deuda'],
        rows: [...attention.debts].sort((a, b) => b.debt - a.debt).slice(0, 10).map((m) => [fullName(m), money(m.debt)]),
        empty: 'Nadie tiene deuda.',
      },
    ],
    series: {
      daily,
      deltas: {
        income: pct(income, prevIncome),
        sales: pct(sales.total, prevSales.total),
        payments: pct(payments.total, prevPayments.total),
        members: pct(joined.length, prevNew?.n ?? 0),
      },
      amounts: [...payAmounts, ...saleAmounts].map((r) => r.v),
      byMethod,
    },
  };
}

function shiftDay(iso: string, delta: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Percent change vs the previous period, null when there is nothing to compare. */
function pct(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function dailyIncome(db: SQLiteDatabase, start: string, end: string) {
  return db.getAllAsync<{ day: string; store: number; subs: number }>(
    `SELECT day, SUM(store) AS store, SUM(subs) AS subs FROM (
       SELECT date(created_at, 'localtime') AS day, total AS store, 0 AS subs FROM sales WHERE ${IN_PERIOD}
       UNION ALL
       SELECT date(created_at, 'localtime') AS day, 0 AS store, amount AS subs FROM payments WHERE ${IN_PERIOD}
     ) GROUP BY day ORDER BY day`,
    start,
    end,
    start,
    end,
  );
}

const BUILDERS = { summary: buildSummary, sales: buildSales, payments: buildPayments, members: buildMembers };

export async function buildReport(db: SQLiteDatabase, kind: ReportKind, start: string, end: string): Promise<ReportData> {
  const [settings, body] = await Promise.all([getSettings(db), BUILDERS[kind](db, start, end)]);
  return { kind, title: REPORT_KINDS[kind].label, gymName: settings.storeName, periodStart: start, periodEnd: end, ...body };
}

/** Short plain-text version, for WhatsApp now and Telegram later. */
export function reportText(r: ReportData) {
  const lines = [`📊 ${r.title} · ${r.gymName}`, `🗓️ ${describePeriod(r.periodStart, r.periodEnd)}`, '', ...r.highlights.map((h) => `• ${h.label}: ${h.value}`)];
  return lines.join('\n');
}
