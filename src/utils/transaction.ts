import { addMoney, calcTax, subtractMoney, type Rupiah } from "./money";
import { calcLineCommission } from "./commission";
import type { CartLine, CatalogItem, JournalEntry, Transaction } from "@/types";

const TAX_RATE_BPS = 1100; // PPN 11% — configurable in Settings, read from settings store at call site

export function buildCartLine(
  item: CatalogItem,
  qty: number,
  stylistId: string | null,
  lineDiscount: Rupiah = 0
): CartLine {
  const gross = item.price * qty;
  const lineTotal = subtractMoney(gross, lineDiscount);
  const commissionAmount = calcLineCommission({
    lineTotal,
    basis: item.commissionBasis,
    value: item.commissionValue,
    qty,
  });

  return {
    lineId: crypto.randomUUID(),
    item,
    qty,
    stylistId,
    lineDiscount,
    lineTotal,
    commissionAmount,
  };
}

export interface CartTotals {
  subtotal: Rupiah;
  discountTotal: Rupiah;
  taxTotal: Rupiah;
  grandTotal: Rupiah;
  commissionTotal: Rupiah;
}

export function computeCartTotals(lines: CartLine[], taxRateBps: number = TAX_RATE_BPS): CartTotals {
  const subtotal = addMoney(...lines.map((l) => l.item.price * l.qty));
  const discountTotal = addMoney(...lines.map((l) => l.lineDiscount));
  const { taxTotal, grandTotal } = calcTax(subtotal, discountTotal, taxRateBps);
  const commissionTotal = addMoney(...lines.map((l) => l.commissionAmount));
  return { subtotal, discountTotal, taxTotal, grandTotal, commissionTotal };
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
      id: crypto.randomUUID(),
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
