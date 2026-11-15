import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { create } from "zustand";
import { getDb } from "./database";
import { SYNC_TABLES, isSyncTable } from "./syncTables";
import { CLOUD_URL, CLOUD_ANON_KEY } from "@/constants/cloud";
import { newId } from "@/utils/id";

/**
 * Multi-device sync through Supabase (plain REST, no extra native modules).
 *
 * - SQLite stays the source of truth on each phone; the app never waits on the network.
 * - SQLite triggers record every local change in `sync_dirty`.
 * - syncNow(): pull newer rows (cursor = server `seq`), then push dirty rows.
 * - Conflicts: last write to reach the server wins. A row with an unpushed local
 *   change is not overwritten by a pull.
 * - Deletes travel as tombstones (`deleted = true`).
 */

const SESSION_KEY = "salonpos.cloud.session";
const PAGE = 500;
const PUSH_BATCH = 200;
const INTERVAL_MS = 15_000;

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
}

interface CloudState {
  signedIn: boolean;
  email: string | null;
  syncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
  pending: number;
  /** Bumps whenever a pull changed local data, so screens can reload. */
  version: number;
}

export const useCloud = create<CloudState>(() => ({
  signedIn: false,
  email: null,
  syncing: false,
  lastSyncAt: null,
  error: null,
  pending: 0,
  version: 0,
}));

const set = (p: Partial<CloudState>) => useCloud.setState(p);

class AuthError extends Error {}

let session: Session | null = null;

async function timedFetch(url: string, init: RequestInit, ms = 20_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getMeta(k: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ v: string }>("SELECT v FROM sync_meta WHERE k = ?", [k]);
  return row?.v ?? null;
}

async function setMeta(k: string, v: string) {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO sync_meta (k, v) VALUES (?, ?)", [k, v]);
}

async function deviceId(): Promise<string> {
  let id = await getMeta("device");
  if (!id) {
    id = newId();
    await setMeta("device", id);
  }
  return id;
}

async function authRequest(grant: "password" | "refresh_token", body: Record<string, string>): Promise<Session> {
  let res: Response;
  try {
    res = await timedFetch(`${CLOUD_URL}/auth/v1/token?grant_type=${grant}`, {
      method: "POST",
      headers: { apikey: CLOUD_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Tidak bisa terhubung ke server. Cek internet.");
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = json.error_description ?? json.msg ?? json.message ?? `HTTP ${res.status}`;
    if (/invalid login/i.test(msg)) throw new AuthError("Email atau password salah");
    throw new AuthError(msg);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    email: json.user?.email ?? body.email ?? session?.email ?? "",
  };
}

async function saveSession(s: Session | null) {
  session = s;
  try {
    if (s) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(SESSION_KEY);
  } catch {}
}

async function freshToken(): Promise<string> {
  if (!session) throw new AuthError("Belum masuk ke cloud");
  if (session.expiresAt - Date.now() < 60_000) {
    try {
      await saveSession(await authRequest("refresh_token", { refresh_token: session.refreshToken }));
    } catch (e) {
      if (e instanceof AuthError) {
        await saveSession(null);
        set({ signedIn: false, email: null });
      }
      throw e;
    }
  }
  return session!.accessToken;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await freshToken();
  const res = await timedFetch(`${CLOUD_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: CLOUD_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 404 || /sync_rows/.test(text) && /does not exist|schema cache/i.test(text)) {
      throw new Error("Tabel sync_rows belum ada. Jalankan supabase/schema.sql di Supabase SQL Editor.");
    }
    throw new Error(`Server ${res.status}: ${text.slice(0, 120)}`);
  }
  return res;
}

// ---------- push ----------

async function pushDirty(): Promise<number> {
  const db = await getDb();
  const device = await deviceId();
  let total = 0;

  for (;;) {
    const dirty = await db.getAllAsync<{ tbl: string; pk: string; op: string; ts: string }>(
      "SELECT tbl, pk, op, ts FROM sync_dirty ORDER BY ts, rowid LIMIT ?",
      [PUSH_BATCH]
    );
    if (dirty.length === 0) break;

    const payload: any[] = [];
    for (const d of dirty) {
      if (!isSyncTable(d.tbl)) continue;
      if (d.op === "d") {
        payload.push({ tbl: d.tbl, pk: d.pk, data: null, deleted: true, device });
        continue;
      }
      const row = await db.getFirstAsync<any>(`SELECT * FROM ${d.tbl} WHERE ${SYNC_TABLES[d.tbl]} = ?`, [d.pk]);
      payload.push(
        row
          ? { tbl: d.tbl, pk: d.pk, data: row, deleted: false, device }
          : { tbl: d.tbl, pk: d.pk, data: null, deleted: true, device }
      );
    }

    if (payload.length > 0) {
      await rest("sync_rows?on_conflict=tbl,pk", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload),
      });
    }
    // Only clear marks that did not change while the request was in flight.
    for (const d of dirty) {
      await db.runAsync("DELETE FROM sync_dirty WHERE tbl = ? AND pk = ? AND ts = ?", [d.tbl, d.pk, d.ts]);
    }
    total += payload.length;
    if (dirty.length < PUSH_BATCH) break;
  }
  return total;
}

// ---------- pull ----------

const columnCache = new Map<string, string[]>();

async function columnsOf(tbl: string): Promise<string[]> {
  const hit = columnCache.get(tbl);
  if (hit) return hit;
  const db = await getDb();
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tbl})`);
  const cols = info.map((c) => c.name);
  columnCache.set(tbl, cols);
  return cols;
}

interface CloudRow {
  tbl: string;
  pk: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
  device: string | null;
  seq: number;
}

async function applyRows(rows: CloudRow[]): Promise<number> {
  const db = await getDb();
  const me = await deviceId();
  let changed = 0;

  // Child rows may arrive before their parent; ordering is not guaranteed across devices.
  await db.execAsync("PRAGMA foreign_keys = OFF");
  try {
    for (const r of rows) {
      if (!isSyncTable(r.tbl)) continue;
      if (r.device === me) continue; // echo of our own push
      const pkCol = SYNC_TABLES[r.tbl];

      // A pending local change wins; it will be pushed on this cycle.
      const pending = await db.getFirstAsync("SELECT 1 AS x FROM sync_dirty WHERE tbl = ? AND pk = ?", [r.tbl, r.pk]);
      if (pending) continue;

      if (r.deleted || !r.data) {
        await db.runAsync(`DELETE FROM ${r.tbl} WHERE ${pkCol} = ?`, [r.pk]);
      } else {
        const data = { ...r.data } as Record<string, unknown>;

        if (r.tbl === "transactions" && data.receipt_no) {
          // receipt_no is UNIQUE; two devices can issue the same number on the same day.
          const clash = await db.getFirstAsync(
            "SELECT 1 AS x FROM transactions WHERE receipt_no = ? AND local_id <> ?",
            [data.receipt_no as string, r.pk]
          );
          if (clash) data.receipt_no = `${data.receipt_no}-${String(r.pk).slice(0, 4)}`;
        }

        const cols = (await columnsOf(r.tbl)).filter((c) => c in data);
        if (cols.length === 0) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO ${r.tbl} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
          cols.map((c) => {
            const v = data[c];
            if (v === undefined || v === null) return null;
            if (typeof v === "object") return JSON.stringify(v);
            return v as string | number;
          })
        );
      }
      // The triggers marked this row dirty; it came from the cloud, so it is not a local change.
      await db.runAsync("DELETE FROM sync_dirty WHERE tbl = ? AND pk = ?", [r.tbl, r.pk]);
      changed++;
    }
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON");
  }
  return changed;
}

async function pullAll(): Promise<number> {
  let changed = 0;
  for (;;) {
    const cursor = Number((await getMeta("cursor")) ?? "0");
    const res = await rest(
      `sync_rows?select=tbl,pk,data,deleted,device,seq&seq=gt.${cursor}&order=seq.asc&limit=${PAGE}`
    );
    const rows = (await res.json()) as CloudRow[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    changed += await applyRows(rows);
    await setMeta("cursor", String(rows[rows.length - 1].seq));
    if (rows.length < PAGE) break;
  }
  return changed;
}

/** First sync on a device: queue every existing local row once, so the cloud receives data created before login. */
async function bootstrapDirty() {
  if ((await getMeta("bootstrapped")) === "1") return;
  const db = await getDb();
  const now = new Date().toISOString();
  for (const [tbl, pk] of Object.entries(SYNC_TABLES)) {
    await db.runAsync(`INSERT OR IGNORE INTO sync_dirty (tbl, pk, op, ts) SELECT '${tbl}', ${pk}, 'u', ? FROM ${tbl}`, [now]);
  }
  await setMeta("bootstrapped", "1");
}

async function countDirty(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM sync_dirty");
  return row?.c ?? 0;
}

// ---------- public API ----------

let running = false;

export async function syncNow(): Promise<void> {
  if (running || !session) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return;

  running = true;
  set({ syncing: true });
  try {
    const pulled = await pullAll(); // pull first so a fresh device adopts cloud data before pushing its own
    await bootstrapDirty();
    await pushDirty();
    set({
      error: null,
      lastSyncAt: new Date().toISOString(),
      pending: await countDirty(),
      ...(pulled > 0 ? { version: useCloud.getState().version + 1 } : {}),
    });
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e), pending: await countDirty().catch(() => 0) });
  } finally {
    running = false;
    set({ syncing: false });
  }
}

export async function cloudLogin(email: string, password: string): Promise<void> {
  const s = await authRequest("password", { email: email.trim(), password });
  await saveSession(s);
  set({ signedIn: true, email: s.email, error: null });
  await syncNow();
  const err = useCloud.getState().error;
  if (err) throw new Error(err);
}

export async function cloudLogout(): Promise<void> {
  await saveSession(null);
  set({ signedIn: false, email: null, error: null, syncing: false });
}

/** Call once at startup. Restores the saved login and keeps syncing while the app is open. */
export function startCloudSync(): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  (async () => {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        session = JSON.parse(raw) as Session;
        set({ signedIn: true, email: session.email, pending: await countDirty() });
        syncNow();
      }
    } catch {}
  })();

  timer = setInterval(() => {
    syncNow();
  }, INTERVAL_MS);
  const appSub = AppState.addEventListener("change", (s) => {
    if (s === "active") syncNow();
  });
  const netSub = NetInfo.addEventListener((s) => {
    if (s.isConnected && s.isInternetReachable !== false) syncNow();
  });

  return () => {
    if (timer) clearInterval(timer);
    appSub.remove();
    netSub();
  };
}
