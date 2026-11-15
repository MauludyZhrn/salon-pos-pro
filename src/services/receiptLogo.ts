import { Asset } from "expo-asset";

/**
 * Logo struk. Ganti file assets/receipt-logo.png dengan logo client
 * (hitam-putih, lebar 384 px; lihat tools/make-logo.py), lalu build ulang.
 */
export const RECEIPT_LOGO = require("../../assets/receipt-logo.png");

function loadFileSystem(): any {
  try {
    return require("expo-file-system/legacy");
  } catch {
    return require("expo-file-system");
  }
}

let cached: string | null = null;

/** Logo as base64 PNG, the format the ESC/POS printer module wants. Null if it cannot be read. */
export async function loadLogoBase64(): Promise<string | null> {
  if (cached) return cached;
  try {
    const asset = Asset.fromModule(RECEIPT_LOGO);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    cached = await loadFileSystem().readAsStringAsync(uri, { encoding: "base64" });
    return cached;
  } catch {
    return null;
  }
}
