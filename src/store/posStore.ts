import { useMemo } from "react";
import { create } from "zustand";
import { getDb, withTransaction } from "@/services/database";
import { enqueueSync } from "@/services/syncQueue";
import { newId } from "@/utils/id";
import { useInventoryStore } from "./inventoryStore";
import { usePromoStore } from "./promoStore";
import { useMemberStore } from "./memberStore";
import {
  buildCartLine,
  buildJournalEntries,
  computeCartTotals,
  nextReceiptNumber,
  rebuildCartLine,
} from "@/utils/transaction";
import { rulesForItem } from "@/utils/promotions";
import {
  calcCheckoutMemberPoints,
  canRedeemFreeTreatment,
  countCartTreatments,
  MEMBER_FREE_PROMO_ID,
  withMemberFreeAdjustment,
} from "@/utils/membership";
import { validateSplitPayment } from "@/utils/money";
import type {
  CartLine,
  CatalogItem,
  JournalEntry,
  Member,
  PaymentLeg,
  PaymentMethod,
  Transaction,
} from "@/types";

interface PosState {
  lines: CartLine[];
  customerName: string | null;
  memberId: string | null;
  /** lineId layanan yang dipilih untuk ditukar 1x Gratis Treatment (-100 poin). */
  redeemFreeLineId: string | null;
  outletId: string;
  cashierId: string;
  /** Item yang sama (dan stylist yang sama) digabung jadi satu baris, jumlahnya bertambah. */
  addItem: (item: CatalogItem, stylistId: string | null, qty?: number) => void;
  removeLine: (lineId: string) => void;
  updateLineQty: (lineId: string, qty: number) => void;
  setLineStylist: (lineId: string, stylistId: string | null) => void;
  setCustomerName: (name: string | null) => void;
  setMember: (member: Member | null) => void;
  setRedeemFreeLine: (lineId: string | null) => void;
  clearCart: () => void;
  totals: () => ReturnType<typeof computeCartTotals>;
  checkout: (params: { paymentMethod: PaymentMethod; paymentBreakdown: PaymentLeg[]; midtransOrderId?: string }) => Promise<Transaction>;
  voidTransaction: (localId: string, reason: string) => Promise<void>;
}

/** Sinkronkan potongan 1x Gratis Treatment Member pada baris keranjang. */
function syncFreeTreatmentLines(
  lines: CartLine[],
  memberId: string | null,
  desiredRedeemLineId: string | null
): { lines: CartLine[]; redeemFreeLineId: string | null } {
  const member = memberId ? useMemberStore.getState().members.find((m) => m.id === memberId) : null;
  const memberPoints = member?.points ?? 0;
  const totalServiceQty = countCartTreatments(lines);
  const canRedeem = Boolean(
    member &&
      desiredRedeemLineId &&
      lines.some((l) => l.lineId === desiredRedeemLineId && l.item.type === "service") &&
      canRedeemFreeTreatment(memberPoints, totalServiceQty)
  );
  const activeRedeemLineId = canRedeem ? desiredRedeemLineId : null;

  const updatedLines = lines.map((line) => {
    const currentRules = line.adjustments.map(({ amount: _a, ...rule }) => rule);
    const hasFreeRule = currentRules.some((r) => r.promoId === MEMBER_FREE_PROMO_ID);
    const shouldHaveFreeRule = line.lineId === activeRedeemLineId && line.item.type === "service";
    if (hasFreeRule === shouldHaveFreeRule) return line;
    const nextRules = withMemberFreeAdjustment(currentRules, line.item.price, shouldHaveFreeRule);
    return rebuildCartLine(line, { rules: nextRules });
  });

  return { lines: updatedLines, redeemFreeLineId: activeRedeemLineId };
}

function receiptPrefix(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `SAL-${y}${m}${d}-`;
}

/**
 * Nomor urut berikutnya = nomor tertinggi yang sudah terpakai hari ini + 1 (dibaca dari nomor struk,
 * bukan jumlah baris), memakai tanggal lokal yang sama dengan nomor struk. `attempt` menggeser nomor
 * saat percobaan sebelumnya bentrok.
 */
async function nextSequence(db: Awaited<ReturnType<typeof getDb>>, attempt: number): Promise<number> {
  const prefix = receiptPrefix();
  const rows = await db.getAllAsync<{ receipt_no: string }>("SELECT receipt_no FROM transactions WHERE receipt_no LIKE ?", [`${prefix}%`]);
  let max = 0;
  for (const r of rows) {
    const n = Number(r.receipt_no.slice(prefix.length, prefix.length + 5));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1 + attempt;
}

function isReceiptClash(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed: transactions\.receipt_no/.test(msg);
}

async function insertSale(tx: Transaction, journalEntries: JournalEntry[], paidTreatmentsCount: number) {
  await withTransaction(async (database) => {
    await database.runAsync(
      `INSERT INTO transactions
       (local_id, receipt_no, outlet_id, cashier_id, customer_name, member_id, points_earned, points_redeemed,
        subtotal, discount_total, extra_total, tax_total, grand_total, payment_method, payment_breakdown_json,
        status, midtrans_order_id, created_at, synced_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      [
        tx.localId,
        tx.receiptNo,
        tx.outletId,
        tx.cashierId,
        tx.customerName,
        tx.memberId ?? null,
        tx.pointsEarned ?? 0,
        tx.pointsRedeemed ?? 0,
        tx.subtotal,
        tx.discountTotal,
        tx.extraTotal,
        tx.taxTotal,
        tx.grandTotal,
        tx.paymentMethod,
        JSON.stringify(tx.paymentBreakdown),
        tx.status,
        tx.midtransOrderId,
        tx.createdAt,
      ]
    );

    for (const line of tx.lines) {
      await database.runAsync(
        `INSERT INTO transaction_items
         (id, transaction_local_id, item_type, item_id, item_name, qty, unit_price, line_discount,
          line_extra, adjustments_json, line_total, stylist_id, commission_basis, commission_value, commission_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          line.lineId,
          tx.localId,
          line.item.type,
          line.item.id,
          line.item.name,
          line.qty,
          line.item.price,
          line.lineDiscount,
          line.lineExtra,
          line.adjustments.length > 0 ? JSON.stringify(line.adjustments) : null,
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

    if (tx.memberId) {
      const earned = tx.pointsEarned ?? 0;
      const redeemed = tx.pointsRedeemed ?? 0;
      const redeemedCount = redeemed > 0 ? 1 : 0;

      await database.runAsync(
        `UPDATE members
            SET points = MAX(0, points + ? - ?),
                total_treatments = total_treatments + ?,
                total_redeemed = total_redeemed + ?,
                updated_at = ?
          WHERE id = ?`,
        [earned, redeemed, paidTreatmentsCount, redeemedCount, tx.createdAt, tx.memberId]
      );

      if (redeemed > 0) {
        await database.runAsync(
          `INSERT INTO member_point_logs (id, member_id, transaction_local_id, type, points_delta, treatments_count, note, created_at)
           VALUES (?,?,?,'redeem',?,1,?,?)`,
          [newId(), tx.memberId, tx.localId, -redeemed, `Klaim Gratis 1x Treatment (${tx.receiptNo})`, tx.createdAt]
        );
      }

      if (earned > 0) {
        await database.runAsync(
          `INSERT INTO member_point_logs (id, member_id, transaction_local_id, type, points_delta, treatments_count, note, created_at)
           VALUES (?,?,?,'earn',?,?,?,?)`,
          [newId(), tx.memberId, tx.localId, earned, paidTreatmentsCount, `${paidTreatmentsCount}x Treatment (${tx.receiptNo})`, tx.createdAt]
        );
      }
    }
  });
}

export const usePosStore = create<PosState>((set, get) => ({
  lines: [],
  customerName: null,
  memberId: null,
  redeemFreeLineId: null,
  outletId: "outlet-main",
  cashierId: "",

  addItem(item, stylistId, qty = 1) {
    if (!Number.isInteger(qty) || qty < 1) return;
    set((state) => {
      const existing = state.lines.find((l) => l.item.id === item.id && l.stylistId === stylistId);
      let nextLines: CartLine[];
      if (existing) {
        nextLines = state.lines.map((l) => (l.lineId === existing.lineId ? rebuildCartLine(l, { qty: l.qty + qty }) : l));
      } else {
        // Promo yang sedang berlaku disalin ke baris, jadi perubahan promo nanti tidak mengubah keranjang yang sudah jalan.
        const rules = rulesForItem(item, usePromoStore.getState().promos);
        nextLines = [...state.lines, buildCartLine(item, qty, stylistId, rules)];
      }
      return syncFreeTreatmentLines(nextLines, state.memberId, state.redeemFreeLineId);
    });
  },

  removeLine(lineId) {
    set((state) => {
      const nextLines = state.lines.filter((l) => l.lineId !== lineId);
      const nextRedeem = state.redeemFreeLineId === lineId ? null : state.redeemFreeLineId;
      return syncFreeTreatmentLines(nextLines, state.memberId, nextRedeem);
    });
  },

  updateLineQty(lineId, qty) {
    if (!Number.isInteger(qty) || qty < 1) return;
    set((state) => {
      const nextLines = state.lines.map((l) => (l.lineId === lineId ? rebuildCartLine(l, { qty }) : l));
      return syncFreeTreatmentLines(nextLines, state.memberId, state.redeemFreeLineId);
    });
  },

  setLineStylist(lineId, stylistId) {
    set((state) => ({
      lines: state.lines.map((l) => (l.lineId === lineId ? rebuildCartLine(l, { stylistId }) : l)),
    }));
  },

  setCustomerName(name) {
    set((state) => ({
      customerName: name,
      // Jika kasir menghapus nama sementara member terpilih, lepas tautan member.
      ...(state.memberId && !name ? syncFreeTreatmentLines(state.lines, null, null) : {}),
      ...(state.memberId && !name ? { memberId: null } : {}),
    }));
  },

  setMember(member) {
    set((state) => {
      if (!member) {
        const synced = syncFreeTreatmentLines(state.lines, null, null);
        return {
          ...synced,
          memberId: null,
          customerName: null,
        };
      }
      const synced = syncFreeTreatmentLines(state.lines, member.id, state.redeemFreeLineId);
      return {
        ...synced,
        memberId: member.id,
        customerName: member.name,
      };
    });
  },

  setRedeemFreeLine(lineId) {
    set((state) => syncFreeTreatmentLines(state.lines, state.memberId, lineId));
  },

  clearCart() {
    set({ lines: [], customerName: null, memberId: null, redeemFreeLineId: null });
  },

  totals() {
    return computeCartTotals(get().lines);
  },

  async checkout({ paymentMethod, paymentBreakdown, midtransOrderId }) {
    const { lines, customerName, memberId, redeemFreeLineId, outletId, cashierId } = get();
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
    let paidTreatmentsCount = 0;
    let pointsEarned = 0;
    let pointsRedeemed = 0;

    if (memberId) {
      const memberRow = await db.getFirstAsync<{ points: number }>("SELECT points FROM members WHERE id = ?", [memberId]);
      const currentPoints = Number(memberRow?.points) || 0;
      const calc = calcCheckoutMemberPoints(lines, redeemFreeLineId, currentPoints);
      paidTreatmentsCount = calc.paidTreatmentsCount;
      pointsEarned = calc.pointsEarned;
      pointsRedeemed = calc.pointsRedeemed;
    }

    const localId = newId();
    const createdAt = new Date().toISOString();
    let tx!: Transaction;
    let journalEntries: JournalEntry[] = [];

    // Nomor struk bisa bentrok (mis. data dari HP lain yang baru tersinkron). Bila bentrok, coba nomor berikutnya;
    // penyimpanan yang gagal di-rollback penuh, jadi aman diulang.
    for (let attempt = 0; ; attempt++) {
      const receiptNo = nextReceiptNumber(await nextSequence(db, attempt));
      tx = {
        localId,
        receiptNo,
        outletId,
        cashierId,
        customerName,
        memberId: memberId ?? null,
        pointsEarned,
        pointsRedeemed,
        lines,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        extraTotal: totals.extraTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        paymentMethod,
        paymentBreakdown,
        status: "paid",
        midtransOrderId: midtransOrderId ?? null,
        createdAt,
        syncedAt: null,
      };
      journalEntries = buildJournalEntries(tx);
      try {
        await insertSale(tx, journalEntries, paidTreatmentsCount);
        break;
      } catch (err) {
        if (attempt < 4 && isReceiptClash(err)) continue;
        throw err;
      }
    }

    if (memberId) {
      await useMemberStore.getState().load();
    }

    // Inventory auto-deduct runs after the sale commits (its own tx) so a stock
    // conflict never blocks the sale itself; failures surface as a low-stock
    // alert rather than a lost sale.
    await useInventoryStore.getState().autoDeductForSale(
      lines.map((l) => ({ consumes: l.item.consumes, qty: l.qty }))
    );

    enqueueSync("Transactions", localId, tx);
    enqueueSync("TransactionItems", localId, lines);
    enqueueSync("JournalEntries", localId, journalEntries);

    set({ lines: [], customerName: null, memberId: null, redeemFreeLineId: null });
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

    if (txRow.member_id) {
      const earned = Number(txRow.points_earned) || 0;
      const redeemed = Number(txRow.points_redeemed) || 0;
      const delta = redeemed - earned;
      const now = new Date().toISOString();
      await db.runAsync(
        "UPDATE members SET points = MAX(0, points + ?), updated_at = ? WHERE id = ?",
        [delta, now, txRow.member_id]
      );
      if (delta !== 0) {
        await db.runAsync(
          `INSERT INTO member_point_logs (id, member_id, transaction_local_id, type, points_delta, treatments_count, note, created_at)
           VALUES (?,?,?,'adjust',?,0,?,?)`,
          [newId(), txRow.member_id, localId, delta, `Void ${txRow.receipt_no}: ${reason}`, now]
        );
      }
      await useMemberStore.getState().load();
    }

    await useInventoryStore.getState().restockForVoidedSale(
      itemRows.map((r) => ({ qty: r.qty, consumes: undefined })) // BOM re-lookup from catalog happens in a fuller impl
    );

    const reversalEntry = {
      id: newId(),
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

/** Memoized totals. Never select s.totals() directly: it returns a new object each call and loops zustand v5. */
export function useCartTotals() {
  const lines = usePosStore((s) => s.lines);
  return useMemo(() => computeCartTotals(lines), [lines]);
}
