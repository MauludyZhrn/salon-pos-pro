import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, font, radius, spacing } from "@/constants/theme";
import { listTransactionsForJournalDate, type DailyJournalDetail, type JournalDayTx } from "@/services/transactionRepo";
import type { DailyCashFlow, DailyPnL } from "@/store/financeStore";
import { formatShortDateId, formatWeekdayDateId, isoToLocalDateString } from "@/utils/dateFormat";
import { addMoney, formatRupiah } from "@/utils/money";
import { METHOD_LABEL } from "@/utils/receiptText";

interface DailyJournalSheetProps {
  visible: boolean;
  day: DailyPnL | null;
  cashFlow: DailyCashFlow | null;
  refreshKey?: number;
  onClose: () => void;
  onSelectTransaction: (localId: string) => void;
}

const ACCOUNT_LABEL: Record<string, string> = {
  kas: "Kas",
  piutang: "Piutang",
  pendapatan_jasa: "Pendapatan Jasa",
  pendapatan_retail: "Pendapatan Retail",
  hpp_retail: "HPP Retail",
  hpp_bahan: "HPP Bahan",
  beban_komisi: "Beban Komisi",
  beban_operasional: "Beban Operasional",
  hutang_komisi: "Hutang Komisi",
};

/** Sheet rincian transaksi dan jurnal untuk satu hari pada Jurnal Operasional Harian. */
export function DailyJournalSheet({
  visible,
  day,
  cashFlow,
  refreshKey = 0,
  onClose,
  onSelectTransaction,
}: DailyJournalSheetProps) {
  const { sheetMaxBodyHeight } = useResponsiveLayout();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DailyJournalDetail | null>(null);

  useEffect(() => {
    if (!visible || !day) return;
    let alive = true;
    setLoading(true);
    listTransactionsForJournalDate(day.date)
      .then((res) => {
        if (alive) setDetail(res);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, day, refreshKey]);

  const revenue = day ? addMoney(day.revenueJasa, day.revenueRetail) : 0;
  const expense = day ? addMoney(day.hppRetail, day.hppBahan, day.bebanKomisi, day.bebanOperasional) : 0;
  const transactions = detail?.transactions ?? [];
  const standaloneEntries = detail?.standaloneEntries ?? [];

  return (
    <BottomSheet visible={visible && day !== null} onClose={onClose}>
      {day && (
        <View>
          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 21, fontWeight: "600" }}>
            Jurnal {formatWeekdayDateId(day.date)}
          </Text>
          <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm }}>
            {transactions.length} transaksi tercatat · Ketuk transaksi untuk cek struk lengkap
          </Text>

          <View
            style={{
              flexDirection: "row",
              gap: spacing.xs,
              backgroundColor: color.surfaceAlt,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: color.border,
              padding: spacing.xs,
              marginBottom: spacing.sm,
            }}
          >
            <MetricPill label="Pendapatan" value={revenue} tone={color.accent} />
            <MetricPill label="Beban" value={expense} tone={color.danger} />
            <MetricPill label="Laba bersih" value={day.netProfit} tone={day.netProfit >= 0 ? color.primaryDeep : color.danger} />
          </View>

          {cashFlow && (cashFlow.kasMasuk > 0 || cashFlow.kasKeluar > 0) && (
            <Text style={{ color: color.textSecondary, fontSize: 12, marginBottom: spacing.sm }}>
              Kas masuk {formatRupiah(cashFlow.kasMasuk)} · Kas keluar {formatRupiah(cashFlow.kasKeluar)}
            </Text>
          )}

          <ScrollView style={{ maxHeight: sheetMaxBodyHeight }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {loading && !detail ? (
              <ActivityIndicator color={color.primary} style={{ marginVertical: spacing.lg }} />
            ) : (
              <View style={{ gap: spacing.xs }}>
                {transactions.length === 0 ? (
                  <View style={{ paddingVertical: spacing.md, alignItems: "center" }}>
                    <Text style={{ color: color.textMuted, fontSize: 13 }}>
                      Tidak ada transaksi kasir pada tanggal ini.
                    </Text>
                  </View>
                ) : (
                  transactions.map((tx) => (
                    <JournalTxCard
                      key={tx.localId}
                      tx={tx}
                      journalDate={day.date}
                      onPress={() => onSelectTransaction(tx.localId)}
                    />
                  ))
                )}

                {standaloneEntries.length > 0 && (
                  <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                    <Text style={{ color: color.textSecondary, fontSize: 12, fontWeight: "700" }}>
                      Catatan Jurnal Lainnya ({standaloneEntries.length})
                    </Text>
                    {standaloneEntries.map((entry) => (
                      <View
                        key={entry.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: spacing.sm,
                          padding: spacing.sm,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: color.border,
                          backgroundColor: color.surfaceAlt,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={2}>
                            {entry.memo}
                          </Text>
                          <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 2 }}>
                            {ACCOUNT_LABEL[entry.account] ?? entry.account} · {entry.direction === "debit" ? "Debit" : "Kredit"}
                          </Text>
                        </View>
                        <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "700" }}>
                          {formatRupiah(entry.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <Button label="Tutup" variant="secondary" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      )}
    </BottomSheet>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xs, paddingVertical: 4 }}>
      <Text style={{ color: color.textMuted, fontSize: 10 }} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ color: tone, fontSize: 13, fontWeight: "700", marginTop: 1 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {formatRupiah(value)}
      </Text>
    </View>
  );
}

function JournalTxCard({ tx, journalDate, onPress }: { tx: JournalDayTx; journalDate: string; onPress: () => void }) {
  const isVoid = tx.status === "void";
  const when = new Date(tx.createdAt);
  const localDay = isoToLocalDateString(tx.createdAt);
  const timeText = when.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateHint = localDay && localDay !== journalDate ? `${formatShortDateId(localDay, false)}, ` : "";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 60,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: color.border,
        backgroundColor: pressed ? color.surfaceAlt : color.surface,
        opacity: isVoid ? 0.65 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "700" }}>{tx.receiptNo}</Text>
          {tx.editedAt && <Tag label="Diedit" bg="#FBEBD0" fg="#8A5A12" />}
          {isVoid && <Tag label="Void" bg="#F6D9DD" fg={color.danger} />}
        </View>
        <Text style={{ color: color.textSecondary, fontSize: 13, fontWeight: "500", marginTop: 2 }} numberOfLines={2}>
          {tx.itemsPreview}
        </Text>
        <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
          {dateHint}
          {timeText} · {tx.customerName ?? "Umum"} · {METHOD_LABEL[tx.paymentMethod] ?? tx.paymentMethod}
          {tx.cashierName ? ` · Kasir: ${tx.cashierName}` : ""}
        </Text>
      </View>
      <Text
        style={{
          color: color.primaryDeep,
          fontSize: 14,
          fontWeight: "700",
          textDecorationLine: isVoid ? "line-through" : "none",
        }}
      >
        {formatRupiah(tx.grandTotal)}
      </Text>
      <Icon name="chevronRight" color={color.textMuted} size={16} />
    </Pressable>
  );
}

function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: fg }}>{label}</Text>
    </View>
  );
}
