import type { SQLiteDatabase } from 'expo-sqlite';

import type { Product } from '@/db/products';
import type { Settings } from '@/db/settings';
import { daysUntil } from '@/lib/format';

export type AlertKind = 'out_of_stock' | 'low_stock' | 'expired' | 'expiring';

export type StockAlert = { kind: AlertKind; product: Product; days?: number };

export function minStockFor(product: Product, settings: Settings) {
  return product.min_stock ?? settings.lowStockThreshold;
}

export function alertsForProduct(product: Product, settings: Settings): StockAlert[] {
  const alerts: StockAlert[] = [];
  if (product.stock <= 0) alerts.push({ kind: 'out_of_stock', product });
  else if (product.stock <= minStockFor(product, settings)) alerts.push({ kind: 'low_stock', product });

  if (product.expiry_date) {
    const days = daysUntil(product.expiry_date);
    if (days < 0) alerts.push({ kind: 'expired', product, days });
    else if (days <= settings.expiryWarningDays) alerts.push({ kind: 'expiring', product, days });
  }
  return alerts;
}

export async function computeAlerts(db: SQLiteDatabase, settings: Settings) {
  const products = await db.getAllAsync<Product>('SELECT * FROM products ORDER BY name COLLATE NOCASE');
  return products.flatMap((p) => alertsForProduct(p, settings));
}

export function groupAlerts(alerts: StockAlert[]) {
  return {
    outOfStock: alerts.filter((a) => a.kind === 'out_of_stock'),
    lowStock: alerts.filter((a) => a.kind === 'low_stock'),
    expired: alerts.filter((a) => a.kind === 'expired'),
    expiring: alerts.filter((a) => a.kind === 'expiring').sort((a, b) => (a.days ?? 0) - (b.days ?? 0)),
  };
}
