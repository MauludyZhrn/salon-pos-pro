import { create } from "zustand";
import { getDb } from "@/services/database";
import { newId } from "@/utils/id";
import type { Promotion } from "@/types";

/** Diskon / promo / biaya tambahan. SQLite adalah sumber data; tabelnya ikut sinkron cloud lewat trigger. */

function rowToPromo(row: any): Promotion {
  let itemIds: string[] = [];
  try {
    itemIds = row.item_ids_json ? JSON.parse(row.item_ids_json) : [];
  } catch {
    itemIds = [];
  }
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    valueType: row.value_type,
    value: row.value,
    scope: row.scope,
    itemIds,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    active: !!row.active,
    createdAt: row.created_at,
  };
}

export type PromoInput = Omit<Promotion, "id" | "createdAt">;

interface PromoState {
  promos: Promotion[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (input: PromoInput, id?: string) => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const usePromoStore = create<PromoState>((set, get) => ({
  promos: [],
  loaded: false,

  async load() {
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM promotions ORDER BY active DESC, created_at DESC");
    set({ promos: rows.map(rowToPromo), loaded: true });
  },

  async save(input, id) {
    const db = await getDb();
    const itemIds = input.scope === "items" ? JSON.stringify(input.itemIds) : null;
    if (id) {
      await db.runAsync(
        `UPDATE promotions SET name = ?, kind = ?, value_type = ?, value = ?, scope = ?, item_ids_json = ?,
                start_date = ?, end_date = ?, active = ? WHERE id = ?`,
        [input.name, input.kind, input.valueType, input.value, input.scope, itemIds, input.startDate, input.endDate, input.active ? 1 : 0, id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO promotions (id, name, kind, value_type, value, scope, item_ids_json, start_date, end_date, active, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [newId(), input.name, input.kind, input.valueType, input.value, input.scope, itemIds, input.startDate, input.endDate, input.active ? 1 : 0, new Date().toISOString()]
      );
    }
    await get().load();
  },

  async setActive(id, active) {
    const db = await getDb();
    await db.runAsync("UPDATE promotions SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
    await get().load();
  },

  async remove(id) {
    const db = await getDb();
    await db.runAsync("DELETE FROM promotions WHERE id = ?", [id]);
    await get().load();
  },
}));
