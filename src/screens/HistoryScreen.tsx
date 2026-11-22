import { useCallback, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Chip } from "@/components/common/Chip";
import { Icon } from "@/components/common/Icon";
import { DateRangePickerModal, type AppliedDateRange } from "@/components/history/DateRangePickerModal";
import { EditTransactionModal } from "@/components/history/EditTransactionModal";
import { TransactionDetailSheet } from "@/components/history/TransactionDetailSheet";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, radius, spacing } from "@/constants/theme";
import { useCloud } from "@/services/cloudSync";
import {
  computePeriodBounds,
  loadTransaction,
  queryTransactions,
  type HistoryDateBounds,
  type HistoryPeriod,
  type HistoryQueryResult,
  type TxSummary,
} from "@/services/transactionRepo";
import { useAuthStore, PERMISSIONS } from "@/store/authStore";
import { countInclusiveDays, formatDateRangeLabel, isoToLocalDateString } from "@/utils/dateFormat";
import { formatRupiah } from "@/utils/money";
import { METHOD_LABEL } from "@/utils/receiptText";
import type { Transaction } from "@/types";

const PERIODS: { key: Exclude<HistoryPeriod, "custom">; label: string }[] = [
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "all", label: "Semua" },
];

const INITIAL_LIMIT = 300;
const EMPTY_RESULT: HistoryQueryResult = {
  rows: [],
  totalCount: 0,
  paidCount: 0,
  paidTotal: 0,
  minCreatedAt: null,
  maxCreatedAt: null,
};

type Sheet = "detail" | "edit" | "range" | null;

/** Riwayat transaksi: cari, filter rentang tanggal, lihat, cetak ulang struk, dan (admin) koreksi input yang salah. */
export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { listColumns, width, pagePadding } = useResponsiveLayout();
  const role = useAuthStore((s) => s.currentEmployee?.role);
  const canEdit = !!role && PERMISSIONS.transactionEdit.includes(role);
  const syncVersion = useCloud((c) => c.version);

  const [period, setPeriod] = useState<HistoryPeriod>("today");
  const [windowOffset, setWindowOffset] = useState(0);
  const [customRange, setCustomRange] = useState<HistoryDateBounds>({ fromDate: null, toDate: null });
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<HistoryQueryResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const activeBounds: HistoryDateBounds =
    period === "custom" ? customRange : computePeriodBounds(period, windowOffset);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await queryTransactions({
        period,
        fromDate: activeBounds.fromDate,
        toDate: activeBounds.toDate,
        query,
        limit,
      });
      setResult(next);
    } finally {
      setLoading(false);
    }
  }, [period, activeBounds.fromDate, activeBounds.toDate, query, limit]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload, syncVersion])
  );

  function selectPreset(next: Exclude<HistoryPeriod, "custom">) {
    setPeriod(next);
    setWindowOffset(0);
    setLimit(INITIAL_LIMIT);
  }

  function stepWindow(delta: number) {
    setWindowOffset((prev) => Math.min(0, prev + delta));
    setLimit(INITIAL_LIMIT);
  }

  function handleApplyRange(picked: AppliedDateRange) {
    setSheet(null);
    setLimit(INITIAL_LIMIT);
    if (!picked.fromDate && !picked.toDate) {
      setPeriod("all");
      setWindowOffset(0);
      setCustomRange({ fromDate: null, toDate: null });
      return;
    }
    setPeriod("custom");
    setCustomRange(picked);
  }

  async function open(row: TxSummary) {
    const full = await loadTransaction(row.localId);
    if (!full) return Alert.alert("Transaksi tidak ditemukan");
    setTx(full);
    setSheet("detail");
  }

  function handleSaved(updated: Transaction) {
    setTx(updated);
    setSheet("detail");
    reload();
    Alert.alert("Transaksi diperbarui", "Tekan Cetak ulang struk untuk mencetak versi yang benar.");
  }

  const rows = result.rows;
  const isTruncated = result.totalCount > rows.length;
  const canStepWindow = period === "today" || period === "7d" || period === "30d";

  // Pada filter "Semua", tampilkan rentang tanggal aktual data yang tersimpan.
  const actualFrom = result.minCreatedAt ? isoToLocalDateString(result.minCreatedAt) : null;
  const actualTo = result.maxCreatedAt ? isoToLocalDateString(result.maxCreatedAt) : null;
  const displayFrom = period === "all" ? actualFrom : activeBounds.fromDate;
  const displayTo = period === "all" ? actualTo : activeBounds.toDate;
  const rangeLabel = formatDateRangeLabel(displayFrom, displayTo);
  const rangeDays = displayFrom && displayTo ? countInclusiveDays(displayFrom, displayTo) : null;

  let rangeCaption: string;
  if (period === "today") {
    rangeCaption = windowOffset === 0 ? "Hari ini · Tap untuk atur rentang" : "Tap untuk atur rentang";
  } else if (period === "7d") {
    rangeCaption = "Rentang 7 hari · Geser atau tap untuk ubah";
  } else if (period === "30d") {
    rangeCaption = "Rentang 30 hari · Geser atau tap untuk ubah";
  } else if (period === "all") {
    rangeCaption =
      result.totalCount > 0
        ? `Semua data${rangeDays ? ` (${rangeDays} hari)` : ""} · Maks. ${limit}/muat · Tap atur batas`
        : "Tanpa batas tanggal · Tap untuk atur batas";
  } else {
    rangeCaption = `${rangeDays ? `Rentang khusus (${rangeDays} hari)` : "Rentang khusus"} · Tap untuk ubah`;
  }

  const columns = listColumns >= 2 ? 2 : 1;
  const maxCardWidth =
    columns > 1 ? Math.floor((width - pagePadding * 2 - spacing.xs * (columns - 1)) / columns) : undefined;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Riwayat Transaksi" />

      <View style={{ paddingHorizontal: pagePadding, gap: spacing.sm }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 46,
            gap: spacing.xs,
            backgroundColor: color.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: color.border,
            paddingHorizontal: spacing.sm,
          }}
        >
          <Icon name="search" color={color.textMuted} size={18} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setLimit(INITIAL_LIMIT);
            }}
            placeholder="Cari nomor struk atau nama pelanggan"
            placeholderTextColor={color.textMuted}
            autoCapitalize="none"
            style={{ flex: 1, color: color.textPrimary, paddingVertical: 10, fontSize: 15 }}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={8}
              accessibilityLabel="Hapus pencarian"
              style={{ minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: color.textMuted, fontSize: 15, fontWeight: "700" }}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => selectPreset(p.key)} />
          ))}
          <Chip label="Rentang" active={period === "custom"} onPress={() => setSheet("range")} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {canStepWindow && (
            <Pressable
              onPress={() => stepWindow(-1)}
              accessibilityLabel="Periode sebelumnya"
              hitSlop={4}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 44,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.border,
                backgroundColor: pressed ? color.surfaceAlt : color.surface,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Icon name="chevronLeft" color={color.textPrimary} size={18} />
            </Pressable>
          )}

          <Pressable
            onPress={() => setSheet("range")}
            accessibilityLabel="Atur rentang tanggal transaksi"
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: period === "custom" ? color.primary : color.border,
              backgroundColor: pressed ? color.surfaceAlt : color.surface,
            })}
          >
            <Icon name="calendar" color={color.primaryDeep} size={16} />
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: color.textPrimary, fontSize: 13, fontWeight: "700" }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {rangeLabel}
              </Text>
              <Text style={{ color: color.textMuted, fontSize: 11 }} numberOfLines={1}>
                {rangeCaption}
              </Text>
            </View>
          </Pressable>

          {canStepWindow && (
            <Pressable
              onPress={() => stepWindow(1)}
              disabled={windowOffset >= 0}
              accessibilityLabel="Periode berikutnya"
              hitSlop={4}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 44,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.border,
                backgroundColor: pressed ? color.surfaceAlt : color.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: windowOffset >= 0 ? 0.4 : 1,
              })}
            >
              <Icon name="chevronRight" color={color.textPrimary} size={18} />
            </Pressable>
          )}

          {period === "custom" && (
            <Pressable
              onPress={() => selectPreset("all")}
              accessibilityLabel="Reset batas tanggal"
              hitSlop={4}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 44,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.border,
                backgroundColor: pressed ? color.surfaceAlt : color.surface,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Text style={{ color: color.primaryDeep, fontSize: 12, fontWeight: "700" }}>Reset</Text>
            </Pressable>
          )}
        </View>

        <Text style={{ color: color.textSecondary, fontSize: 12 }}>
          {result.paidCount} transaksi lunas · {formatRupiah(result.paidTotal)}
          {isTruncated ? ` (tampil ${rows.length} terbaru dari ${result.totalCount})` : ""}
        </Text>

        {isTruncated && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.xs,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: radius.md,
              backgroundColor: color.surfaceAlt,
              borderWidth: 1,
              borderColor: color.border,
            }}
          >
            <Text style={{ flex: 1, color: color.textSecondary, fontSize: 11 }}>
              Batas tampilan {rows.length} dari {result.totalCount} transaksi. Persempit tanggal atau muat lebih banyak.
            </Text>
            <Pressable onPress={() => setLimit((n) => n + INITIAL_LIMIT)} hitSlop={8}>
              <Text style={{ color: color.primaryDeep, fontSize: 12, fontWeight: "700" }}>+{INITIAL_LIMIT}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {loading && rows.length === 0 ? (
        <ActivityIndicator color={color.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          key={columns}
          data={rows}
          keyExtractor={(r) => r.localId}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: spacing.xs } : undefined}
          contentContainerStyle={{ padding: pagePadding, paddingBottom: spacing.md + insets.bottom, gap: spacing.xs }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={{ color: color.textMuted, textAlign: "center", marginTop: spacing.xl }}>
              Belum ada transaksi pada rentang tanggal ini.
            </Text>
          }
          renderItem={({ item: r }) => <Row row={r} maxWidth={maxCardWidth} onPress={() => open(r)} />}
        />
      )}

      <DateRangePickerModal
        visible={sheet === "range"}
        fromDate={activeBounds.fromDate}
        toDate={activeBounds.toDate}
        onClose={() => setSheet(null)}
        onApply={handleApplyRange}
      />
      <TransactionDetailSheet
        visible={sheet === "detail"}
        tx={tx}
        canEdit={canEdit}
        onClose={() => setSheet(null)}
        onEdit={() => setSheet("edit")}
      />
      <EditTransactionModal visible={sheet === "edit"} tx={tx} onClose={() => setSheet("detail")} onSaved={handleSaved} />
    </SafeAreaView>
  );
}

function Row({ row, maxWidth, onPress }: { row: TxSummary; maxWidth?: number; onPress: () => void }) {
  const isVoid = row.status === "void";
  const when = new Date(row.createdAt);
  const differentYear = when.getFullYear() !== new Date().getFullYear();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        maxWidth,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: color.border,
        backgroundColor: pressed ? color.surfaceAlt : color.surface,
        opacity: isVoid ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "700" }}>{row.receiptNo}</Text>
          {row.editedAt && <Tag label="Diedit" bg="#FBEBD0" fg="#8A5A12" />}
          {isVoid && <Tag label="Void" bg="#F6D9DD" fg={color.danger} />}
        </View>
        <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {when.toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            ...(differentYear ? { year: "2-digit" } : {}),
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {row.customerName ?? "Umum"} · {row.itemCount} item · {METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
        </Text>
      </View>
      <Text style={{ color: color.primaryDeep, fontSize: 15, fontWeight: "700", textDecorationLine: isVoid ? "line-through" : "none" }}>
        {formatRupiah(row.grandTotal)}
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
