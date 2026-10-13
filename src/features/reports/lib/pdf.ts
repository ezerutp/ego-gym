import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import type { SQLiteDatabase } from 'expo-sqlite';

import { setReportPdf } from '@/features/reports/db/reports';
import { buildReport, describePeriod, type ReportData, type ReportKind, type SummarySeries } from '@/features/reports/lib/build';
import { PAYMENT_METHODS } from '@/features/payments/db/payments';
import { money } from '@/lib/format';
import { lightTheme } from '@/theme';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Printed reports always use the light palette, like the receipts. */
export function reportHtml(r: ReportData) {
  const c = lightTheme.colors;
  const highlights = r.highlights
    .map(
      (h) =>
        `<div class="kpi"><div class="label">${escape(h.label)}</div><div class="value">${escape(h.value)}</div>${deltaBadge(h.delta)}</div>`,
    )
    .join('');
  const tables = r.tables
    .map((t) => {
      const body = t.rows.length
        ? `<table><thead><tr>${t.columns.map((col) => `<th>${escape(col)}</th>`).join('')}</tr></thead><tbody>${t.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`
        : `<p class="empty">${escape(t.empty)}</p>`;
      return `<h2>${escape(t.title)}</h2>${body}`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: ${c.text}; margin: 32px; font-size: 12px; }
  header { border-bottom: 3px solid ${c.primary}; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { color: ${c.primary}; font-weight: 900; letter-spacing: 2px; font-size: 13px; }
  h1 { color: ${c.ink}; font-size: 22px; margin: 4px 0; }
  .meta { color: ${c.muted}; }
  .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
  .kpi { flex: 1 1 30%; border: 1px solid ${c.border}; border-radius: 10px; padding: 10px 12px; }
  .kpi .label { color: ${c.muted}; font-size: 11px; }
  .kpi .value { color: ${c.ink}; font-size: 16px; font-weight: 800; margin-top: 2px; }
  .delta { font-size: 10px; font-weight: 700; margin-top: 3px; }
  .up { color: ${c.primary}; }
  .down { color: ${c.danger}; }
  .chart { border: 1px solid ${c.border}; border-radius: 10px; padding: 12px; margin-top: 4px; }
  .chart svg { display: block; width: 100%; height: auto; }
  .chart svg text { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; color: ${c.muted}; font-size: 11px; }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; }
  .donutWrap { display: flex; gap: 16px; align-items: center; }
  .donutLegend { display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: ${c.text}; }
  h2 { color: ${c.ink}; font-size: 14px; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: ${c.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid ${c.border}; padding: 6px 4px; }
  td { padding: 6px 4px; border-bottom: 1px solid ${c.border}; color: ${c.ink}; }
  .empty { color: ${c.muted}; }
  footer { margin-top: 28px; color: ${c.faint}; font-size: 10px; }
</style></head><body>
<header>
  <div class="brand">${escape(r.gymName.toUpperCase())}</div>
  <h1>${escape(r.title)}</h1>
  <div class="meta">Periodo: ${escape(describePeriod(r.periodStart, r.periodEnd))}</div>
</header>
<section class="kpis">${highlights}</section>
${r.series ? chartsHtml(r.series) : ''}
${tables}
<footer>Generado por EGO Gym el ${escape(new Date().toLocaleString('es-PE'))}</footer>
</body></html>`;
}

function deltaBadge(delta?: number | null) {
  if (delta == null) return '';
  const up = delta >= 0;
  return `<div class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(delta)} % vs periodo anterior</div>`;
}

const CHART_W = 560;
const PAD = { left: 56, right: 12, top: 14, bottom: 26 };

function niceCeil(v: number) {
  if (v <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(v));
  const n = v / base;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * base;
}

function gridlines(max: number, top: number, plotH: number, format: (v: number) => string) {
  const c = lightTheme.colors;
  let out = '';
  for (let i = 0; i <= 4; i++) {
    const y = top + plotH - (plotH * i) / 4;
    out += `<line x1="${PAD.left}" y1="${y}" x2="${CHART_W - PAD.right}" y2="${y}" stroke="${c.border}" stroke-width="1"/>`;
    out += `<text x="${PAD.left - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="${c.muted}">${format((max * i) / 4)}</text>`;
  }
  return out;
}

function dayLabel(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function stackedBars(daily: SummarySeries['daily']) {
  const c = lightTheme.colors;
  const H = 210;
  const plotH = H - PAD.top - PAD.bottom;
  const plotW = CHART_W - PAD.left - PAD.right;
  const max = niceCeil(Math.max(...daily.map((d) => d.store + d.subs)));
  const slot = plotW / daily.length;
  const bw = Math.min(36, slot * 0.62);
  const step = Math.ceil(daily.length / 12);
  let bars = '';
  daily.forEach((d, i) => {
    const total = d.store + d.subs;
    const x = PAD.left + slot * i + (slot - bw) / 2;
    const base = PAD.top + plotH;
    const h = (total / max) * plotH;
    const subsH = (d.subs / max) * plotH;
    bars += `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${c.info}"/>`;
    if (d.subs > 0) bars += `<rect x="${x.toFixed(1)}" y="${(base - subsH).toFixed(1)}" width="${bw.toFixed(1)}" height="${subsH.toFixed(1)}" fill="${c.primary}"/>`;
    if (i % step === 0 || i === daily.length - 1)
      bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${c.muted}">${dayLabel(d.day)}</text>`;
  });
  return `<svg viewBox="0 0 ${CHART_W} ${H}">${gridlines(max, PAD.top, plotH, money)}${bars}</svg>
    <div class="legend"><span><span class="sw" style="background:${c.primary}"></span>Membresías</span><span><span class="sw" style="background:${c.info}"></span>Tienda</span></div>`;
}

function trendLine(daily: SummarySeries['daily']) {
  const c = lightTheme.colors;
  const H = 190;
  const plotH = H - PAD.top - PAD.bottom;
  const plotW = CHART_W - PAD.left - PAD.right;
  let acc = 0;
  const cum = daily.map((d) => (acc += d.store + d.subs));
  const max = niceCeil(cum[cum.length - 1]);
  const x = (i: number) => PAD.left + (daily.length === 1 ? plotW / 2 : (plotW * i) / (daily.length - 1));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const line = cum.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(cum.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`;
  let dots = '';
  if (daily.length <= 31) cum.forEach((v, i) => (dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${c.primaryDark}"/>`));
  return `<svg viewBox="0 0 ${CHART_W} ${H}">${gridlines(max, PAD.top, plotH, money)}
    <path d="${area}" fill="${c.primarySoft}"/><path d="${line}" fill="none" stroke="${c.primaryDark}" stroke-width="2.5"/>${dots}
    <text x="${x(0).toFixed(1)}" y="${H - 8}" font-size="9" fill="${c.muted}">${dayLabel(daily[0].day)}</text>
    <text x="${x(cum.length - 1).toFixed(1)}" y="${H - 8}" text-anchor="end" font-size="9" fill="${c.muted}">${dayLabel(daily[cum.length - 1].day)}</text>
    <text x="${x(cum.length - 1).toFixed(1)}" y="${(y(cum[cum.length - 1]) - 8).toFixed(1)}" text-anchor="end" font-size="12" font-weight="800" fill="${c.ink}">${money(cum[cum.length - 1])}</text>
    </svg>`;
}

const HIST_BREAKS = [50, 100, 200, 500];
const HIST_LABELS = ['≤ 50', '51–100', '101–200', '201–500', '> 500'];

function histogram(amounts: number[]) {
  const c = lightTheme.colors;
  const counts = HIST_LABELS.map((_, b) => amounts.filter((v) => (b === 0 ? v <= HIST_BREAKS[0] : b < HIST_BREAKS.length ? v > HIST_BREAKS[b - 1] && v <= HIST_BREAKS[b] : v > HIST_BREAKS[b - 1])).length);
  const H = 190;
  const plotH = H - PAD.top - PAD.bottom;
  const plotW = CHART_W - PAD.left - PAD.right;
  const max = niceCeil(Math.max(...counts));
  const slot = plotW / counts.length;
  const bw = Math.min(72, slot * 0.6);
  let bars = '';
  counts.forEach((n, i) => {
    const x = PAD.left + slot * i + (slot - bw) / 2;
    const h = (n / max) * plotH;
    bars += `<rect x="${x.toFixed(1)}" y="${(PAD.top + plotH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${c.primary}"/>`;
    bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${(PAD.top + plotH - h - 5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${c.ink}">${n}</text>`;
    bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${c.muted}">S/ ${HIST_LABELS[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${CHART_W} ${H}">${gridlines(max, PAD.top, plotH, (v) => String(Math.round(v)))}${bars}</svg>`;
}

const DONUT_COLORS = () => [lightTheme.colors.primary, lightTheme.colors.info, lightTheme.colors.warning, lightTheme.colors.primaryDark];

function donut(byMethod: SummarySeries['byMethod']) {
  const c = lightTheme.colors;
  const total = byMethod.reduce((s, m) => s + m.total, 0);
  if (total <= 0) return '';
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  let offset = 0;
  const palette = DONUT_COLORS();
  const segs = byMethod
    .map((m, i) => {
      const len = (m.total / total) * CIRC;
      const s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${palette[i % palette.length]}" stroke-width="22" stroke-dasharray="${len.toFixed(1)} ${CIRC.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 70 70)"/>`;
      offset += len;
      return s;
    })
    .join('');
  const legend = byMethod
    .map(
      (m, i) =>
        `<div><span class="sw" style="background:${palette[i % palette.length]}"></span>${escape(PAYMENT_METHODS[m.method])} · ${Math.round((m.total / total) * 100)} % · ${money(m.total)}</div>`,
    )
    .join('');
  return `<div class="donutWrap"><svg viewBox="0 0 140 140" style="max-width:180px">${segs}
    <text x="70" y="66" text-anchor="middle" font-size="13" font-weight="800" fill="${c.ink}">${money(total)}</text>
    <text x="70" y="82" text-anchor="middle" font-size="9" fill="${c.muted}">cobrado</text></svg>
    <div class="donutLegend">${legend}</div></div>`;
}

function chartsHtml(series: SummarySeries) {
  const parts: string[] = [];
  if (series.daily.length > 0) {
    parts.push(`<h2>Ingreso por día</h2><div class="chart">${stackedBars(series.daily)}</div>`);
    parts.push(`<h2>Tendencia acumulada</h2><div class="chart">${trendLine(series.daily)}</div>`);
  }
  if (series.amounts.length > 0) parts.push(`<h2>Distribución de montos</h2><div class="chart">${histogram(series.amounts)}</div>`);
  if (series.byMethod.length > 0) parts.push(`<h2>Cobros por método</h2><div class="chart">${donut(series.byMethod)}</div>`);
  return parts.join('');
}

function reportsDir() {
  const dir = new Directory(Paths.document, 'reports');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/** Writes the PDF from base64: moving the printed cache file fails in Expo Go ("Missing 'READ' permission"). */
export async function createReportPdf(r: ReportData, fileName: string) {
  const { base64 } = await Print.printToFileAsync({ html: reportHtml(r), base64: true });
  if (!base64) throw new Error('expo-print no devolvió el contenido del PDF');
  const dest = new File(reportsDir(), `${fileName}.pdf`);
  if (dest.exists) dest.delete();
  dest.create();
  dest.write(base64, { encoding: 'base64' });
  return dest.uri;
}

/** Also used when a report saved as text is shared as PDF later. */
export async function attachPdf(db: SQLiteDatabase, reportId: number, kind: ReportKind, start: string, end: string) {
  const data = await buildReport(db, kind, start, end);
  const uri = await createReportPdf(data, `reporte-${reportId}-${kind}-${start}`);
  await setReportPdf(db, reportId, uri);
  return uri;
}
