import { Platform, Share } from "react-native";
import { getDb } from "./database";
import { useFinanceStore } from "@/store/financeStore";
import { buildFinanceWorkbook, workbookToBase64, type FinanceExportData } from "@/utils/financeWorkbook";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** expo-file-system moved its classic API to "/legacy"; accept either layout. */
function loadFileSystem(): any {
  try {
    return require("expo-file-system/legacy");
  } catch {
    return require("expo-file-system");
  }
}

async function collect(from: string, to: string): Promise<FinanceExportData> {
  const db = await getDb();

  // Transactions are stored as UTC timestamps; the period is in local days.
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);

  const transactions = await db.getAllAsync<any>(
    `SELECT t.receipt_no, t.created_at, e.name AS cashier, t.customer_name, t.payment_method,
            t.subtotal, t.discount_total, t.extra_total, t.tax_total, t.grand_total, t.status
       FROM transactions t LEFT JOIN employees e ON e.id = t.cashier_id
      WHERE t.created_at >= ? AND t.created_at < ?
      ORDER BY t.created_at`,
    [start.toISOString(), end.toISOString()]
  );

  const items = await db.getAllAsync<any>(
    `SELECT t.receipt_no, t.created_at, t.status, i.item_type, i.item_name, i.qty, i.unit_price,
            i.line_total, s.name AS stylist, i.commission_amount
       FROM transaction_items i
       JOIN transactions t ON t.local_id = i.transaction_local_id
       LEFT JOIN employees s ON s.id = i.stylist_id
      WHERE t.created_at >= ? AND t.created_at < ?
      ORDER BY t.created_at`,
    [start.toISOString(), end.toISOString()]
  );

  const journal = await db.getAllAsync<any>(
    "SELECT date, account, direction, amount, memo FROM journal_entries WHERE date >= ? AND date <= ? ORDER BY date, created_at",
    [from, to]
  );

  const { pnlByDay, cashFlowByDay } = useFinanceStore.getState();

  return {
    from,
    to,
    generatedAt: new Date().toISOString(),
    pnl: pnlByDay,
    cashFlow: cashFlowByDay,
    transactions,
    items,
    journal,
  };
}

/** Android: the user picks a folder (e.g. Downloads) once; the file is written there. */
async function saveAndroid(base64: string, name: string): Promise<string | null> {
  const FS = loadFileSystem();

  if (FS.StorageAccessFramework) {
    const saf = FS.StorageAccessFramework;
    const perm = await saf.requestDirectoryPermissionsAsync();
    if (!perm.granted) return null;
    const uri = await saf.createFileAsync(perm.directoryUri, name, XLSX_MIME);
    await FS.writeAsStringAsync(uri, base64, { encoding: FS.EncodingType?.Base64 ?? "base64" });
    return uri;
  }

  // Newer expo-file-system object API.
  if (FS.Directory?.pickDirectoryAsync) {
    const dir = await FS.Directory.pickDirectoryAsync();
    const file = dir.createFile(name, XLSX_MIME);
    const bin = globalThis.atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    file.write(bytes);
    return file.uri as string;
  }

  throw new Error("Penyimpanan file tidak tersedia di build ini.");
}

async function saveIos(base64: string, name: string): Promise<string> {
  const FS = loadFileSystem();
  const uri = `${FS.cacheDirectory}${name}.xlsx`;
  await FS.writeAsStringAsync(uri, base64, { encoding: FS.EncodingType?.Base64 ?? "base64" });
  await Share.share({ url: uri });
  return uri;
}

/** Builds the workbook for [from, to] (YYYY-MM-DD) and saves it. Returns false if the user cancelled the folder picker. */
export async function exportFinanceExcel(from: string, to: string): Promise<boolean> {
  const data = await collect(from, to);
  const base64 = workbookToBase64(buildFinanceWorkbook(data));
  const name = `Laporan-Keuangan-${from}_${to}`;

  if (Platform.OS === "android") {
    return (await saveAndroid(base64, name)) !== null;
  }
  await saveIos(base64, name);
  return true;
}
