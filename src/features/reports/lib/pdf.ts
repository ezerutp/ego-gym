import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';

import { describePeriod, type ReportData } from '@/features/reports/lib/build';
import { lightTheme } from '@/theme';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Printed reports always use the light palette, like the receipts. */
export function reportHtml(r: ReportData) {
  const c = lightTheme.colors;
  const highlights = r.highlights
    .map((h) => `<div class="kpi"><div class="label">${escape(h.label)}</div><div class="value">${escape(h.value)}</div></div>`)
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
${tables}
<footer>Generado por EGO Gym el ${escape(new Date().toLocaleString('es-PE'))}</footer>
</body></html>`;
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
