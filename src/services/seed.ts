import { getDb } from "./database";

/**
 * Dev/demo seed: one employee of each role (PIN "1111" for all — hash
 * matches the DJB2-style hashPin in authStore.ts), a starter catalog with
 * BOM links into inventory, and inventory rows with a low-stock example.
 * Safe to call repeatedly — uses INSERT OR IGNORE.
 */
export async function seedIfEmpty(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM employees");
  if (row && row.cnt > 0) return;

  const PIN_HASH_1111 = await hashPinLocal("1111");
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO employees (id, name, role, pin_hash, default_commission_basis, default_commission_value, active)
       VALUES (?,?,?,?,?,?,1)`,
      ["admin-1", "Zahra (Owner)", "admin", PIN_HASH_1111, "percent", 0]
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO employees (id, name, role, pin_hash, default_commission_basis, default_commission_value, active)
       VALUES (?,?,?,?,?,?,1)`,
      ["kasir-1", "Sari", "kasir", PIN_HASH_1111, "percent", 0]
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO employees (id, name, role, pin_hash, default_commission_basis, default_commission_value, active)
       VALUES (?,?,?,?,?,?,1)`,
      ["stylist-1", "Rani", "stylist", PIN_HASH_1111, "percent", 3000]
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO employees (id, name, role, pin_hash, default_commission_basis, default_commission_value, active)
       VALUES (?,?,?,?,?,?,1)`,
      ["stylist-2", "Dimas", "stylist", PIN_HASH_1111, "fixed", 25000]
    );

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
  });
}

// Mirrors authStore.hashPin exactly — kept in sync manually since it's a
// throwaway dev hash (see README "Security hardening" to replace both with
// expo-crypto SHA-256 in one pass).
async function hashPinLocal(pin: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = (hash << 5) - hash + pin.charCodeAt(i);
    hash |= 0;
  }
  return `v1:${hash}`;
}
