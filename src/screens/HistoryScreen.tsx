import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Chip } from "@/components/common/Chip";
import { Icon } from "@/components/common/Icon";
import { EditTransactionModal } from "@/components/history/EditTransactionModal";
import { TransactionDetailSheet } from "@/components/history/TransactionDetailSheet";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, radius, spacing } from "@/constants/theme";
import { useCloud } from "@/services/cloudSync";
import { listTransactions, loadTransaction, type HistoryPeriod, type TxSummary } from "@/services/transactionRepo";
import { useAuthStore, PERMISSIONS } from "@/store/authStore";
import { formatRupiah } from "@/utils/money";
import { METHOD_LABEL } from "@/utils/receiptText";
import type { Transaction } from "@/types";

const PERIODS: { key: HistoryPeriod; label: string }[] = [
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 hari" },
  { key: "30d", label: "30 hari" },
  { key: "all", label: "Semua" },
];

type Sheet = "detail" | "edit" | null;

/** Riwayat transaksi: cari, lihat, cetak ulang struk, dan (admin) koreksi input yang salah. */
export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { listColumns, width, pagePadding } = useResponsiveLayout();
  const role = useAuthStore((s) => s.currentEmployee?.role);
  const canEdit = !!role && PERMISSIONS.transactionEdit.includes(role);
  const syncVersion = useCloud((c) => c.version);

  const [period, setPeriod] = useState<HistoryPeriod>("today");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<TxSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listTransactions({ period, query }));
    } finally {
      setLoading(false);
    }
  }, [period, query]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload, syncVersion])
  );

  const summary = useMemo(() => {
    const paid = rows.filter((r) => r.status === "paid");
    return { count: paid.length, total: paid.reduce((s, r) => s + r.grandTotal, 0) };
  }, [rows]);

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
            onChangeText={setQuery}
            placeholder="Cari nomor struk atau nama pelanggan"
            placeholderTextColor={color.textMuted}
            autoCapitalize="none"
            style={{ flex: 1, color: color.textPrimary, paddingVertical: 10, fontSize: 15 }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />
          ))}
        </View>

        <Text style={{ color: color.textSecondary, fontSize: 12 }}>
          {summary.count} transaksi lunas · {formatRupiah(summary.total)}
        </Text>
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
            <Text style={{ color: color.textMuted, textAlign: "center", marginTop: spacing.xl }}>Belum ada transaksi pada periode ini.</Text>
          }
          renderItem={({ item: r }) => <Row row={r} maxWidth={maxCardWidth} onPress={() => open(r)} />}
        />
      )}

      <TransactionDetailSheet visible={sheet === "detail"} tx={tx} canEdit={canEdit} onClose={() => setSheet(null)} onEdit={() => setSheet("edit")} />
      <EditTransactionModal visible={sheet === "edit"} tx={tx} onClose={() => setSheet("detail")} onSaved={handleSaved} />
    </SafeAreaView>
  );
}

function Row({ row, maxWidth, onPress }: { row: TxSummary; maxWidth?: number; onPress: () => void }) {
  const isVoid = row.status === "void";
  const when = new Date(row.createdAt);
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
          {when.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {row.customerName ?? "Umum"} · {row.itemCount} item ·{" "}
          {METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod}
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
