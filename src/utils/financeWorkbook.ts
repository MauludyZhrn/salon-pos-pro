import * as XLSX from "xlsx";

/** Plain data in, workbook out. No React Native or database imports, so it is easy to test. */

export interface PnLRow {
  date: string;
  revenueJasa: number;
  revenueRetail: number;
  hppRetail: number;
  hppBahan: number;
  bebanKomisi: number;
  bebanOperasional: number;
  netProfit: number;
}

export interface CashFlowRow {
  date: string;
  kasMasuk: number;
  kasKeluar: number;
  netCash: number;
}

export interface TransactionRow {
  receipt_no: string;
  created_at: string;
  cashier: string | null;
  customer_name: string | null;
  payment_method: string;
  subtotal: number;
  discount_total: number;
  extra_total?: number;
  tax_total: number;
  grand_total: number;
  status: string;
}

export interface SoldItemRow {
  receipt_no: string;
  created_at: string;
  status: string;
  item_type: string;
  item_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  stylist: string | null;
  commission_amount: number;
}

export interface JournalRow {
  date: string;
  account: string;
  direction: string;
  amount: number;
  memo: string;
}

export interface FinanceExportData {
  from: string;
  to: string;
  generatedAt: string;
  pnl: PnLRow[];
  cashFlow: CashFlowRow[];
  transactions: TransactionRow[];
  items: SoldItemRow[];
  journal: JournalRow[];
}

const MONEY = "#,##0";

function sum(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0);
}

function sheetFrom(rows: (string | number)[][], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith("!")) continue;
    const cell = ws[addr] as XLSX.CellObject;
    if (cell.t === "n") cell.z = MONEY;
  }
  if (rows.length > 1) {
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: widths.length - 1 } }) };
  }
  return ws;
}

const isoToLocal = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function buildFinanceWorkbook(data: FinanceExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const paid = data.transactions.filter((t) => t.status === "paid");
  const revenueJasa = sum(data.pnl.map((d) => d.revenueJasa));
  const revenueRetail = sum(data.pnl.map((d) => d.revenueRetail));
  const hppRetail = sum(data.pnl.map((d) => d.hppRetail));
  const hppBahan = sum(data.pnl.map((d) => d.hppBahan));
  const komisi = sum(data.pnl.map((d) => d.bebanKomisi));
  const operasional = sum(data.pnl.map((d) => d.bebanOperasional));
  const revenue = revenueJasa + revenueRetail;
  const expense = hppRetail + hppBahan + komisi + operasional;
  const kasMasuk = sum(data.cashFlow.map((d) => d.kasMasuk));
  const kasKeluar = sum(data.cashFlow.map((d) => d.kasKeluar));

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      [
        ["Laporan Keuangan Salon", ""],
        ["Periode", `${data.from} s/d ${data.to}`],
        ["Dibuat", isoToLocal(data.generatedAt)],
        ["", ""],
        ["Pendapatan jasa", revenueJasa],
        ["Pendapatan retail", revenueRetail],
        ["Total pendapatan", revenue],
        ["HPP retail", hppRetail],
        ["HPP bahan", hppBahan],
        ["Beban komisi", komisi],
        ["Beban operasional", operasional],
        ["Total beban", expense],
        ["Laba bersih", revenue - expense],
        ["", ""],
        ["Kas masuk", kasMasuk],
        ["Kas keluar", kasKeluar],
        ["Arus kas bersih", kasMasuk - kasKeluar],
        ["", ""],
        ["Jumlah transaksi (lunas)", paid.length],
        ["Rata-rata per transaksi", paid.length ? Math.round(sum(paid.map((t) => t.grand_total)) / paid.length) : 0],
      ],
      [28, 24]
    ),
    "Ringkasan"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      [
        ["Tanggal", "Pendapatan jasa", "Pendapatan retail", "HPP retail", "HPP bahan", "Beban komisi", "Beban operasional", "Laba bersih"],
        ...data.pnl.map((d) => [d.date, d.revenueJasa, d.revenueRetail, d.hppRetail, d.hppBahan, d.bebanKomisi, d.bebanOperasional, d.netProfit]),
      ],
      [12, 16, 17, 12, 12, 14, 18, 14]
    ),
    "Laba Rugi"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      [["Tanggal", "Kas masuk", "Kas keluar", "Arus kas bersih"], ...data.cashFlow.map((d) => [d.date, d.kasMasuk, d.kasKeluar, d.netCash])],
      [12, 14, 14, 16]
    ),
    "Arus Kas"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      [
        ["No. struk", "Waktu", "Kasir", "Pelanggan", "Metode", "Subtotal", "Diskon", "Biaya tambahan", "Total", "Status"],
        ...data.transactions.map((t) => [
          t.receipt_no,
          isoToLocal(t.created_at),
          t.cashier ?? "",
          t.customer_name ?? "",
          t.payment_method,
          t.subtotal,
          t.discount_total,
          t.extra_total ?? 0,
          t.grand_total,
          t.status,
        ]),
      ],
      [20, 17, 16, 18, 12, 12, 10, 14, 12, 10]
    ),
    "Transaksi"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      [
        ["No. struk", "Waktu", "Jenis", "Item", "Qty", "Harga satuan", "Total baris", "Stylist", "Komisi", "Status"],
        ...data.items.map((i) => [
          i.receipt_no,
          isoToLocal(i.created_at),
          i.item_type === "service" ? "Layanan" : "Retail",
          i.item_name,
          i.qty,
          i.unit_price,
          i.line_total,
          i.stylist ?? "",
          i.commission_amount,
          i.status,
        ]),
      ],
      [20, 17, 9, 26, 6, 13, 13, 16, 11, 10]
    ),
    "Item Terjual"
  );

  const byStylist = new Map<string, { count: number; revenue: number; commission: number }>();
  for (const i of data.items) {
    if (i.status !== "paid" || !i.stylist) continue;
    const cur = byStylist.get(i.stylist) ?? { count: 0, revenue: 0, commission: 0 };
    cur.count += i.qty;
    cur.revenue += i.line_total;
    cur.commission += i.commission_amount;
    byStylist.set(i.stylist, cur);
  }
  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      [
        ["Stylist", "Jumlah item", "Omzet", "Komisi"],
        ...Array.from(byStylist.entries())
          .sort((a, b) => b[1].commission - a[1].commission)
          .map(([name, v]) => [name, v.count, v.revenue, v.commission]),
      ],
      [20, 13, 14, 14]
    ),
    "Komisi"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      [
        ["Tanggal", "Akun", "Debit", "Kredit", "Keterangan"],
        ...data.journal.map((j) => [j.date, j.account, j.direction === "debit" ? j.amount : 0, j.direction === "kredit" ? j.amount : 0, j.memo]),
      ],
      [12, 20, 13, 13, 44]
    ),
    "Jurnal"
  );

  return wb;
}

export function workbookToBase64(wb: XLSX.WorkBook): string {
  return XLSX.write(wb, { type: "base64", bookType: "xlsx", compression: true });
}
