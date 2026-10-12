import type { SQLiteDatabase } from 'expo-sqlite';

import type { ProductSourceId } from '@/lib/productLookup';

export type Product = {
  id: number;
  barcode: string;
  name: string;
  brand: string | null;
  quantity_label: string | null;
  image_uri: string | null;
  price: number | null;
  stock: number;
  min_stock: number | null;
  expiry_date: string | null;
  source: 'manual' | ProductSourceId;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  barcode: string;
  name: string;
  brand?: string | null;
  quantity_label?: string | null;
  image_uri?: string | null;
  price?: number | null;
  stock: number;
  min_stock?: number | null;
  expiry_date?: string | null;
  source?: Product['source'];
};

export async function getProductByBarcode(db: SQLiteDatabase, barcode: string) {
  return db.getFirstAsync<Product>('SELECT * FROM products WHERE barcode = ?', barcode);
}

export async function getProduct(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Product>('SELECT * FROM products WHERE id = ?', id);
}

export async function listProducts(db: SQLiteDatabase, search = '') {
  const term = `%${search.trim()}%`;
  return db.getAllAsync<Product>(
    `SELECT * FROM products
     WHERE name LIKE ? OR brand LIKE ? OR barcode LIKE ?
     ORDER BY name COLLATE NOCASE`,
    term,
    term,
    term,
  );
}

export async function createProduct(db: SQLiteDatabase, input: ProductInput) {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO products (barcode, name, brand, quantity_label, image_uri, price, stock, min_stock, expiry_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.barcode,
      input.name.trim(),
      input.brand ?? null,
      input.quantity_label ?? null,
      input.image_uri ?? null,
      input.price ?? null,
      input.stock,
      input.min_stock ?? null,
      input.expiry_date ?? null,
      input.source ?? 'manual',
    );
    id = result.lastInsertRowId;
    if (input.stock !== 0) {
      await db.runAsync(
        'INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)',
        id,
        input.stock,
        'alta',
      );
    }
  });
  return id;
}

export async function updateProduct(db: SQLiteDatabase, id: number, input: Omit<ProductInput, 'barcode' | 'stock'>) {
  await db.runAsync(
    `UPDATE products SET name = ?, brand = ?, quantity_label = ?, image_uri = ?, price = ?, min_stock = ?,
       expiry_date = ?, synced = 0, updated_at = datetime('now')
     WHERE id = ?`,
    input.name.trim(),
    input.brand ?? null,
    input.quantity_label ?? null,
    input.image_uri ?? null,
    input.price ?? null,
    input.min_stock ?? null,
    input.expiry_date ?? null,
    id,
  );
}

/** Adds (positive) or removes (negative) units, logging the movement. Stock never goes below zero. */
export async function adjustStock(db: SQLiteDatabase, id: number, delta: number, reason: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE products SET stock = MAX(stock + ?, 0), synced = 0, updated_at = datetime('now') WHERE id = ?`,
      delta,
      id,
    );
    await db.runAsync('INSERT INTO stock_movements (product_id, delta, reason) VALUES (?, ?, ?)', id, delta, reason);
  });
}

export async function deleteProduct(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM products WHERE id = ?', id);
}

export type StockMovement = { id: number; delta: number; reason: string; created_at: string };

export async function listMovements(db: SQLiteDatabase, productId: number, limit = 20) {
  return db.getAllAsync<StockMovement>(
    'SELECT id, delta, reason, created_at FROM stock_movements WHERE product_id = ? ORDER BY id DESC LIMIT ?',
    productId,
    limit,
  );
}
