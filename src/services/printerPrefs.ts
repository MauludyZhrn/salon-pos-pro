import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PairedPrinter } from "@/services/printerService";

/** Remembers the chosen printer on this phone so it survives app restarts. */
const KEY = "salonpos.printer.selected";

export async function loadSelectedPrinter(): Promise<PairedPrinter | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PairedPrinter) : null;
  } catch {
    return null;
  }
}

export async function saveSelectedPrinter(p: PairedPrinter | null): Promise<void> {
  try {
    if (p) await AsyncStorage.setItem(KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(KEY);
  } catch {}
}
