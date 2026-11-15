import { getDb } from "./database";

/**
 * Seeds starter catalog + inventory only. Employees are NOT seeded: the
 * first-run screen (app/index.tsx) creates the owner account.
 * Safe to call repeatedly: skipped once any catalog row exists.
 */
export async function seedIfEmpty(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM catalog_items");
  if (row && row.cnt > 0) return;

  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const inventory: [string, string, "retail" | "bahan_baku", string, number, number, number, number | null][] = [
      ["inv-shampoo-1l", "Shampoo Professional 1L", "bahan_baku", "ml", 4000, 1000, 180000, null],
      ["inv-color-tube", "Color Cream Tube 60g", "bahan_baku", "g", 1800, 600, 45000, null],
      ["inv-retail-shampoo", "Shampoo Retail 250ml", "retail", "pcs", 18, 5, 35000, 65000],
      ["inv-retail-serum", "Hair Serum 100ml", "retail", "pcs", 3, 5, 42000, 85000],
    ];
    for (const [id, name, category, unit, stock, threshold, cost, sell] of inventory) {
      await db.runAsync(
        `INSERT OR IGNORE INTO inventory (item_id, name, category, unit, stock_qty, low_stock_threshold, cost_price, sell_price, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, name, category, unit, stock, threshold, cost, sell, now]
      );
    }

    const catalog: [string, "service" | "retail", string, string, number, number | null, "percent" | "fixed" | "none", number, { inventoryItemId: string; qtyPerUnit: number }[] | null][] = [
      ["svc-haircut-basic", "service", "Potong Rambut Basic", "haircut", 45000, 30, "percent", 2500, null],
      ["svc-haircut-premium", "service", "Potong Rambut Premium", "haircut", 85000, 45, "percent", 3000, null],
      ["svc-color-full", "service", "Coloring Full Head", "coloring", 350000, 120, "percent", 2000, [{ inventoryItemId: "inv-color-tube", qtyPerUnit: 120 }]],
      ["svc-spa-creambath", "service", "Creambath Spa", "spa", 120000, 60, "percent", 2500, [{ inventoryItemId: "inv-shampoo-1l", qtyPerUnit: 80 }]],
      ["retail-shampoo-250", "retail", "Shampoo Retail 250ml", "retail-haircare", 65000, null, "percent", 1000, [{ inventoryItemId: "inv-retail-shampoo", qtyPerUnit: 1 }]],
      ["retail-serum-100", "retail", "Hair Serum 100ml", "retail-haircare", 85000, null, "percent", 1000, [{ inventoryItemId: "inv-retail-serum", qtyPerUnit: 1 }]],
    ];
    for (const [id, type, name, category, price, duration, basis, value, consumes] of catalog) {
      await db.runAsync(
        `INSERT OR IGNORE INTO catalog_items (id, type, name, category, price, duration_minutes, commission_basis, commission_value, consumes_json)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, type, name, category, price, duration, basis, value, consumes ? JSON.stringify(consumes) : null]
      );
    }
    // Starter data must not count as a local change: a second device would
    // otherwise push its seed over edits already made on the first device.
    await db.runAsync("DELETE FROM sync_dirty WHERE tbl IN ('catalog_items','inventory')");
  });
}
