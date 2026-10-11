import { BLEPrinter } from "react-native-thermal-receipt-printer-image-qr";
import { formatRupiah } from "@/utils/money";
import type { Transaction } from "@/types";

/**
 * Thermal receipt printing over Bluetooth LE (ESC/POS), via
 * react-native-thermal-receipt-printer-image-qr — maintained fork,
 * builds clean on modern Gradle/AGP (unlike bluetooth-escpos-printer,
 * which still ships jcenter()/compile fileTree() and cannot build on
 * Gradle 9+ without heavy patching).
 */

export interface PairedPrinter {
  name: string;
  address: string; // inner_mac_address, used as the connect/print target id
}

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  await BLEPrinter.init();
  initialized = true;
}

export async function scanPrinters(): Promise<PairedPrinter[]> {
  await ensureInit();
  const devices = await BLEPrinter.getDeviceList();
  return devices.map((d: any) => ({ name: d.device_name ?? d.inner_mac_address, address: d.inner_mac_address }));
}

export async function connectPrinter(address: string): Promise<void> {
  await ensureInit();
  await BLEPrinter.connectPrinter(address);
}

const LINE_WIDTH = 32; // standard 58mm thermal paper at default font

function padRow(left: string, right: string, width = LINE_WIDTH): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function divider(width = LINE_WIDTH): string {
  return "-".repeat(width);
}

export async function printReceipt(tx: Transaction, outletName = "Salon Premium"): Promise<void> {
  await ensureInit();

  const lines: string[] = [];
  lines.push(`<C><B>${outletName}</B></C>`);
  lines.push(`<C>${tx.receiptNo}</C>`);
  lines.push(`<C>${new Date(tx.createdAt).toLocaleString("id-ID")}</C>`);
  lines.push(divider());

  for (const line of tx.lines) {
    lines.push(line.item.name);
    lines.push(padRow(`  ${line.qty} x ${formatRupiah(line.item.price)}`, formatRupiah(line.lineTotal)));
  }

  lines.push(divider());
  lines.push(padRow("Subtotal", formatRupiah(tx.subtotal)));
  if (tx.discountTotal > 0) lines.push(padRow("Diskon", `-${formatRupiah(tx.discountTotal)}`));
  lines.push(padRow("Pajak", formatRupiah(tx.taxTotal)));
  lines.push(`<B>${padRow("TOTAL", formatRupiah(tx.grandTotal))}</B>`);
  lines.push(divider());

  for (const leg of tx.paymentBreakdown) {
    lines.push(padRow(leg.method, formatRupiah(leg.amount)));
  }

  lines.push("");
  lines.push("<C>Terima kasih!</C>");
  lines.push("");
  lines.push("");

  // Library's printText accepts its own lightweight markup (<C>, <B>) for
  // center/bold; plain lines print left-aligned normal weight.
  await BLEPrinter.printText(lines.join("\n") + "\n");
}

/** Dry-run text render for the Settings > Receipt Preview screen — no Bluetooth needed. */
export function previewReceiptText(tx: Transaction, outletName = "Salon Premium"): string {
  const rows: string[] = [];
  rows.push(outletName, tx.receiptNo, new Date(tx.createdAt).toLocaleString("id-ID"), divider());
  for (const line of tx.lines) {
    rows.push(line.item.name);
    rows.push(padRow(`  ${line.qty} x ${formatRupiah(line.item.price)}`, formatRupiah(line.lineTotal)));
  }
  rows.push(divider());
  rows.push(padRow("Subtotal", formatRupiah(tx.subtotal)));
  if (tx.discountTotal > 0) rows.push(padRow("Diskon", `-${formatRupiah(tx.discountTotal)}`));
  rows.push(padRow("Pajak", formatRupiah(tx.taxTotal)));
  rows.push(padRow("TOTAL", formatRupiah(tx.grandTotal)));
  rows.push(divider());
  for (const leg of tx.paymentBreakdown) rows.push(padRow(leg.method, formatRupiah(leg.amount)));
  rows.push("", "Terima kasih!");
  return rows.join("\n");
}