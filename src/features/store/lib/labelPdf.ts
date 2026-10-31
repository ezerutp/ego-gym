import * as Print from 'expo-print';

import type { Product } from '@/features/store/db/products';
import { code128Bars } from '@/features/store/lib/code128';
import { money } from '@/lib/format';
import { lightTheme } from '@/theme';

/** Common 50 × 30 mm sticker; 3 × 8 of them fit on an A4 sheet with room to cut. */
export const LABEL_MM = { width: 50, height: 30 };
export const LABELS_PER_SHEET = 24;
const A4_POINTS = { width: 595, height: 842 };

function escape(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function barcodeSvg(code: string) {
  const { bars, modules } = code128Bars(code);
  const rects = bars.map((b) => `<rect x="${b.left}" y="0" width="${b.width}" height="1"/>`).join('');
  return `<svg viewBox="0 0 ${modules} 1" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
}

function labelHtml(product: Product) {
  return `<div class="label">
    <div class="top">
      <span class="name">${escape(product.name)}</span>
      ${product.price != null ? `<span class="price">${escape(money(product.price))}</span>` : ''}
    </div>
    ${barcodeSvg(product.barcode)}
    <div class="code">${escape(product.barcode)}</div>
  </div>`;
}

function sheetHtml(product: Product, count: number) {
  const { colors } = lightTheme;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; }
    body { font-family: sans-serif; color: ${colors.ink}; }
    .sheet { display: grid; grid-template-columns: repeat(3, ${LABEL_MM.width}mm); gap: 4mm 10mm; padding: 12mm 0 0 20mm; }
    .label { width: ${LABEL_MM.width}mm; height: ${LABEL_MM.height}mm; border: 0.3mm solid #B5B5B5; border-radius: 3mm;
      padding: 2mm 3mm; display: flex; flex-direction: column; break-inside: avoid; }
    .top { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
    .name { font-size: 8pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .price { font-size: 9pt; font-weight: 800; color: ${colors.primary}; white-space: nowrap; }
    svg { flex: 1; width: 100%; margin-top: 1.5mm; }
    .code { font-family: monospace; font-size: 7pt; text-align: center; letter-spacing: 0.4mm; margin-top: 0.5mm; }
  </style></head><body><div class="sheet">${labelHtml(product).repeat(count)}</div></body></html>`;
}

export async function printLabels(product: Product, count: number) {
  await Print.printAsync({ html: sheetHtml(product, count), ...A4_POINTS });
}

export async function labelsPdf(product: Product, count: number) {
  const { uri } = await Print.printToFileAsync({ html: sheetHtml(product, count), ...A4_POINTS });
  return uri;
}
