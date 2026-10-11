import { create } from "zustand";
import { getDb, withTransaction } from "@/services/database";
import { enqueueSync } from "@/services/syncQueue";
import type { InventoryItem } from "@/types";

interface InventoryState {
  items: InventoryItem[];
  lowStockItems: InventoryItem[];
  loading: boolean;
  loadInventory: () => Promise<void>;
  /** Deducts BOM for every sold line that declares `consumes`. Call inside the same
   *  SQLite transaction as the sale so stock and sale commit/rollback together. */
  autoDeductForSale: (
    lines: { consumes?: { inventoryItemId: string; qtyPerUnit: number }[]; qty: number }[]
  ) => Promise<InventoryItem[]>;
  /** Reverses a prior auto-deduct — used on Midtrans deny/expire rollback. */
  restockForVoidedSale: (
    lines: { consumes?: { inventoryItemId: string; qtyPerUnit: number }[]; qty: number }[]
  ) => Promise<void>;
  adjustStock: (itemId: string, deltaQty: number, reason: string) => Promise<void>;
}

function rowToItem(row: any): InventoryItem {
  return {
    itemId: row.item_id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    stockQty: row.stock_qty,
    lowStockThreshold: row.low_stock_threshold,
    costPrice: row.cost_price,
    sellPrice: row.sell_price,
    updatedAt: row.updated_at,
  };
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  lowStockItems: [],
  loading: false,

  async loadInventory() {
    set({ loading: true });
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM inventory ORDER BY name ASC");
    const items = rows.map(rowToItem);
    set({
      items,
      lowStockItems: items.filter((i) => i.stockQty <= i.lowStockThreshold),
      loading: false,
    });
  },

  async autoDeductForSale(lines) {
    const touched: InventoryItem[] = [];
    await withTransaction(async (db) => {
      const now = new Date().toISOString();
      for (const line of lines) {
        for (const bom of line.consumes ?? []) {
          const deductQty = bom.qtyPerUnit * line.qty;
          await db.runAsync(
            "UPDATE inventory SET stock_qty = stock_qty - ?, updated_at = ? WHERE item_id = ?",
            [deductQty, now, bom.inventoryItemId]
          );
          const row = await db.getFirstAsync<any>("SELECT * FROM inventory WHERE item_id = ?", [
            bom.inventoryItemId,
          ]);
          if (row) {
            const item = rowToItem(row);
            touched.push(item);
            enqueueSync("Inventory", item.itemId, item);
          }
        }
      }
    });

    const lowNow = touched.filter((i) => i.stockQty <= i.lowStockThreshold);
    if (lowNow.length > 0) {
      set((state) => {
        const merged = new Map(state.lowStockItems.map((i) => [i.itemId, i]));
        for (const i of lowNow) merged.set(i.itemId, i);
        return { lowStockItems: Array.from(merged.values()) };
      });
    }
    await get().loadInventory();
    return touched;
  },

  async restockForVoidedSale(lines) {
    await withTransaction(async (db) => {
      const now = new Date().toISOString();
      for (const line of lines) {
        for (const bom of line.consumes ?? []) {
          const restoreQty = bom.qtyPerUnit * line.qty;
          await db.runAsync(
            "UPDATE inventory SET stock_qty = stock_qty + ?, updated_at = ? WHERE item_id = ?",
            [restoreQty, now, bom.inventoryItemId]
          );
          const row = await db.getFirstAsync<any>("SELECT * FROM inventory WHERE item_id = ?", [
            bom.inventoryItemId,
          ]);
          if (row) enqueueSync("Inventory", bom.inventoryItemId, rowToItem(row));
        }
      }
    });
    await get().loadInventory();
  },

  async adjustStock(itemId, deltaQty, reason) {
    const now = new Date().toISOString();
    await withTransaction(async (db) => {
      await db.runAsync("UPDATE inventory SET stock_qty = stock_qty + ?, updated_at = ? WHERE item_id = ?", [
        deltaQty,
        now,
        itemId,
      ]);
    });
    const db = await getDb();
    const row = await db.getFirstAsync<any>("SELECT * FROM inventory WHERE item_id = ?", [itemId]);
    if (row) enqueueSync("Inventory", itemId, rowToItem(row));
    // `reason` is logged by the caller into journal_entries as beban_operasional when it's shrinkage/waste.
    void reason;
    await get().loadInventory();
  },
}));
