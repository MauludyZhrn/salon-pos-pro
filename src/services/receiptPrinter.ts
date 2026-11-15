import { Image } from "react-native";
import { BLEPrinter } from "react-native-thermal-receipt-printer-image-qr";
import { RECEIPT_LOGO } from "@/services/receiptLogo";
import { receiptLines, type ReceiptOptions } from "@/utils/receiptText";
import { loadLogoBase64 } from "@/services/receiptLogo";
import type { ReceiptConfig } from "@/services/receiptConfig";
import type { Transaction } from "@/types";

/**
 * Cetak struk dengan teks yang sama persis dengan preview (receiptLines), lengkap dengan logo.
 * Printer harus sudah terhubung (connectPrinter).
 */
export async function printReceiptFromConfig(tx: Transaction, cfg: ReceiptConfig, opts: ReceiptOptions = {}): Promise<void> {
  const paperDots = cfg.paperWidth === 48 ? 576 : 384; // 80 mm : 58 mm
  const logoDots = cfg.paperWidth === 48 ? 320 : 240;

  if (cfg.showLogo) {
    const logo = await loadLogoBase64();
    // Gagal baca logo tidak boleh membatalkan struk.
    if (logo) {
      // Tinggi dihitung dari rasio asli logo supaya tidak gepeng.
      const src = Image.resolveAssetSource(RECEIPT_LOGO);
      const ratio = src?.width && src?.height ? src.height / src.width : 1;
      BLEPrinter.printImageBase64(logo, {
        imageWidth: logoDots,
        imageHeight: Math.round(logoDots * ratio),
        paddingX: Math.floor((paperDots - logoDots) / 2),
        printerWidthType: cfg.paperWidth === 48 ? 80 : 58,
      });
    }
  }

  BLEPrinter.printText(`${receiptLines(tx, cfg, opts).join("\n")}\n\n\n`, {});
}
