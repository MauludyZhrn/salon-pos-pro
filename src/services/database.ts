import * as SQLite from "expo-sqlite";
import { SYNC_TABLES } from "./syncTables";

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

    -- Diskon / promo / biaya tambahan yang dikelola di Pengaturan dan dipasang otomatis ke keranjang.
    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('discount','promo','additional')),
      value_type TEXT NOT NULL CHECK (value_type IN ('percent','fixed')),
      value INTEGER NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('all','service','retail','items')),
      item_ids_json TEXT,
      start_date TEXT,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1,
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

    -- Membership & loyalty poin: 1x treatment = 10 poin, 100 poin (10x treatment) = 1x gratis treatment.
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      member_code TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      total_treatments INTEGER NOT NULL DEFAULT 0,
      total_redeemed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_point_logs (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      transaction_local_id TEXT,
      type TEXT NOT NULL CHECK (type IN ('earn','redeem','adjust')),
      points_delta INTEGER NOT NULL,
      treatments_count INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_member_logs_member ON member_point_logs(member_id);

    -- Cloud (Supabase) replication: triggers record every local change here.
    CREATE TABLE IF NOT EXISTS sync_meta (k TEXT PRIMARY KEY, v TEXT);
    CREATE TABLE IF NOT EXISTS sheets_dirty (
      tbl TEXT NOT NULL,
      pk TEXT NOT NULL,
      ts TEXT NOT NULL,
      PRIMARY KEY (tbl, pk)
    );
    CREATE TABLE IF NOT EXISTS sync_dirty (
      tbl TEXT NOT NULL,
      pk TEXT NOT NULL,
      op TEXT NOT NULL,
      ts TEXT NOT NULL,
      PRIMARY KEY (tbl, pk)
    );
  `);

  // Kolom baru untuk database yang sudah ada (CREATE TABLE IF NOT EXISTS tidak menambah kolom).
  await addColumnIfMissing(db, "transactions", "extra_total", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "transactions", "edited_at", "TEXT");
  await addColumnIfMissing(db, "transactions", "member_id", "TEXT");
  await addColumnIfMissing(db, "transactions", "points_earned", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "transactions", "points_redeemed", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "transaction_items", "line_extra", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "transaction_items", "adjustments_json", "TEXT");

  const triggers = Object.entries(SYNC_TABLES)
    .map(([tbl, pk]) => {
      const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
      return `
        CREATE TRIGGER IF NOT EXISTS sy_i_${tbl} AFTER INSERT ON ${tbl} BEGIN
          INSERT OR REPLACE INTO sync_dirty (tbl, pk, op, ts) VALUES ('${tbl}', NEW.${pk}, 'u', ${now});
        END;
        CREATE TRIGGER IF NOT EXISTS sy_u_${tbl} AFTER UPDATE ON ${tbl} BEGIN
          INSERT OR REPLACE INTO sync_dirty (tbl, pk, op, ts) VALUES ('${tbl}', NEW.${pk}, 'u', ${now});
        END;
        CREATE TRIGGER IF NOT EXISTS sy_d_${tbl} AFTER DELETE ON ${tbl} BEGIN
          INSERT OR REPLACE INTO sync_dirty (tbl, pk, op, ts) VALUES ('${tbl}', OLD.${pk}, 'd', ${now});
        END;`;
    })
    .join("\n");
  await db.execAsync(triggers);

  // Google Sheets reporting feed: same idea, separate queue so the two syncs never interfere.
  const sheetsTriggers = Object.entries(SYNC_TABLES)
    .map(([tbl, pk]) => {
      const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
      return `
        CREATE TRIGGER IF NOT EXISTS sh_i_${tbl} AFTER INSERT ON ${tbl} BEGIN
          INSERT OR REPLACE INTO sheets_dirty (tbl, pk, ts) VALUES ('${tbl}', NEW.${pk}, ${now});
        END;
        CREATE TRIGGER IF NOT EXISTS sh_u_${tbl} AFTER UPDATE ON ${tbl} BEGIN
          INSERT OR REPLACE INTO sheets_dirty (tbl, pk, ts) VALUES ('${tbl}', NEW.${pk}, ${now});
        END;`;
    })
    .join("\n");
  await db.execAsync(sheetsTriggers);
}

async function addColumnIfMissing(db: SQLite.SQLiteDatabase, table: string, column: string, ddl: string) {
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (info.some((c) => c.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
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
