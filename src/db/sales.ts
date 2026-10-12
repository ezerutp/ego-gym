import type { SQLiteDatabase } from 'expo-sqlite';

export type CartLine = {
  productId: number;
  name: string;
  imageUri: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number;
};

export type Sale = { id: number; total: number; customer_name: string | null; created_at: string };
export type SaleItem = { id: number; product_id: number | null; name: string; quantity: number; unit_price: number };

export async function createSale(db: SQLiteDatabase, lines: CartLine[], customerName: string | null) {
  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  let saleId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO sales (total, customer_name) VALUES (?, ?)',
      round2(total),
      customerName?.trim() || null,
    );
    saleId = result.lastInsertRowId;
    for (const line of lines) {
      await db.runAsync(
        'INSERT INTO sale_items (sale_id, product_id, name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
        saleId,
        line.productId,
        line.name,
        line.quantity,
        line.unitPrice,
      );
      await db.runAsync(
        `UPDATE products SET stock = MAX(stock - ?, 0), synced = 0, updated_at = datetime('now') WHERE id = ?`,
        line.quantity,
        line.productId,
      );
      await db.runAsync(
        'INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)',
        line.productId,
        -line.quantity,
        `venta #${saleId}`,
      );
    }
  });
  return saleId;
}

export async function getSale(db: SQLiteDatabase, id: number) {
  const sale = await db.getFirstAsync<Sale>('SELECT * FROM sales WHERE id = ?', id);
  if (!sale) return null;
  const items = await db.getAllAsync<SaleItem>('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', id);
  return { sale, items };
}

export async function listRecentSales(db: SQLiteDatabase, limit = 10) {
  return db.getAllAsync<Sale & { items: number }>(
    `SELECT s.*, (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE sale_id = s.id) AS items
     FROM sales s ORDER BY s.id DESC LIMIT ?`,
    limit,
  );
}

/** Totals for today, using the device's local day. */
export async function getTodaySummary(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number; total: number | null }>(
    `SELECT COUNT(*) AS count, SUM(total) AS total FROM sales
     WHERE date(created_at, 'localtime') = date('now', 'localtime')`,
  );
  return { count: row?.count ?? 0, total: row?.total ?? 0 };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
