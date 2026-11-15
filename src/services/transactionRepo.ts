import { getDb, withTransaction } from "./database";
import { enqueueSync } from "./syncQueue";
import { useInventoryStore } from "@/store/inventoryStore";
import { buildJournalEntries, computeCartTotals } from "@/utils/transaction";
import { validateSplitPayment } from "@/utils/money";
import type { CartLine, CatalogItem, LineAdjustment, PaymentLeg, PaymentMethod, Transaction, TransactionStatus } from "@/types";

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

export type HistoryPeriod = "today" | "7d" | "30d" | "all";

/** Awal periode menurut jam lokal HP, null = tanpa batas. */
export function periodStart(period: HistoryPeriod, now: Date = new Date()): Date | null {
  if (period === "all") return null;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "7d") d.setDate(d.getDate() - 6);
  if (period === "30d") d.setDate(d.getDate() - 29);
  return d;
}

export async function listTransactions(opts: { period: HistoryPeriod; query?: string; limit?: number }): Promise<TxSummary[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];

  const start = periodStart(opts.period);
  if (start) {
    where.push("t.created_at >= ?");
    params.push(start.toISOString());
  }
  const q = opts.query?.trim();
  if (q) {
    where.push("(t.receipt_no LIKE ? OR COALESCE(t.customer_name, '') LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  params.push(opts.limit ?? 300);

  const rows = await db.getAllAsync<any>(
    `SELECT t.local_id, t.receipt_no, t.created_at, t.customer_name, t.grand_total, t.payment_method, t.status, t.edited_at,
            (SELECT COUNT(*) FROM transaction_items i WHERE i.transaction_local_id = t.local_id) AS item_count
       FROM transactions t
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.created_at DESC
      LIMIT ?`,
    params
  );

  return rows.map((r) => ({
    localId: r.local_id,
    receiptNo: r.receipt_no,
    createdAt: r.created_at,
    customerName: r.customer_name ?? null,
    grandTotal: r.grand_total,
    paymentMethod: r.payment_method,
    status: r.status,
    editedAt: r.edited_at ?? null,
    itemCount: r.item_count ?? 0,
  }));
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

