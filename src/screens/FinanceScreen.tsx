import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Alert, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { exportFinanceExcel } from "@/services/exportFinance";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { PnLChart } from "@/components/finance/PnLChart";
import { CashFlowChart } from "@/components/finance/CashFlowChart";
import { DailyJournalSheet } from "@/components/finance/DailyJournalSheet";
import { EditTransactionModal } from "@/components/history/EditTransactionModal";
import { TransactionDetailSheet } from "@/components/history/TransactionDetailSheet";
import { useCloud } from "@/services/cloudSync";
import { loadTransaction } from "@/services/transactionRepo";
import { useAuthStore, PERMISSIONS } from "@/store/authStore";
import { color, spacing } from "@/constants/theme";
import { formatWeekdayDateId } from "@/utils/dateFormat";
import { formatRupiah, addMoney } from "@/utils/money";
import { useFinanceStore } from "@/store/financeStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import type { Transaction } from "@/types";

function last30DaysRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

type FinanceSheet = "journal" | "detail" | "edit" | null;

export function FinanceScreen() {
  const insets = useSafeAreaInsets();
  const { width, pagePadding } = useResponsiveLayout();
  const pnlByDay = useFinanceStore((s) => s.pnlByDay);
  const cashFlowByDay = useFinanceStore((s) => s.cashFlowByDay);
  const loadRange = useFinanceStore((s) => s.loadRange);
  const role = useAuthStore((s) => s.currentEmployee?.role);
  const canEdit = !!role && PERMISSIONS.transactionEdit.includes(role);

  const syncVersion = useCloud((c) => c.version);
  const [exporting, setExporting] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [sheet, setSheet] = useState<FinanceSheet>(null);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  const reloadFinance = useCallback(() => {
    const { from, to } = last30DaysRange();
    loadRange(from, to);
  }, [loadRange]);

  useFocusEffect(
    useCallback(() => {
      reloadFinance();
    }, [reloadFinance, syncVersion])
  );

  async function handleExport() {
    setExporting(true);
    try {
      const { from, to } = last30DaysRange();
      const saved = await exportFinanceExcel(from, to);
      if (saved) Alert.alert("Tersimpan", "File Excel laporan keuangan sudah disimpan di folder yang Anda pilih.");
    } catch (e) {
      Alert.alert("Gagal export", e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function handleSelectTransaction(localId: string) {
    const full = await loadTransaction(localId);
    if (!full) return Alert.alert("Transaksi tidak ditemukan");
    setSelectedTx(full);
    setSheet("detail");
  }

  function handleTransactionSaved(updated: Transaction) {
    setSelectedTx(updated);
    setJournalRefreshKey((k) => k + 1);
    reloadFinance();
    setSheet("detail");
    Alert.alert("Transaksi diperbarui", "Tekan Cetak ulang struk untuk mencetak versi yang benar.");
  }

  const summary = useMemo(() => {
    const revenue = addMoney(...pnlByDay.map((d) => addMoney(d.revenueJasa, d.revenueRetail)));
    const expense = addMoney(...pnlByDay.map((d) => addMoney(d.hppRetail, d.hppBahan, d.bebanKomisi, d.bebanOperasional)));
    const netProfit = addMoney(...pnlByDay.map((d) => d.netProfit));
    const netCash = addMoney(...cashFlowByDay.map((d) => d.netCash));
    return { revenue, expense, netProfit, netCash };
  }, [pnlByDay, cashFlowByDay]);

  const orderedJournalDays = useMemo(() => [...pnlByDay].reverse(), [pnlByDay]);
  const visibleJournalDays = showAllDays ? orderedJournalDays : orderedJournalDays.slice(0, 7);
  const selectedDay = useMemo(
    () => (selectedDate ? pnlByDay.find((d) => d.date === selectedDate) ?? null : null),
    [pnlByDay, selectedDate]
  );
  const selectedCashFlow = useMemo(
    () => (selectedDate ? cashFlowByDay.find((d) => d.date === selectedDate) ?? null : null),
    [cashFlowByDay, selectedDate]
  );

  const fourColSummary = width >= 840;
  const twoColCharts = width >= 960;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Keuangan" />
      <ScrollView
        contentContainerStyle={{
          padding: pagePadding,
          paddingBottom: spacing.md + insets.bottom,
          gap: spacing.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: color.textMuted, fontSize: 12 }}>30 hari terakhir</Text>
          <Button label="Export Excel" size="sm" variant="secondary" loading={exporting} onPress={handleExport} />
        </View>

        {fourColSummary ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <SummaryCard label="Pendapatan" value={summary.revenue} tone="accent" style={{ flex: 1 }} />
            <SummaryCard label="Beban" value={summary.expense} tone="danger" style={{ flex: 1 }} />
            <SummaryCard label="Laba bersih" value={summary.netProfit} tone="primary" style={{ flex: 1 }} />
            <SummaryCard label="Arus kas bersih" value={summary.netCash} tone="info" style={{ flex: 1 }} />
          </View>
        ) : (
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              <SummaryCard label="Pendapatan" value={summary.revenue} tone="accent" style={{ flex: 1 }} />
              <SummaryCard label="Beban" value={summary.expense} tone="danger" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              <SummaryCard label="Laba bersih" value={summary.netProfit} tone="primary" style={{ flex: 1 }} />
              <SummaryCard label="Arus kas bersih" value={summary.netCash} tone="info" style={{ flex: 1 }} />
            </View>
          </View>
        )}

        <View style={{ flexDirection: twoColCharts ? "row" : "column", gap: spacing.md }}>
          <Card style={{ flex: twoColCharts ? 1 : undefined }}>
            <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: spacing.sm }}>
              Laba Rugi (PnL)
            </Text>
            <PnLChart data={pnlByDay} />
          </Card>

          <Card style={{ flex: twoColCharts ? 1 : undefined }}>
            <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: spacing.sm }}>
              Arus Kas Harian
            </Text>
            <CashFlowChart data={cashFlowByDay} />
          </Card>
        </View>

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs, marginBottom: spacing.xs }}>
            <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600" }}>
              Jurnal Operasional Harian
            </Text>
            <Text style={{ color: color.textMuted, fontSize: 11 }}>Ketuk hari untuk cek transaksi</Text>
          </View>

          {visibleJournalDays.length === 0 ? (
            <Text style={{ color: color.textMuted, fontSize: 13, paddingVertical: spacing.sm }}>
              Belum ada jurnal operasional pada 30 hari terakhir.
            </Text>
          ) : (
            visibleJournalDays.map((d) => {
              const dayRevenue = addMoney(d.revenueJasa, d.revenueRetail);
              return (
                <Pressable
                  key={d.date}
                  onPress={() => {
                    setSelectedDate(d.date);
                    setSheet("journal");
                  }}
                  accessibilityLabel={`Lihat transaksi tanggal ${d.date}`}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing.sm,
                    minHeight: 54,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.xxs,
                    borderBottomWidth: 1,
                    borderBottomColor: color.border,
                    backgroundColor: pressed ? color.surfaceAlt : "transparent",
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "600" }}>
                      {formatWeekdayDateId(d.date)}
                    </Text>
                    <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                      {d.txCount} transaksi · Omzet {formatRupiah(dayRevenue)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <Text style={{ color: d.netProfit >= 0 ? color.accent : color.danger, fontSize: 13, fontWeight: "700" }}>
                      {formatRupiah(d.netProfit)}
                    </Text>
                    <Icon name="chevronRight" color={color.textMuted} size={16} />
                  </View>
                </Pressable>
              );
            })
          )}

          {orderedJournalDays.length > 7 && (
            <Pressable
              onPress={() => setShowAllDays((prev) => !prev)}
              hitSlop={8}
              style={{ minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.xxs }}
            >
              <Text style={{ color: color.primaryDeep, fontSize: 13, fontWeight: "700" }}>
                {showAllDays ? "Tampilkan 7 hari terakhir" : `Lihat semua (${orderedJournalDays.length} hari)`}
              </Text>
            </Pressable>
          )}
        </Card>
      </ScrollView>

      <DailyJournalSheet
        visible={sheet === "journal"}
        day={selectedDay}
        cashFlow={selectedCashFlow}
        refreshKey={journalRefreshKey}
        onClose={() => {
          setSheet(null);
          setSelectedDate(null);
        }}
        onSelectTransaction={handleSelectTransaction}
      />

      <TransactionDetailSheet
        visible={sheet === "detail"}
        tx={selectedTx}
        canEdit={canEdit}
        onClose={() => setSheet("journal")}
        onEdit={() => setSheet("edit")}
      />

      <EditTransactionModal
        visible={sheet === "edit"}
        tx={selectedTx}
        onClose={() => setSheet("detail")}
        onSaved={handleTransactionSaved}
      />
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  style,
}: {
  label: string;
  value: number;
  tone: "accent" | "danger" | "primary" | "info";
  style?: any;
}) {
  return (
    <Card style={style}>
      <Text style={{ color: color.textMuted, fontSize: 11 }} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ color: color[tone], fontSize: 16, fontWeight: "700", marginTop: 2 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {formatRupiah(value)}
      </Text>
    </Card>
  );
}
