import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { getDb } from "./database";
import { SYNC_TABLES, isSyncTable, type SyncTable } from "./syncTables";

/**
 * Google Sheets reporting sync (Apps Script web app). One-way: phone -> Sheet.
 *
 * SQLite triggers (sh_* in database.ts) record every changed row in `sheets_dirty`.
 * drainQueue() sends those rows as plain objects, keyed by the table's own column
 * names, and the Apps Script upserts by primary key. The URL and key are saved on
 * the device, so sync stays on after the app restarts.
 */

const KEYS = {
  endpoint: "salonpos.settings.appsScriptUrl",
  apiKey: "salonpos.settings.appsScriptKey",
} as const;

/** Local table -> Sheet tab name. */
// Tabel tanpa entri di sini (mis. promotions) hanya disinkron ke cloud, tidak ke Google Sheets.
const SHEET_NAME: Partial<Record<SyncTable, string>> = {
  transactions: "Transactions",
  transaction_items: "TransactionItems",
  journal_entries: "JournalEntries",
  inventory: "Inventory",
  bookings: "Bookings",
  employees: "Employees",
  catalog_items: "Catalog",
};

/** Columns never sent to the Sheet. */
const OMIT: Partial<Record<SyncTable, string[]>> = { employees: ["pin_hash"] };

const BATCH = 100;

let settings: { endpoint: string; apiKey: string } | null = null;

export function isSheetsConfigured(): boolean {
  return settings !== null;
}

export function getSheetsSettings() {
  return settings;
}

export async function loadSyncSettings(): Promise<{ endpoint: string; apiKey: string } | null> {
  try {
    const [endpoint, apiKey] = await Promise.all([AsyncStorage.getItem(KEYS.endpoint), AsyncStorage.getItem(KEYS.apiKey)]);
    settings = endpoint && apiKey ? { endpoint, apiKey } : null;
  } catch {
    settings = null;
  }
  return settings;
}

/** Saves the endpoint + key on the device and activates sync. */
export async function configureSync(endpoint: string, apiKey: string): Promise<void> {
  const cleaned = { endpoint: endpoint.trim(), apiKey: apiKey.trim() };
  settings = cleaned;
  try {
    await AsyncStorage.multiSet([
      [KEYS.endpoint, cleaned.endpoint],
      [KEYS.apiKey, cleaned.apiKey],
    ]);
  } catch {}
  await bootstrapSheetsDirty();
  drainQueue().catch(() => {});
}

export async function clearSyncSettings(): Promise<void> {
  settings = null;
  try {
    await AsyncStorage.multiRemove([KEYS.endpoint, KEYS.apiKey]);
  } catch {}
}

/** Checks the URL and key against the Apps Script without writing anything. */
export async function testSheetsConnection(endpoint: string, apiKey: string): Promise<void> {
  const url = `${endpoint.trim()}${endpoint.includes("?") ? "&" : "?"}op=ping&apiKey=${encodeURIComponent(apiKey.trim())}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Tidak bisa menjangkau URL. Cek internet dan URL /exec.");
  }
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Respons bukan JSON. Pastikan URL berakhiran /exec dan akses 'Anyone' pada deployment.");
  }
  if (!json.ok) throw new Error(json.error === "unauthorized" ? "API Key salah" : String(json.error ?? "Gagal"));
}

/** First activation: queue every existing row once so the Sheet gets the history. */
async function bootstrapSheetsDirty() {
  const db = await getDb();
  const done = await db.getFirstAsync<{ v: string }>("SELECT v FROM sync_meta WHERE k = 'sheets_bootstrapped'");
  if (done?.v === "1") return;
  const now = new Date().toISOString();
  for (const [tbl, pk] of Object.entries(SYNC_TABLES)) {
    if (!(tbl in SHEET_NAME)) continue;
    await db.runAsync(`INSERT OR IGNORE INTO sheets_dirty (tbl, pk, ts) SELECT '${tbl}', ${pk}, ? FROM ${tbl}`, [now]);
  }
  await db.runAsync("INSERT OR REPLACE INTO sync_meta (k, v) VALUES ('sheets_bootstrapped', '1')");
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Kept for call sites that used the old outbox. Changes are tracked by triggers
 * now, so this only schedules a push shortly after the caller's write.
 */
export async function enqueueSync(_sheet: string, _rowKey: string, _payload?: unknown): Promise<void> {
  if (!settings) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    drainQueue().catch(() => {});
  }, 1500);
}

let draining = false;
let lastError: string | null = null;

export function lastSheetsError(): string | null {
  return lastError;
}

export async function drainQueue(): Promise<{ pushed: number; remaining: number }> {
  if (draining || !settings) return { pushed: 0, remaining: -1 };

  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return { pushed: 0, remaining: -1 };

  draining = true;
  let pushed = 0;
  try {
    const db = await getDb();
    const dirty = await db.getAllAsync<{ tbl: string; pk: string; ts: string }>(
      "SELECT tbl, pk, ts FROM sheets_dirty ORDER BY ts, rowid LIMIT 500"
    );

    const byTable = new Map<SyncTable, { pk: string; ts: string }[]>();
    for (const d of dirty) {
      if (!isSyncTable(d.tbl) || !(d.tbl in SHEET_NAME)) {
        await db.runAsync("DELETE FROM sheets_dirty WHERE tbl = ? AND pk = ?", [d.tbl, d.pk]);
        continue;
      }
      const arr = byTable.get(d.tbl) ?? [];
      arr.push({ pk: d.pk, ts: d.ts });
      byTable.set(d.tbl, arr);
    }

    for (const [tbl, entries] of byTable) {
      for (let i = 0; i < entries.length; i += BATCH) {
        const chunk = entries.slice(i, i + BATCH);
        const rows: Record<string, unknown>[] = [];
        const sent: { pk: string; ts: string }[] = [];
        for (const e of chunk) {
          const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${tbl} WHERE ${SYNC_TABLES[tbl]} = ?`, [e.pk]);
          if (!row) {
            // Deleted locally; the Sheet keeps its history row.
            await db.runAsync("DELETE FROM sheets_dirty WHERE tbl = ? AND pk = ? AND ts = ?", [tbl, e.pk, e.ts]);
            continue;
          }
          for (const col of OMIT[tbl] ?? []) delete row[col];
          rows.push(row);
          sent.push(e);
        }
        if (rows.length === 0) continue;

        try {
          const res = await fetch(settings.endpoint, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids a CORS preflight; Apps Script reads the raw body
            body: JSON.stringify({ op: "push", sheet: SHEET_NAME[tbl], apiKey: settings.apiKey, rows }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!json.ok) throw new Error(json.error ?? "kesalahan server");
          if (Array.isArray(json.errors) && json.errors.length > 0) {
            throw new Error(`${json.errors.length} baris ditolak: ${json.errors[0].message}`);
          }
          for (const e of sent) {
            await db.runAsync("DELETE FROM sheets_dirty WHERE tbl = ? AND pk = ? AND ts = ?", [tbl, e.pk, e.ts]);
          }
          pushed += sent.length;
          lastError = null;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          return { pushed, remaining: await pendingCount() }; // stop; retry on the next trigger
        }
      }
    }
    return { pushed, remaining: await pendingCount() };
  } finally {
    draining = false;
  }
}

/** Backoff schedule in ms, kept for callers that retry on their own. */
export function backoffMs(attempts: number): number {
  const base = 2000;
  const capped = Math.min(attempts, 8);
  return Math.min(base * 2 ** capped, 5 * 60_000);
}

/** Call once at app startup: loads the saved config, then drains on launch and on reconnect. */
export function startSyncListener(): () => void {
  let unsubscribe: (() => void) | null = null;
  let stopped = false;

  (async () => {
    await loadSyncSettings();
    if (stopped) return;
    unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) drainQueue().catch(() => {});
    });
    drainQueue().catch(() => {});
  })();

  const interval = setInterval(() => {
    if (settings) drainQueue().catch(() => {});
  }, 60_000);

  return () => {
    stopped = true;
    clearInterval(interval);
    unsubscribe?.();
  };
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM sheets_dirty");
  return row?.cnt ?? 0;
}
