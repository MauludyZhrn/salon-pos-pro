import AsyncStorage from "@react-native-async-storage/async-storage";

/** Receipt layout settings. Saved per device, like the printer choice. */
export interface ReceiptConfig {
  outletName: string;
  address: string;
  phone: string;
  footer: string;
  showDiscount: boolean;
  showLogo: boolean;
  /** Characters per line: 32 for 58 mm paper, 48 for 80 mm. */
  paperWidth: 32 | 48;
}

export const DEFAULT_RECEIPT: ReceiptConfig = {
  outletName: "Salon Premium",
  address: "",
  phone: "",
  footer: "Terima kasih!",
  showDiscount: true,
  showLogo: true,
  paperWidth: 32,
};

const KEY = "salonpos.receipt.config";

export async function loadReceiptConfig(): Promise<ReceiptConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_RECEIPT, ...(JSON.parse(raw) as Partial<ReceiptConfig>) } : DEFAULT_RECEIPT;
  } catch {
    return DEFAULT_RECEIPT;
  }
}

export async function saveReceiptConfig(cfg: ReceiptConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {}
}
