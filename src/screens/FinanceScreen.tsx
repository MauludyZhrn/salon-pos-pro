import { useEffect, useMemo } from "react";
import { useCloud } from "@/services/cloudSync";
import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { exportFinanceExcel } from "@/services/exportFinance";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { PnLChart } from "@/components/finance/PnLChart";
import { CashFlowChart } from "@/components/finance/CashFlowChart";
import { color, spacing } from "@/constants/theme";
import { formatRupiah, addMoney } from "@/utils/money";
import { useFinanceStore } from "@/store/financeStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

function last30DaysRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function FinanceScreen() {
  const insets = useSafeAreaInsets();
  const { useSidePanel } = useResponsiveLayout();
  const pnlByDay = useFinanceStore((s) => s.pnlByDay);
  const cashFlowByDay = useFinanceStore((s) => s.cashFlowByDay);
  const loadRange = useFinanceStore((s) => s.loadRange);

  const syncVersion = useCloud((c) => c.version);
  const [exporting, setExporting] = useState(false);

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
  useEffect(() => {
    const { from, to } = last30DaysRange();
    loadRange(from, to);
  }, [loadRange, syncVersion]);

  const summary = useMemo(() => {
    const revenue = addMoney(...pnlByDay.map((d) => addMoney(d.revenueJasa, d.revenueRetail)));
    const expense = addMoney(...pnlByDay.map((d) => addMoney(d.hppRetail, d.hppBahan, d.bebanKomisi, d.bebanOperasional)));
    const netProfit = addMoney(...pnlByDay.map((d) => d.netProfit));
    const netCash = addMoney(...cashFlowByDay.map((d) => d.netCash));
    return { revenue, expense, netProfit, netCash };
  }, [pnlByDay, cashFlowByDay]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Keuangan" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.md + insets.bottom, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: color.textMuted, fontSize: 12 }}>30 hari terakhir</Text>
          <Button label="Export Excel" size="sm" variant="secondary" loading={exporting} onPress={handleExport} />
        </View>

        <View style={{ flexDirection: useSidePanel ? "row" : "column", gap: spacing.sm }}>
          <SummaryCard label="Pendapatan" value={summary.revenue} tone="accent" style={{ flex: 1 }} />
          <SummaryCard label="Beban" value={summary.expense} tone="danger" style={{ flex: 1 }} />
          <SummaryCard label="Laba bersih" value={summary.netProfit} tone="primary" style={{ flex: 1 }} />
          <SummaryCard label="Arus kas bersih" value={summary.netCash} tone="info" style={{ flex: 1 }} />
        </View>

        <Card>
          <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: spacing.sm }}>
            Laba Rugi (PnL)
          </Text>
          <PnLChart data={pnlByDay} />
        </Card>

        <Card>
          <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: spacing.sm }}>
            Arus Kas Harian
          </Text>
          <CashFlowChart data={cashFlowByDay} />
        </Card>

        <Card>
          <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: spacing.sm }}>
            Jurnal Operasional Harian
          </Text>
          {pnlByDay.slice(-7).reverse().map((d) => (
            <View
              key={d.date}
              style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xxs, borderBottomWidth: 1, borderBottomColor: color.border }}
            >
              <Text style={{ color: color.textSecondary, fontSize: 13 }}>{d.date}</Text>
              <Text style={{ color: d.netProfit >= 0 ? color.accent : color.danger, fontSize: 13, fontWeight: "600" }}>
                {formatRupiah(d.netProfit)}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
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
      <Text style={{ color: color.textMuted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: color[tone], fontSize: 16, fontWeight: "700", marginTop: 2 }}>{formatRupiah(value)}</Text>
    </Card>
  );
}
