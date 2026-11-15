import { useEffect, useState, useCallback } from "react";
import { getDb } from "@/services/database";
import { useCloud } from "@/services/cloudSync";
import type { CatalogItem } from "@/types";

function rowToCatalogItem(row: any): CatalogItem {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    category: row.category,
    price: row.price,
    durationMinutes: row.duration_minutes ?? undefined,
    commissionBasis: row.commission_basis,
    commissionValue: row.commission_value,
    consumes: row.consumes_json ? JSON.parse(row.consumes_json) : undefined,
  };
}

/** Loads the service/retail catalog from SQLite. Catalog rows sync down from
 *  the "Employees"-style Sheets tab the same way Inventory does — see syncQueue
 *  pull op; this hook just reads whatever is currently local. */
export function useCatalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const syncVersion = useCloud((c) => c.version);

  const reload = useCallback(async () => {
    setLoading(true);
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM catalog_items ORDER BY category, name");
    setItems(rows.map(rowToCatalogItem));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload, syncVersion]);

  return { items, loading, reload };
}
