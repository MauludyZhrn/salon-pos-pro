import { formatRupiah } from "./money";
import type { PaymentMethod, Transaction } from "@/types";
import type { ReceiptConfig } from "@/services/receiptConfig";

/** Pure text layout for the receipt. Used by the preview; no Bluetooth or native code. */

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  edc: "Kartu (EDC BCA)",
  midtrans_qris: "QRIS",
  midtrans_cc: "Kartu kredit",
  midtrans_va: "Transfer VA",
  split: "Split",
};

export function padRow(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function fit(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, Math.max(1, max));
}

function center(text: string, width: number): string {
  if (text.length >= width) return text;
  return " ".repeat(Math.floor((width - text.length) / 2)) + text;
}

export interface ReceiptOptions {
  /** Tandai struk sebagai cetak ulang, supaya tidak tertukar dengan struk asli. */
  reprint?: boolean;
}

export function receiptLines(tx: Transaction, cfg: ReceiptConfig, opts: ReceiptOptions = {}): string[] {
  const w = cfg.paperWidth;
  const line = "-".repeat(w);
  const rows: string[] = [center(cfg.outletName, w)];
  if (cfg.address) rows.push(center(cfg.address, w));
  if (cfg.phone) rows.push(center(cfg.phone, w));
  rows.push(line, tx.receiptNo, new Date(tx.createdAt).toLocaleString("id-ID"));
  if (tx.customerName) {
    rows.push(fit(`Pelanggan: ${tx.customerName}${tx.memberId ? " (Member)" : ""}`, w));
  }
  if (opts.reprint) rows.push(center("*** CETAK ULANG ***", w));
  rows.push(line);

  for (const l of tx.lines) {
    rows.push(l.item.name);
    // Harga satuan asli x qty, lalu rincian promo / biaya tambahan, lalu total baris.
    rows.push(padRow(`  ${l.qty} x ${formatRupiah(l.item.price)}`, formatRupiah(l.item.price * l.qty), w));
    const visible = (l.adjustments ?? []).filter((a) => a.kind === "additional" || cfg.showDiscount);
    for (const a of visible) {
      const amount = a.kind === "additional" ? formatRupiah(a.amount) : `-${formatRupiah(a.amount)}`;
      const label = a.kind === "additional" ? `  + ${a.name}` : `  ${a.name}`;
      rows.push(padRow(fit(label, w - amount.length - 1), amount, w));
    }
    if (visible.length > 0) rows.push(padRow("", formatRupiah(l.lineTotal), w));
  }

  rows.push(line);
  rows.push(padRow("Subtotal", formatRupiah(tx.subtotal), w));
  if (cfg.showDiscount && tx.discountTotal > 0) rows.push(padRow("Diskon", `-${formatRupiah(tx.discountTotal)}`, w));
  if (tx.extraTotal > 0) rows.push(padRow("Biaya tambahan", formatRupiah(tx.extraTotal), w));
  rows.push(padRow("TOTAL", formatRupiah(tx.grandTotal), w));
  rows.push(line);

  for (const leg of tx.paymentBreakdown) {
    rows.push(padRow(METHOD_LABEL[leg.method] ?? leg.method, formatRupiah(leg.amount), w));
  }

  if (tx.memberId && ((tx.pointsEarned ?? 0) > 0 || (tx.pointsRedeemed ?? 0) > 0)) {
    rows.push(line);
    if ((tx.pointsRedeemed ?? 0) > 0) {
      rows.push(padRow("Tukar Poin (Gratis 1x)", `-${tx.pointsRedeemed} poin`, w));
    }
    if ((tx.pointsEarned ?? 0) > 0) {
      rows.push(padRow("Poin Treatment Didapat", `+${tx.pointsEarned} poin`, w));
    }
  }

  if (cfg.footer) {
    rows.push("", center(cfg.footer, w));
  }
  return rows;
}
