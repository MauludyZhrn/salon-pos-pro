import NetInfo from "@react-native-community/netinfo";
import { getDb } from "./database";

/**
 * Offline-first sync engine. UI never awaits this — enqueueSync() writes to
 * a local outbox table and returns immediately. A background drain loop
 * pushes batches to the Google Apps Script endpoint whenever network is up,
 * with exponential backoff on failure. Idempotent: every row carries its
 * local primary key (`localId`/`itemId`/etc as `rowKey`), so Apps Script
 * upserts instead of appending — a retried push never duplicates a row.
 */

const SETTINGS_KEYS = {
  endpoint: "salonpos.settings.appsScriptUrl",
  apiKey: "salonpos.settings.appsScriptKey",
} as const;

let settingsCache: { endpoint: string | null; apiKey: string | null } = { endpoint: null, apiKey: null };

export function configureSync(endpoint: string, apiKey: string) {
  settingsCache = { endpoint, apiKey };
}

export async function enqueueSync(sheet: string, rowKey: string, payload: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO sync_outbox (sheet, row_key, payload_json, attempts, created_at) VALUES (?,?,?,0,?)",
    [sheet, rowKey, JSON.stringify(payload), new Date().toISOString()]
  );
  // Fire-and-forget drain attempt; failures stay queued for the next trigger
  // (app foreground, NetInfo reconnect event, or the periodic drain below).
  drainQueue().catch(() => {});
}

interface OutboxRow {
  id: number;
  sheet: string;
  row_key: string;
  payload_json: string;
  attempts: number;
}

let draining = false;

export async function drainQueue(): Promise<{ pushed: number; remaining: number }> {
  if (draining) return { pushed: 0, remaining: -1 };
  if (!settingsCache.endpoint || !settingsCache.apiKey) return { pushed: 0, remaining: -1 };

  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return { pushed: 0, remaining: -1 };

  draining = true;
  let pushed = 0;
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<OutboxRow>(
      "SELECT * FROM sync_outbox WHERE attempts < 8 ORDER BY id ASC LIMIT 100"
    );
    if (rows.length === 0) return { pushed: 0, remaining: 0 };

    const bySheet = new Map<string, OutboxRow[]>();
    for (const r of rows) {
      const arr = bySheet.get(r.sheet) ?? [];
      arr.push(r);
      bySheet.set(r.sheet, arr);
    }

    for (const [sheet, sheetRows] of bySheet) {
      const batch = sheetRows.map((r) => JSON.parse(r.payload_json));
      try {
        const res = await fetch(settingsCache.endpoint!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "push", sheet, apiKey: settingsCache.apiKey, rows: batch }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "unknown server error");

        const ids = sheetRows.map((r) => r.id);
        await db.runAsync(`DELETE FROM sync_outbox WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
        pushed += sheetRows.length;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        for (const r of sheetRows) {
          await db.runAsync("UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?", [
            message,
            r.id,
          ]);
        }
      }
    }

    const remainingRow = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM sync_outbox");
    return { pushed, remaining: remainingRow?.cnt ?? 0 };
  } finally {
    draining = false;
  }
}

/** Backoff schedule in ms, indexed by attempts count — caller (background task) reads this to decide retry timing. */
export function backoffMs(attempts: number): number {
  const base = 2000;
  const capped = Math.min(attempts, 8);
  return Math.min(base * 2 ** capped, 5 * 60_000); // cap at 5 min
}

/** Call once at app startup: drains on launch and on every reconnect. */
export function startSyncListener(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      drainQueue().catch(() => {});
    }
  });
  drainQueue().catch(() => {});
  return unsubscribe;
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM sync_outbox");
  return row?.cnt ?? 0;
}
