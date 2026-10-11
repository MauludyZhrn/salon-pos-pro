import { create } from "zustand";
import { getDb, withTransaction } from "@/services/database";
import { enqueueSync } from "@/services/syncQueue";
import { useInventoryStore } from "./inventoryStore";
import {
  buildCartLine,
  buildJournalEntries,
  computeCartTotals,
  nextReceiptNumber,
} from "@/utils/transaction";
import { validateSplitPayment, type Rupiah } from "@/utils/money";
import type {
  CartLine,
  CatalogItem,
  PaymentLeg,
  PaymentMethod,
  Transaction,
} from "@/types";

interface PosState {
  lines: CartLine[];
  customerName: string | null;
  outletId: string;
  cashierId: string;
  addItem: (item: CatalogItem, stylistId: string | null, qty?: number, lineDiscount?: Rupiah) => void;
  removeLine: (lineId: string) => void;
  updateLineQty: (lineId: string, qty: number) => void;
  setCustomerName: (name: string | null) => void;
  clearCart: () => void;
  totals: () => ReturnType<typeof computeCartTotals>;
  checkout: (params: { paymentMethod: PaymentMethod; paymentBreakdown: PaymentLeg[]; midtransOrderId?: string }) => Promise<Transaction>;
  voidTransaction: (localId: string, reason: string) => Promise<void>;
}

async function getTodaySequence(db: Awaited<ReturnType<typeof getDb>>): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM transactions WHERE created_at LIKE ?",
    [`${today}%`]
  );
  return (row?.cnt ?? 0) + 1;
}

export const usePosStore = create<PosState>((set, get) => ({
  lines: [],
  customerName: null,
  outletId: "outlet-main",
  cashierId: "",

  addItem(item, stylistId, qty = 1, lineDiscount = 0) {
    const line = buildCartLine(item, qty, stylistId, lineDiscount);
    set((state) => ({ lines: [...state.lines, line] }));
  },

  removeLine(lineId) {
    set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) }));
  },

  updateLineQty(lineId, qty) {
    set((state) => ({
      lines: state.lines.map((l) =>
        l.lineId === lineId ? buildCartLine(l.item, qty, l.stylistId, l.lineDiscount) : l
      ),
    }));
  },

  setCustomerName(name) {
    set({ customerName: name });
  },

  clearCart() {
    set({ lines: [], customerName: null });
  },

  totals() {
    return computeCartTotals(get().lines);
  },

  async checkout({ paymentMethod, paymentBreakdown, midtransOrderId }) {
    const { lines, customerName, outletId, cashierId } = get();
    if (lines.length === 0) throw new Error("Keranjang kosong");

    const totals = computeCartTotals(lines);

    if (paymentMethod === "split") {
      validateSplitPayment(paymentBreakdown, totals.grandTotal);
    } else {
      const sum = paymentBreakdown.reduce((s, l) => s + l.amount, 0);
      if (sum !== totals.grandTotal) {
        throw new Error(`Nominal pembayaran (${sum}) tidak sama dengan total (${totals.grandTotal})`);
      }
    }

    const db = await getDb();
    const seq = await getTodaySequence(db);
    const receiptNo = nextReceiptNumber(seq);
    const localId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const tx: Transaction = {
      localId,
      receiptNo,
      outletId,
      cashierId,
      customerName,
      lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      paymentMethod,
      paymentBreakdown,
      status: "paid",
      midtransOrderId: midtransOrderId ?? null,
      createdAt,
      syncedAt: null,
    };

    const journalEntries = buildJournalEntries(tx);

    await withTransaction(async (database) => {
      await database.runAsync(
        `INSERT INTO transactions
         (local_id, receipt_no, outlet_id, cashier_id, customer_name, subtotal, discount_total, tax_total,
          grand_total, payment_method, payment_breakdown_json, status, midtrans_order_id, created_at, synced_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
        [
          tx.localId,
          tx.receiptNo,
          tx.outletId,
          tx.cashierId,
          tx.customerName,
          tx.subtotal,
          tx.discountTotal,
          tx.taxTotal,
          tx.grandTotal,
          tx.paymentMethod,
          JSON.stringify(tx.paymentBreakdown),
          tx.status,
          tx.midtransOrderId,
          tx.createdAt,
        ]
      );

      for (const line of lines) {
        await database.runAsync(
          `INSERT INTO transaction_items
           (id, transaction_local_id, item_type, item_id, item_name, qty, unit_price, line_discount,
            line_total, stylist_id, commission_basis, commission_value, commission_amount)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            line.lineId,
            localId,
            line.item.type,
            line.item.id,
            line.item.name,
            line.qty,
            line.item.price,
            line.lineDiscount,
            line.lineTotal,
            line.stylistId,
            line.item.commissionBasis,
            line.item.commissionValue,
            line.commissionAmount,
          ]
        );
      }

      for (const entry of journalEntries) {
        await database.runAsync(
          `INSERT INTO journal_entries (id, transaction_local_id, date, account, direction, amount, memo, created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          [entry.id, entry.transactionLocalId, entry.date, entry.account, entry.direction, entry.amount, entry.memo, entry.createdAt]
        );
      }
    });

    // Inventory auto-deduct runs after the sale commits (its own tx) so a stock
    // conflict never blocks the sale itself; failures surface as a low-stock
    // alert rather than a lost sale.
    await useInventoryStore.getState().autoDeductForSale(
      lines.map((l) => ({ consumes: l.item.consumes, qty: l.qty }))
    );

    enqueueSync("Transactions", localId, tx);
    enqueueSync("TransactionItems", localId, lines);
    enqueueSync(
      "JournalEntries",
      localId,
      journalEntries
    );

    set({ lines: [], customerName: null });
    return tx;
  },

  async voidTransaction(localId, reason) {
    const db = await getDb();
    const txRow = await db.getFirstAsync<any>("SELECT * FROM transactions WHERE local_id = ?", [localId]);
    if (!txRow) throw new Error("Transaksi tidak ditemukan");
    const itemRows = await db.getAllAsync<any>(
      "SELECT * FROM transaction_items WHERE transaction_local_id = ?",
      [localId]
    );

    await db.runAsync("UPDATE transactions SET status = 'void' WHERE local_id = ?", [localId]);

    await useInventoryStore.getState().restockForVoidedSale(
      itemRows.map((r) => ({ qty: r.qty, consumes: undefined })) // BOM re-lookup from catalog happens in a fuller impl
    );

    const reversalEntry = {
      id: crypto.randomUUID(),
      transactionLocalId: localId,
      date: new Date().toISOString().slice(0, 10),
      account: "kas" as const,
      direction: "kredit" as const,
      amount: txRow.grand_total,
      memo: `Void ${txRow.receipt_no}: ${reason}`,
      createdAt: new Date().toISOString(),
    };
    await db.runAsync(
      `INSERT INTO journal_entries (id, transaction_local_id, date, account, direction, amount, memo, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        reversalEntry.id,
        reversalEntry.transactionLocalId,
        reversalEntry.date,
        reversalEntry.account,
        reversalEntry.direction,
        reversalEntry.amount,
        reversalEntry.memo,
        reversalEntry.createdAt,
      ]
    );

    enqueueSync("Transactions", localId, { localId, status: "void" });
    enqueueSync("JournalEntries", localId, [reversalEntry]);
  },
}));
