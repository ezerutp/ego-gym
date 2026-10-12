import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'ego-gym.db';

const DATABASE_VERSION = 6;

export async function migrateDb(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        brand TEXT,
        quantity_label TEXT,
        image_uri TEXT,
        price REAL,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER,
        expiry_date TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total REAL NOT NULL,
        customer_name TEXT,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE INDEX idx_products_name ON products(name);
      CREATE INDEX idx_movements_product ON stock_movements(product_id);
      CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
    `);
    version = 1;
  }

  if (version === 1) {
    await db.execAsync(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'reception')),
        pin_hash TEXT NOT NULL,
        pin_salt TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      ALTER TABLE sales ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    version = 2;
  }

  if (version === 2) {
    await db.execAsync(`
      CREATE TABLE members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL DEFAULT '',
        dni TEXT,
        phone TEXT,
        photo_uri TEXT,
        birth_date TEXT,
        emergency_name TEXT,
        emergency_phone TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'active', 'inactive')),
        source TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX idx_members_dni ON members(dni) WHERE dni IS NOT NULL;
      CREATE INDEX idx_members_name ON members(first_name, last_name);
    `);
    version = 3;
  }

  if (version === 3) {
    await db.execAsync(`
      CREATE TABLE plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('monthly', 'alternate', 'daily', 'promo', 'other')),
        price REAL NOT NULL DEFAULT 0,
        duration_days INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO plans (name, kind, duration_days) VALUES
        ('Mensual', 'monthly', 30),
        ('Interdiario', 'alternate', 30),
        ('Pase diario', 'daily', 1),
        ('Promo dúo', 'promo', 30);

      CREATE TABLE coaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        photo_uri TEXT,
        specialty TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
        plan_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        price REAL NOT NULL,
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE subscription_addons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'personal',
        coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
        price REAL NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_subscriptions_member ON subscriptions(member_id, end_date);
      CREATE INDEX idx_addons_subscription ON subscription_addons(subscription_id);
      CREATE INDEX idx_addons_coach ON subscription_addons(coach_id);
    `);
    version = 4;
  }

  if (version === 4) {
    await db.execAsync(`
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        amount REAL NOT NULL CHECK (amount > 0),
        method TEXT NOT NULL CHECK (method IN ('cash', 'yape', 'card', 'transfer')),
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_payments_subscription ON payments(subscription_id);
      CREATE INDEX idx_payments_member ON payments(member_id);
      CREATE INDEX idx_payments_created ON payments(created_at);
    `);
    version = 5;
  }

  if (version === 5) {
    await db.execAsync(`
      CREATE TABLE report_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('summary', 'sales', 'payments', 'members')),
        frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
        weekday INTEGER,
        month_day INTEGER,
        hour INTEGER NOT NULL,
        format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'text')),
        active INTEGER NOT NULL DEFAULT 1,
        last_period TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER REFERENCES report_schedules(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        pdf_uri TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_reports_created ON reports(created_at);
    `);
    version = 6;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
