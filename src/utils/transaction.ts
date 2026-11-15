import { addMoney, calcTax, subtractMoney, type Rupiah } from "./money";
import { calcLineCommission } from "./commission";
import { newId } from "./id";
import { evaluateRules } from "./promotions";
import type { AdjustmentRule, CartLine, CatalogItem, JournalEntry, Transaction } from "@/types";

const TAX_RATE_BPS = 0; // Tanpa pajak: klien tidak memungut PPN. Kolom tax_total tetap ada (selalu 0).

/**
 * Membuat satu baris keranjang. `rules` = diskon / promo / biaya tambahan yang berlaku untuk item ini
 * (lihat rulesForItem). Komisi dihitung dari harga setelah potongan, tanpa biaya tambahan.
 */
export function buildCartLine(
  item: CatalogItem,
  qty: number,
  stylistId: string | null,
  rules: AdjustmentRule[] = []
): CartLine {
  const gross = item.price * qty;
  const { adjustments, discount, extra } = evaluateRules(item.price, qty, rules);
  const afterDiscount = subtractMoney(gross, discount);
  const lineTotal = addMoney(afterDiscount, extra);
  const commissionAmount = calcLineCommission({
    lineTotal: afterDiscount,
    basis: item.commissionBasis,
    value: item.commissionValue,
    qty,
  });

  return {
    lineId: newId(),
    item,
    qty,
    stylistId,
    lineDiscount: discount,
    lineExtra: extra,
    adjustments,
    lineTotal,
    commissionAmount,
  };
}

/** Hitung ulang baris yang sudah ada (qty / stylist / aturan berubah) dengan lineId yang sama. */
export function rebuildCartLine(
  line: CartLine,
  changes: { qty?: number; stylistId?: string | null; rules?: AdjustmentRule[] } = {}
): CartLine {
  const rules = changes.rules ?? line.adjustments.map(({ amount: _amount, ...rule }) => rule);
  return {
    ...buildCartLine(line.item, changes.qty ?? line.qty, changes.stylistId === undefined ? line.stylistId : changes.stylistId, rules),
    lineId: line.lineId,
  };
}

export interface CartTotals {
  subtotal: Rupiah;
  discountTotal: Rupiah;
  extraTotal: Rupiah;
  taxTotal: Rupiah;
  grandTotal: Rupiah;
  commissionTotal: Rupiah;
}

export function computeCartTotals(lines: CartLine[], taxRateBps: number = TAX_RATE_BPS): CartTotals {
  const subtotal = addMoney(...lines.map((l) => l.item.price * l.qty));
  const discountTotal = addMoney(...lines.map((l) => l.lineDiscount));
  const extraTotal = addMoney(...lines.map((l) => l.lineExtra));
  const taxed = calcTax(subtotal, discountTotal, taxRateBps);
  const grandTotal = addMoney(taxed.grandTotal, extraTotal);
  const commissionTotal = addMoney(...lines.map((l) => l.commissionAmount));
  return { subtotal, discountTotal, extraTotal, taxTotal: taxed.taxTotal, grandTotal, commissionTotal };
}

/**
 * Generates the double-entry journal rows for a completed POS transaction.
 * Debits always equal credits — assert this in tests, never trust manually.
 */
export function buildJournalEntries(tx: Transaction): JournalEntry[] {
  const date = tx.createdAt.slice(0, 10);
  const now = new Date().toISOString();
  const entries: JournalEntry[] = [];

  const push = (account: JournalEntry["account"], direction: "debit" | "kredit", amount: Rupiah, memo: string) => {
    if (amount === 0) return;
    entries.push({
      id: newId(),
      transactionLocalId: tx.localId,
      date,
      account,
      direction,
      amount,
      memo,
      createdAt: now,
    });
  };

  // 1. Cash/receivable in, gross of discount, net of tax rolled into revenue split below.
  const kasAccount = tx.paymentMethod === "cash" ? "kas" : "piutang";
  push(kasAccount, "debit", tx.grandTotal, `Penerimaan ${tx.receiptNo}`);

  // 2. Revenue split by item type (jasa vs retail), net of discount, excl. tax.
  const jasaRevenue = tx.lines.filter((l) => l.item.type === "service").reduce((s, l) => s + l.lineTotal, 0);
  const retailRevenue = tx.lines.filter((l) => l.item.type === "retail").reduce((s, l) => s + l.lineTotal, 0);
  push("pendapatan_jasa", "kredit", jasaRevenue, `Pendapatan jasa ${tx.receiptNo}`);
  push("pendapatan_retail", "kredit", retailRevenue, `Pendapatan retail ${tx.receiptNo}`);

  // 3. Tax collected is a liability to the state, not revenue — kept simple here as
  //    part of kas debit above; a full PPN-keluaran account can be split out later.

  // 4. Commission accrual (expense now, paid later -> hutang_komisi).
  const commissionTotal = addMoney(...tx.lines.map((l) => l.commissionAmount));
  if (commissionTotal > 0) {
    push("beban_komisi", "debit", commissionTotal, `Komisi stylist ${tx.receiptNo}`);
    push("hutang_komisi", "kredit", commissionTotal, `Hutang komisi ${tx.receiptNo}`);
  }

  return entries;
}

export function nextReceiptNumber(sequenceToday: number, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const seq = String(sequenceToday).padStart(5, "0");
  return `SAL-${y}${m}${d}-${seq}`;
}
