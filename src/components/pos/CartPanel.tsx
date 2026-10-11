import { View, Text, FlatList, Pressable } from "react-native";
import { color, radius, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { Button } from "@/components/common/Button";
import { usePosStore } from "@/store/posStore";

interface CartPanelProps {
  onCheckout: () => void;
}

/**
 * Cart + running totals. Rendered either as a fixed side rail (tablet /
 * landscape, via useSidePanel) or a bottom sheet (phone portrait) by the
 * parent screen — this component itself is orientation-agnostic, it just
 * fills whatever container it's given.
 */
export function CartPanel({ onCheckout }: CartPanelProps) {
  const lines = usePosStore((s) => s.lines);
  const removeLine = usePosStore((s) => s.removeLine);
  const updateLineQty = usePosStore((s) => s.updateLineQty);
  const totals = usePosStore((s) => s.totals());

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: color.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm }}>
        Keranjang ({lines.length})
      </Text>

      <FlatList
        data={lines}
        keyExtractor={(l) => l.lineId}
        contentContainerStyle={{ gap: spacing.xs }}
        ListEmptyComponent={
          <Text style={{ color: color.textMuted, fontSize: 13, textAlign: "center", marginTop: spacing.lg }}>
            Belum ada item
          </Text>
        }
        renderItem={({ item: line }) => (
          <View
            style={{
              backgroundColor: color.surfaceAlt,
              borderRadius: radius.md,
              padding: spacing.sm,
              borderWidth: 1,
              borderColor: color.border,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                {line.item.name}
              </Text>
              <Pressable onPress={() => removeLine(line.lineId)} hitSlop={8}>
                <Text style={{ color: color.danger, fontSize: 13, fontWeight: "600" }}>Hapus</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xxs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                <Pressable
                  onPress={() => updateLineQty(line.lineId, Math.max(1, line.qty - 1))}
                  style={{ width: 26, height: 26, borderRadius: radius.sm, backgroundColor: color.surfaceRaised, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: color.textPrimary }}>−</Text>
                </Pressable>
                <Text style={{ color: color.textSecondary, fontSize: 13, minWidth: 18, textAlign: "center" }}>{line.qty}</Text>
                <Pressable
                  onPress={() => updateLineQty(line.lineId, line.qty + 1)}
                  style={{ width: 26, height: 26, borderRadius: radius.sm, backgroundColor: color.surfaceRaised, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: color.textPrimary }}>+</Text>
                </Pressable>
              </View>
              <Text style={{ color: color.primary, fontSize: 14, fontWeight: "700" }}>{formatRupiah(line.lineTotal)}</Text>
            </View>
          </View>
        )}
      />

      <View style={{ borderTopWidth: 1, borderTopColor: color.border, marginTop: spacing.sm, paddingTop: spacing.sm, gap: spacing.xxs }}>
        <Row label="Subtotal" value={formatRupiah(totals.subtotal)} />
        {totals.discountTotal > 0 && <Row label="Diskon" value={`-${formatRupiah(totals.discountTotal)}`} muted />}
        <Row label="Pajak (PPN)" value={formatRupiah(totals.taxTotal)} muted />
        <Row label="Total" value={formatRupiah(totals.grandTotal)} emphasis />

        <Button
          label="Bayar"
          size="lg"
          fullWidth
          disabled={lines.length === 0}
          onPress={onCheckout}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </View>
  );
}

function Row({ label, value, muted, emphasis }: { label: string; value: string; muted?: boolean; emphasis?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: muted ? color.textMuted : color.textSecondary, fontSize: emphasis ? 15 : 13 }}>{label}</Text>
      <Text
        style={{
          color: emphasis ? color.primary : muted ? color.textMuted : color.textPrimary,
          fontSize: emphasis ? 17 : 13,
          fontWeight: emphasis ? "700" : "500",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
