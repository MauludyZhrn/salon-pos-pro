import { getDb, withTransaction } from "./database";
import { enqueueSync } from "./syncQueue";
import { useInventoryStore } from "@/store/inventoryStore";
import { buildJournalEntries, computeCartTotals } from "@/utils/transaction";
import { validateSplitPayment } from "@/utils/money";
import { parseLocalDate } from "@/utils/dateFormat";
import { addDaysToDateString, isValidDateString, localDateString } from "@/utils/promotions";
import type { CartLine, CatalogItem, JournalEntry, LineAdjustment, PaymentLeg, PaymentMethod, Transaction, TransactionStatus } from "@/types";

/** Baca dan koreksi transaksi yang sudah tercatat (Riwayat Transaksi). */

export interface TxSummary {
  localId: string;
  receiptNo: string;
  createdAt: string;
  customerName: string | null;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  editedAt: string | null;
  itemCount: number;
}

export type HistoryPeriod = "today" | "7d" | "30d" | "all" | "custom";

export interface HistoryDateBounds {
  /** Tanggal awal inklusif (YYYY-MM-DD jam lokal) atau null = tanpa batas bawah. */
  fromDate: string | null;
  /** Tanggal akhir inklusif (YYYY-MM-DD jam lokal) atau null = tanpa batas atas. */
  toDate: string | null;
}

export interface HistoryQueryOptions {
  period?: HistoryPeriod;
  fromDate?: string | null;
  toDate?: string | null;
  query?: string;
  limit?: number;
}

export interface HistoryQueryResult {
  rows: TxSummary[];
  totalCount: number;
  paidCount: number;
  paidTotal: number;
  minCreatedAt: string | null;
  maxCreatedAt: string | null;
}

export interface JournalDayTx extends TxSummary {
  itemsPreview: string;
  cashierName: string | null;
  itemUnits: number;
}

export interface DailyJournalDetail {
  date: string;
  transactions: JournalDayTx[];
  standaloneEntries: JournalEntry[];
}

/** Awal periode menurut jam lokal HP, null = tanpa batas. */
export function periodStart(period: HistoryPeriod, now: Date = new Date()): Date | null {
  if (period === "all" || period === "custom") return null;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "7d") d.setDate(d.getDate() - 6);
  if (period === "30d") d.setDate(d.getDate() - 29);
  return d;
}

/** Hitung rentang tanggal inklusif [fromDate, toDate] (YYYY-MM-DD lokal) untuk filter preset dan pergeseran periode. */
export function computePeriodBounds(
  period: Exclude<HistoryPeriod, "custom">,
  windowOffset = 0,
  now: Date = new Date()
): HistoryDateBounds {
  if (period === "all") return { fromDate: null, toDate: null };
  const safeOffset = Math.min(0, Math.trunc(windowOffset));
  const todayStr = localDateString(now);

  if (period === "today") {
    const target = addDaysToDateString(todayStr, safeOffset);
    return { fromDate: target, toDate: target };
  }
  const span = period === "7d" ? 7 : 30;
  const endDate = addDaysToDateString(todayStr, safeOffset * span);
  const startDate = addDaysToDateString(endDate, -(span - 1));
  return { fromDate: startDate, toDate: endDate };
}

function localDayStartIso(yyyyMmDd: string): string | null {
  const dt = parseLocalDate(yyyyMmDd);
  return dt ? dt.toISOString() : null;
}

function localDayEndExclusiveIso(yyyyMmDd: string): string | null {
  const dt = parseLocalDate(yyyyMmDd);
  if (!dt) return null;
  dt.setDate(dt.getDate() + 1);
  return dt.toISOString();
}

function mapTxSummary(r: any): TxSummary {
  return {
    localId: r.local_id,
    receiptNo: r.receipt_no,
    createdAt: r.created_at,
    customerName: r.customer_name ?? null,
    grandTotal: r.grand_total,
    paymentMethod: r.payment_method,
    status: r.status,
    editedAt: r.edited_at ?? null,
    itemCount: r.item_count ?? 0,
  };
}

/** Query transaksi beserta total agregat dan rentang tanggal aktual sesuai batas filter. */
export async function queryTransactions(opts: HistoryQueryOptions): Promise<HistoryQueryResult> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];

  const hasExplicitBounds = opts.fromDate !== undefined || opts.toDate !== undefined;
  if (hasExplicitBounds) {
    if (opts.fromDate && isValidDateString(opts.fromDate)) {
      const startIso = localDayStartIso(opts.fromDate);
      if (startIso) {
        where.push("t.created_at >= ?");
        params.push(startIso);
      }
    }
    if (opts.toDate && isValidDateString(opts.toDate)) {
      const endIso = localDayEndExclusiveIso(opts.toDate);
      if (endIso) {
        where.push("t.created_at < ?");
        params.push(endIso);
      }
    }
  } else if (opts.period) {
    const start = periodStart(opts.period);
    if (start) {
      where.push("t.created_at >= ?");
      params.push(start.toISOString());
    }
  }

  const q = opts.query?.trim();
  if (q) {
    where.push("(t.receipt_no LIKE ? OR COALESCE(t.customer_name, '') LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = opts.limit ?? 300;

  const rows = await db.getAllAsync<any>(
    `SELECT t.local_id, t.receipt_no, t.created_at, t.customer_name, t.grand_total, t.payment_method, t.status, t.edited_at,
            (SELECT COUNT(*) FROM transaction_items i WHERE i.transaction_local_id = t.local_id) AS item_count
       FROM transactions t
      ${whereSql}
      ORDER BY t.created_at DESC
      LIMIT ?`,
    [...params, limit]
  );

  const meta = await db.getFirstAsync<{
    total_count: number;
    paid_count: number | null;
    paid_total: number | null;
    min_created_at: string | null;
    max_created_at: string | null;
  }>(
    `SELECT COUNT(*) AS total_count,
            SUM(CASE WHEN t.status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
            COALESCE(SUM(CASE WHEN t.status = 'paid' THEN t.grand_total ELSE 0 END), 0) AS paid_total,
            MIN(t.created_at) AS min_created_at,
            MAX(t.created_at) AS max_created_at
       FROM transactions t
      ${whereSql}`,
    params
  );

  return {
    rows: rows.map(mapTxSummary),
    totalCount: Number(meta?.total_count) || 0,
    paidCount: Number(meta?.paid_count) || 0,
    paidTotal: Number(meta?.paid_total) || 0,
    minCreatedAt: meta?.min_created_at ?? null,
    maxCreatedAt: meta?.max_created_at ?? null,
  };
}

export async function listTransactions(opts: HistoryQueryOptions): Promise<TxSummary[]> {
  const res = await queryTransactions(opts);
  return res.rows;
}

/** Muat daftar transaksi & catatan jurnal non-transaksi untuk satu tanggal pada Jurnal Operasional Harian. */
export async function listTransactionsForJournalDate(date: string): Promise<DailyJournalDetail> {
  const db = await getDb();
  const txRows = await db.getAllAsync<any>(
    `SELECT t.local_id, t.receipt_no, t.created_at, t.customer_name, t.grand_total, t.payment_method,
            t.status, t.edited_at, e.name AS cashier_name
       FROM transactions t
       LEFT JOIN employees e ON e.id = t.cashier_id
      WHERE EXISTS (SELECT 1 FROM journal_entries j WHERE j.transaction_local_id = t.local_id AND j.date = ?)
         OR substr(t.created_at, 1, 10) = ?
      ORDER BY t.created_at DESC`,
    [date, date]
  );

  const itemRows = await db.getAllAsync<{ transaction_local_id: string; item_name: string; qty: number }>(
    `SELECT i.transaction_local_id, i.item_name, i.qty
       FROM transaction_items i
      WHERE i.transaction_local_id IN (
        SELECT t.local_id
          FROM transactions t
         WHERE EXISTS (SELECT 1 FROM journal_entries j WHERE j.transaction_local_id = t.local_id AND j.date = ?)
            OR substr(t.created_at, 1, 10) = ?
      )
      ORDER BY i.rowid`,
    [date, date]
  );

  const itemsByTx = new Map<string, { labels: string[]; count: number; units: number }>();
  for (const item of itemRows) {
    const bucket = itemsByTx.get(item.transaction_local_id) ?? { labels: [], count: 0, units: 0 };
    const qty = Number(item.qty) || 1;
    bucket.labels.push(qty > 1 ? `${item.item_name} ×${qty}` : item.item_name);
    bucket.count += 1;
    bucket.units += qty;
    itemsByTx.set(item.transaction_local_id, bucket);
  }

  const transactions: JournalDayTx[] = txRows.map((r) => {
    const bucket = itemsByTx.get(r.local_id);
    const labels = bucket?.labels ?? [];
    const itemsPreview =
      labels.length === 0
        ? "Tanpa item"
        : labels.length <= 2
          ? labels.join(", ")
          : `${labels.slice(0, 2).join(", ")} +${labels.length - 2} lainnya`;
    return {
      ...mapTxSummary({ ...r, item_count: bucket?.count ?? 0 }),
      itemsPreview,
      cashierName: r.cashier_name ?? null,
      itemUnits: bucket?.units ?? 0,
    };
  });

  const standaloneRows = await db.getAllAsync<any>(
    `SELECT *
       FROM journal_entries j
      WHERE j.date = ?
        AND (j.transaction_local_id IS NULL
             OR j.transaction_local_id = ''
             OR NOT EXISTS (SELECT 1 FROM transactions t WHERE t.local_id = j.transaction_local_id))
      ORDER BY j.created_at DESC`,
    [date]
  );

  const standaloneEntries: JournalEntry[] = standaloneRows.map((row) => ({
    id: row.id,
    transactionLocalId: row.transaction_local_id ?? null,
    date: row.date,
    account: row.account,
    direction: row.direction,
    amount: row.amount,
    memo: row.memo,
    createdAt: row.created_at,
  }));

  return { date, transactions, standaloneEntries };
}

function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function rowToLine(r: any): CartLine {
  const item: CatalogItem = {
    id: r.item_id,
    type: r.item_type,
    name: r.item_name,
    category: "",
    price: r.unit_price,
    commissionBasis: r.commission_basis,
    commissionValue: r.commission_value,
  };
  let adjustments = parseJson<LineAdjustment[]>(r.adjustments_json, []);
  const discount: number = r.line_discount ?? 0;
  const extra: number = r.line_extra ?? 0;
  // Data lama tanpa rincian: simpan sebagai koreksi manual supaya total tidak hilang saat diedit.
  if (adjustments.length === 0) {
    if (discount > 0) adjustments.push({ promoId: "manual", name: "Diskon", kind: "discount", valueType: "flat", value: discount, amount: discount });
    if (extra > 0) adjustments.push({ promoId: "manual", name: "Biaya tambahan", kind: "additional", valueType: "flat", value: extra, amount: extra });
  }
  return {
    lineId: r.id,
    item,
    qty: r.qty,
    stylistId: r.stylist_id ?? null,
    lineDiscount: discount,
    lineExtra: extra,
    adjustments,
    lineTotal: r.line_total,
    commissionAmount: r.commission_amount,
  };
}

export async function loadTransaction(localId: string): Promise<Transaction | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>("SELECT * FROM transactions WHERE local_id = ?", [localId]);
  if (!row) return null;
  const items = await db.getAllAsync<any>("SELECT * FROM transaction_items WHERE transaction_local_id = ? ORDER BY rowid", [localId]);
  return {
    localId: row.local_id,
    receiptNo: row.receipt_no,
    outletId: row.outlet_id,
    cashierId: row.cashier_id,
    customerName: row.customer_name ?? null,
    lines: items.map(rowToLine),
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    extraTotal: row.extra_total ?? 0,
    taxTotal: row.tax_total,
    grandTotal: row.grand_total,
    paymentMethod: row.payment_method,
    paymentBreakdown: parseJson<PaymentLeg[]>(row.payment_breakdown_json, []),
    status: row.status,
    midtransOrderId: row.midtrans_order_id ?? null,
    createdAt: row.created_at,
    syncedAt: row.synced_at ?? null,
    editedAt: row.edited_at ?? null,
    memberId: row.member_id ?? null,
    pointsEarned: Number(row.points_earned) || 0,
    pointsRedeemed: Number(row.points_redeemed) || 0,
  };
}

export interface TransactionEdit {
  customerName: string | null;
  paymentMethod: PaymentMethod;
  paymentBreakdown: PaymentLeg[];
  /** Baris akhir setelah koreksi. Baris yang tidak ada di sini dianggap dihapus. */
  lines: CartLine[];
}

async function consumesOf(itemId: string): Promise<CatalogItem["consumes"]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ consumes_json: string | null }>("SELECT consumes_json FROM catalog_items WHERE id = ?", [itemId]);
  return parseJson<CatalogItem["consumes"]>(row?.consumes_json, undefined);
}

/**
 * Menyimpan koreksi transaksi: total, komisi, jurnal keuangan dan stok dihitung ulang.
 * Nomor struk dan waktu transaksi tidak berubah. Hanya transaksi lunas yang bisa dikoreksi.
 */
export async function updateTransaction(original: Transaction, edit: TransactionEdit): Promise<Transaction> {
  if (original.status !== "paid") throw new Error("Hanya transaksi lunas yang bisa diedit");
  if (edit.lines.length === 0) throw new Error("Transaksi harus punya minimal satu item");

  const totals = computeCartTotals(edit.lines);
  if (edit.paymentMethod === "split") {
    validateSplitPayment(edit.paymentBreakdown as any, totals.grandTotal);
  } else {
    const sum = edit.paymentBreakdown.reduce((s, l) => s + l.amount, 0);
    if (sum !== totals.grandTotal) throw new Error(`Nominal pembayaran (${sum}) tidak sama dengan total (${totals.grandTotal})`);
  }

  const editedAt = new Date().toISOString();
  const updated: Transaction = {
    ...original,
    customerName: edit.customerName,
    lines: edit.lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    extraTotal: totals.extraTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    paymentMethod: edit.paymentMethod,
    paymentBreakdown: edit.paymentBreakdown,
    editedAt,
  };
  const journalEntries = buildJournalEntries(updated);

  // Selisih jumlah per baris menentukan stok bahan yang dikurangi atau dikembalikan.
  const deduct: { consumes: CatalogItem["consumes"]; qty: number }[] = [];
  const restock: { consumes: CatalogItem["consumes"]; qty: number }[] = [];
  for (const old of original.lines) {
    const now = edit.lines.find((l) => l.lineId === old.lineId);
    const diff = (now?.qty ?? 0) - old.qty;
    if (diff === 0) continue;
    const consumes = await consumesOf(old.item.id);
    if (!consumes || consumes.length === 0) continue;
    if (diff > 0) deduct.push({ consumes, qty: diff });
    else restock.push({ consumes, qty: -diff });
  }

  await withTransaction(async (db) => {
    await db.runAsync(
      `UPDATE transactions
          SET customer_name = ?, subtotal = ?, discount_total = ?, extra_total = ?, tax_total = ?, grand_total = ?,
              payment_method = ?, payment_breakdown_json = ?, edited_at = ?
        WHERE local_id = ?`,
      [
        updated.customerName,
        updated.subtotal,
        updated.discountTotal,
        updated.extraTotal,
        updated.taxTotal,
        updated.grandTotal,
        updated.paymentMethod,
        JSON.stringify(updated.paymentBreakdown),
        editedAt,
        updated.localId,
      ]
    );

    const keep = new Set(edit.lines.map((l) => l.lineId));
    for (const old of original.lines) {
      if (!keep.has(old.lineId)) await db.runAsync("DELETE FROM transaction_items WHERE id = ?", [old.lineId]);
    }
    for (const line of edit.lines) {
      await db.runAsync(
        `UPDATE transaction_items
            SET qty = ?, line_discount = ?, line_extra = ?, adjustments_json = ?, line_total = ?, stylist_id = ?, commission_amount = ?
          WHERE id = ?`,
        [
          line.qty,
          line.lineDiscount,
          line.lineExtra,
          line.adjustments.length > 0 ? JSON.stringify(line.adjustments) : null,
          line.lineTotal,
          line.stylistId,
          line.commissionAmount,
          line.lineId,
        ]
      );
    }

    await db.runAsync("DELETE FROM journal_entries WHERE transaction_local_id = ?", [updated.localId]);
    for (const e of journalEntries) {
      await db.runAsync(
        `INSERT INTO journal_entries (id, transaction_local_id, date, account, direction, amount, memo, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [e.id, e.transactionLocalId, e.date, e.account, e.direction, e.amount, e.memo, e.createdAt]
      );
    }
  });

  // Stok disesuaikan setelah transaksi tersimpan, sama seperti saat penjualan.
  const inv = useInventoryStore.getState();
  if (restock.length > 0) await inv.restockForVoidedSale(restock);
  if (deduct.length > 0) await inv.autoDeductForSale(deduct);

  enqueueSync("Transactions", updated.localId, updated);
  return updated;
}

