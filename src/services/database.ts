import * as SQLite from "expo-sqlite";

/**
 * Offline-first local DB. SQLite is the system of record; the app NEVER
 * blocks on network. Writes land here synchronously (within a tx), then
 * get queued for push to Google Sheets by syncQueue.ts.
 */

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync("salon_pos.db");
  await migrate(dbInstance);
  return dbInstance;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','kasir','stylist')),
      pin_hash TEXT NOT NULL,
      default_commission_basis TEXT NOT NULL,
      default_commission_value INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('service','retail')),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      duration_minutes INTEGER,
      commission_basis TEXT NOT NULL,
      commission_value INTEGER NOT NULL,
      consumes_json TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      item_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('retail','bahan_baku')),
      unit TEXT NOT NULL,
      stock_qty REAL NOT NULL DEFAULT 0,
      low_stock_threshold REAL NOT NULL DEFAULT 0,
      cost_price INTEGER NOT NULL DEFAULT 0,
      sell_price INTEGER,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      local_id TEXT PRIMARY KEY,
      receipt_no TEXT NOT NULL UNIQUE,
      outlet_id TEXT NOT NULL,
      cashier_id TEXT NOT NULL,
      customer_name TEXT,
      subtotal INTEGER NOT NULL,
      discount_total INTEGER NOT NULL,
      tax_total INTEGER NOT NULL,
      grand_total INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_breakdown_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending','paid','void','refunded')),
      midtrans_order_id TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transaction_local_id TEXT NOT NULL REFERENCES transactions(local_id),
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      line_discount INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      stylist_id TEXT,
      commission_basis TEXT NOT NULL,
      commission_value INTEGER NOT NULL,
      commission_amount INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      transaction_local_id TEXT,
      date TEXT NOT NULL,
      account TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('debit','kredit')),
      amount INTEGER NOT NULL,
      memo TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      stylist_id TEXT NOT NULL,
      service_ids_json TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- Generic outbox: one row per pending sync op, decoupled from table shape
    -- so new sheets can be added without a sync-engine migration.
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet TEXT NOT NULL,
      row_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_txn_items_txn ON transaction_items(transaction_local_id);
    CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(start_at);
    CREATE INDEX IF NOT EXISTS idx_outbox_sheet ON sync_outbox(sheet);
  `);
}

/** Run fn inside a single SQLite transaction; rolls back entirely on throw. */
export async function withTransaction<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const db = await getDb();
  let result!: T;
  await db.withTransactionAsync(async () => {
    result = await fn(db);
  });
  return result;
}
