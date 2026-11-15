/** Local tables replicated to the cloud, with their primary-key column. */
export const SYNC_TABLES = {
  employees: "id",
  catalog_items: "id",
  inventory: "item_id",
  transactions: "local_id",
  transaction_items: "id",
  journal_entries: "id",
  bookings: "id",
  promotions: "id",
  members: "id",
  member_point_logs: "id",
} as const;

export type SyncTable = keyof typeof SYNC_TABLES;

export function isSyncTable(name: string): name is SyncTable {
  return Object.prototype.hasOwnProperty.call(SYNC_TABLES, name);
}
