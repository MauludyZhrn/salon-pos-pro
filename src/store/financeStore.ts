import { create } from "zustand";
import { getDb } from "@/services/database";
import { addMoney, subtractMoney, type Rupiah } from "@/utils/money";
import type { JournalAccount, JournalEntry } from "@/types";

export interface DailyPnL {
  date: string;
  revenueJasa: Rupiah;
  revenueRetail: Rupiah;
  hppRetail: Rupiah;
  hppBahan: Rupiah;
  bebanKomisi: Rupiah;
  bebanOperasional: Rupiah;
  netProfit: Rupiah;
  /** Jumlah transaksi unik yang tercatat di jurnal pada tanggal tersebut. */
  txCount: number;
}

export interface DailyCashFlow {
  date: string;
  kasMasuk: Rupiah;
  kasKeluar: Rupiah;
  netCash: Rupiah;
}

interface FinanceState {
  pnlByDay: DailyPnL[];
  cashFlowByDay: DailyCashFlow[];
  loading: boolean;
  loadRange: (fromDate: string, toDate: string) => Promise<void>;
}

const REVENUE_ACCOUNTS: JournalAccount[] = ["pendapatan_jasa", "pendapatan_retail"];
const EXPENSE_ACCOUNTS: JournalAccount[] = ["hpp_retail", "hpp_bahan", "beban_komisi", "beban_operasional"];
const CASH_ACCOUNTS: JournalAccount[] = ["kas"];

function rowToEntry(row: any): JournalEntry {
  return {
    id: row.id,
    transactionLocalId: row.transaction_local_id,
    date: row.date,
    account: row.account,
    direction: row.direction,
    amount: row.amount,
    memo: row.memo,
    createdAt: row.created_at,
  };
}

export const useFinanceStore = create<FinanceState>((set) => ({
  pnlByDay: [],
  cashFlowByDay: [],
  loading: false,

  async loadRange(fromDate, toDate) {
    set({ loading: true });
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM journal_entries WHERE date >= ? AND date <= ? ORDER BY date ASC",
      [fromDate, toDate]
    );
    const entries = rows.map(rowToEntry);

    const byDate = new Map<string, JournalEntry[]>();
    for (const e of entries) {
      const arr = byDate.get(e.date) ?? [];
      arr.push(e);
      byDate.set(e.date, arr);
    }

    const pnlByDay: DailyPnL[] = [];
    const cashFlowByDay: DailyCashFlow[] = [];

    for (const [date, dayEntries] of Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const sumAccount = (account: JournalAccount, direction: "debit" | "kredit") =>
        dayEntries.filter((e) => e.account === account && e.direction === direction).reduce((s, e) => addMoney(s, e.amount), 0);

      const revenueJasa = sumAccount("pendapatan_jasa", "kredit");
      const revenueRetail = sumAccount("pendapatan_retail", "kredit");
      const hppRetail = sumAccount("hpp_retail", "debit");
      const hppBahan = sumAccount("hpp_bahan", "debit");
      const bebanKomisi = sumAccount("beban_komisi", "debit");
      const bebanOperasional = sumAccount("beban_operasional", "debit");

      const totalRevenue = addMoney(revenueJasa, revenueRetail);
      const totalExpense = addMoney(hppRetail, hppBahan, bebanKomisi, bebanOperasional);
      const netProfit = subtractMoney(totalRevenue, totalExpense);
      const txCount = new Set(
        dayEntries.map((e) => e.transactionLocalId).filter((id): id is string => typeof id === "string" && id.length > 0)
      ).size;

      pnlByDay.push({ date, revenueJasa, revenueRetail, hppRetail, hppBahan, bebanKomisi, bebanOperasional, netProfit, txCount });

      const kasMasuk = dayEntries
        .filter((e) => CASH_ACCOUNTS.includes(e.account) && e.direction === "debit")
        .reduce((s, e) => addMoney(s, e.amount), 0);
      const kasKeluar = dayEntries
        .filter((e) => CASH_ACCOUNTS.includes(e.account) && e.direction === "kredit")
        .reduce((s, e) => addMoney(s, e.amount), 0);

      cashFlowByDay.push({ date, kasMasuk, kasKeluar, netCash: subtractMoney(kasMasuk, kasKeluar) });
    }

    set({ pnlByDay, cashFlowByDay, loading: false });
  },
}));

void REVENUE_ACCOUNTS;
void EXPENSE_ACCOUNTS;
