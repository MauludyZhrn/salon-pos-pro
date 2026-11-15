import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getDb } from "@/services/database";
import { useCloud } from "@/services/cloudSync";

export interface Stylist {
  id: string;
  name: string;
}

/** Active stylists (the owner/admin can also take bookings) from the employees table. Re-reads whenever the screen regains focus. */
export function useStylists() {
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const syncVersion = useCloud((c) => c.version);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const db = await getDb();
        const rows = await db.getAllAsync<Stylist>(
          "SELECT id, name FROM employees WHERE role IN ('stylist','admin') AND active = 1 ORDER BY name"
        );
        if (alive) setStylists(rows);
      })();
      return () => {
        alive = false;
      };
    }, [syncVersion])
  );

  return stylists;
}
