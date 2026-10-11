import { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { color, radius, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { useInventoryStore } from "@/store/inventoryStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import type { InventoryItem } from "@/types";

export function InventoryScreen() {
  const { posGridColumns } = useResponsiveLayout();
  const items = useInventoryStore((s) => s.items);
  const lowStockItems = useInventoryStore((s) => s.lowStockItems);
  const loadInventory = useInventoryStore((s) => s.loadInventory);
  const adjustStock = useInventoryStore((s) => s.adjustStock);
  const [query, setQuery] = useState("");
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [delta, setDelta] = useState("");

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
  const columns = Math.max(1, posGridColumns - 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ padding: spacing.md }}>
        <Text style={{ color: color.textPrimary, fontSize: 20, fontWeight: "700" }}>Inventaris</Text>

        {lowStockItems.length > 0 && (
          <Card style={{ marginTop: spacing.sm, borderColor: color.danger }}>
            <Text style={{ color: color.danger, fontSize: 13, fontWeight: "700" }}>
              ⚠ {lowStockItems.length} item stok menipis
            </Text>
            <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 2 }}>
              {lowStockItems.map((i) => i.name).join(", ")}
            </Text>
          </Card>
        )}

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari item..."
          placeholderTextColor={color.textMuted}
          style={{
            backgroundColor: color.surfaceAlt,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.border,
            color: color.textPrimary,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            marginTop: spacing.sm,
          }}
        />
      </View>

      <FlatList
        key={columns}
        data={filtered}
        keyExtractor={(i) => i.itemId}
        numColumns={columns}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0, gap: spacing.sm }}
        columnWrapperStyle={columns > 1 ? { gap: spacing.sm } : undefined}
        renderItem={({ item }) => {
          const low = item.stockQty <= item.lowStockThreshold;
          return (
            <Card style={{ flex: 1 / columns, borderColor: low ? color.danger : color.border }}>
              <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 2, textTransform: "capitalize" }}>
                {item.category.replace("_", " ")}
              </Text>
              <Text style={{ color: low ? color.danger : color.textSecondary, fontSize: 16, fontWeight: "700", marginTop: spacing.xs }}>
                {item.stockQty} {item.unit}
              </Text>
              {item.sellPrice != null && (
                <Text style={{ color: color.primary, fontSize: 12, marginTop: 2 }}>{formatRupiah(item.sellPrice)}</Text>
              )}
              <Button
                label="Sesuaikan stok"
                size="sm"
                variant="secondary"
                style={{ marginTop: spacing.sm }}
                onPress={() => {
                  setAdjusting(item);
                  setDelta("");
                }}
              />
            </Card>
          );
        }}
      />

      {adjusting && (
        <View
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.lg }}
        >
          <Card raised>
            <Text style={{ color: color.textPrimary, fontWeight: "700", marginBottom: spacing.sm }}>{adjusting.name}</Text>
            <Text style={{ color: color.textSecondary, fontSize: 12, marginBottom: spacing.xs }}>
              Stok saat ini: {adjusting.stockQty} {adjusting.unit}. Masukkan perubahan (+/-).
            </Text>
            <TextInput
              value={delta}
              onChangeText={setDelta}
              keyboardType="numbers-and-punctuation"
              placeholder="contoh: -2 atau 10"
              placeholderTextColor={color.textMuted}
              style={{
                backgroundColor: color.surfaceAlt,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.border,
                color: color.textPrimary,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Button label="Batal" variant="secondary" style={{ flex: 1 }} onPress={() => setAdjusting(null)} />
              <Button
                label="Simpan"
                style={{ flex: 1 }}
                onPress={async () => {
                  const d = Number(delta);
                  if (!Number.isFinite(d) || d === 0) return;
                  await adjustStock(adjusting.itemId, d, "manual adjustment");
                  setAdjusting(null);
                }}
              />
            </View>
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}
