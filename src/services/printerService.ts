import { BLEPrinter, type IBLEPrinter } from "react-native-thermal-receipt-printer-image-qr";
import { DEFAULT_RECEIPT } from "@/services/receiptConfig";
import { printReceiptFromConfig } from "@/services/receiptPrinter";
import { receiptLines } from "@/utils/receiptText";
import type { Transaction } from "@/types";

/**
 * Printer Bluetooth thermal (ESC/POS). Printer harus sudah di-pair di pengaturan Bluetooth HP.
 * Library ini memakai Bluetooth klasik (RFCOMM), jadi printer 58/80 mm biasa tetap terdeteksi.
 */

export interface PairedPrinter {
  name: string;
  address: string;
}

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  await BLEPrinter.init();
  initialized = true;
}

/** Daftar printer yang sudah di-pair di HP ini. */
export async function scanPrinters(): Promise<PairedPrinter[]> {
  await ensureInit();
  const list: IBLEPrinter[] = await BLEPrinter.getDeviceList();
  return list.map((d) => ({ name: d.device_name || "Printer", address: d.inner_mac_address }));
}

export async function connectPrinter(address: string): Promise<void> {
  await ensureInit();
  await BLEPrinter.connectPrinter(address);
}

export async function disconnectPrinter(): Promise<void> {
  try {
    await BLEPrinter.closeConn();
  } catch {}
}

/** Cetak struk dengan pengaturan struk yang tersimpan (logo, alamat, footer, lebar kertas). */
export async function printReceipt(tx: Transaction, outletName = DEFAULT_RECEIPT.outletName): Promise<void> {
  await printReceiptFromConfig(tx, { ...DEFAULT_RECEIPT, outletName });
}

/** Teks struk untuk preview tanpa Bluetooth. */
export function previewReceiptText(tx: Transaction, outletName = DEFAULT_RECEIPT.outletName): string {
  return receiptLines(tx, { ...DEFAULT_RECEIPT, outletName }).join("\n");
}
