export function money(value: number | null | undefined) {
  if (value == null) return '—';
  return `S/ ${value.toFixed(2)}`;
}

/** SQLite `datetime('now')` values are UTC without a zone marker. */
export function parseDbDate(value: string) {
  return new Date(value.replace(' ', 'T') + 'Z');
}

export function formatDateTime(value: string) {
  const d = parseDbDate(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Expiry dates are stored as local `YYYY-MM-DD`. */
export function toIsoDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDay(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(value: string) {
  const d = parseIsoDay(value);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function daysUntil(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseIsoDay(value).getTime() - today.getTime()) / 86_400_000);
}

export function describeExpiry(value: string) {
  const days = daysUntil(value);
  if (days < 0) return `Vencido hace ${-days} ${-days === 1 ? 'día' : 'días'}`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
}

export function parseMoney(text: string) {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

export function receiptNumber(id: number) {
  return `B001-${String(id).padStart(6, '0')}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
