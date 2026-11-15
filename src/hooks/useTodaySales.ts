import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getDb } from "@/services/database";
import { useCloud } from "@/services/cloudSync";

/** Paid transactions since local midnight. Re-reads whenever the screen regains focus. */
export function useTodaySales() {
  const [data, setData] = useState({ count: 0, total: 0 });
  const syncVersion = useCloud((c) => c.version);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const db = await getDb();
        const row = await db.getFirstAsync<{ cnt: number; total: number }>(
          "SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total FROM transactions WHERE status = 'paid' AND created_at >= ? AND created_at < ?",
          [start.toISOString(), end.toISOString()]
        );
        if (alive) setData({ count: row?.cnt ?? 0, total: row?.total ?? 0 });
      })();
      return () => {
        alive = false;
      };
    }, [syncVersion])
  );

  return data;
}
