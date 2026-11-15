import { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloud } from "@/services/cloudSync";
import { Card } from "@/components/common/Card";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Icon } from "@/components/common/Icon";
import { Button } from "@/components/common/Button";
import { BottomSheet } from "@/components/common/BottomSheet";
import { color, font, radius, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { useInventoryStore } from "@/store/inventoryStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { ItemFormModal } from "@/components/inventory/ItemFormModal";
import type { InventoryItem } from "@/types";

export function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { inventoryColumns, width, pagePadding } = useResponsiveLayout();
  const items = useInventoryStore((s) => s.items);
  const lowStockItems = useInventoryStore((s) => s.lowStockItems);
  const loadInventory = useInventoryStore((s) => s.loadInventory);
  const adjustStock = useInventoryStore((s) => s.adjustStock);
  const [query, setQuery] = useState("");
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [delta, setDelta] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const syncVersion = useCloud((c) => c.version);
  useEffect(() => {
    loadInventory();
  }, [loadInventory, syncVersion]);

  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
  const columns = inventoryColumns;
  const maxCardWidth =
    columns > 1 ? Math.floor((width - pagePadding * 2 - spacing.sm * (columns - 1)) / columns) : undefined;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader
        title="Inventaris"
        right={
          <Pressable
            onPress={() => setAddOpen(true)}
            hitSlop={8}
            accessibilityLabel="Tambah produk"
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: color.primary }}
          >
            <Icon name="plus" color={color.textOnPrimary} size={20} />
          </Pressable>
        }
      />
      <View style={{ paddingHorizontal: pagePadding, paddingBottom: spacing.xs }}>
        {lowStockItems.length > 0 && (
          <Card style={{ marginTop: spacing.xs, borderColor: color.danger }}>
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
            minHeight: 46,
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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: pagePadding, paddingTop: 0, paddingBottom: spacing.md + insets.bottom, gap: spacing.sm }}
        columnWrapperStyle={columns > 1 ? { gap: spacing.sm } : undefined}
        ListEmptyComponent={
          <Text style={{ color: color.textMuted, textAlign: "center", marginTop: spacing.lg }}>
            Belum ada produk. Ketuk tombol + di kanan atas.
          </Text>
        }
        renderItem={({ item }) => {
          const low = item.stockQty <= item.lowStockThreshold;
          return (
            <Card style={{ flex: 1, maxWidth: maxCardWidth, borderColor: low ? color.danger : color.border }}>
              <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 2, textTransform: "capitalize" }}>
                {item.category.replace("_", " ")}
              </Text>
              <Text style={{ color: low ? color.danger : color.textSecondary, fontSize: 16, fontWeight: "700", marginTop: spacing.xs }}>
                {item.stockQty} {item.unit}
              </Text>
              {item.sellPrice != null && (
                <Text style={{ color: color.primaryDeep, fontSize: 13, fontWeight: "600", marginTop: 2 }}>{formatRupiah(item.sellPrice)}</Text>
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm }}>
                <Button
                  label="Sesuaikan stok"
                  size="sm"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setAdjusting(item);
                    setDelta("");
                  }}
                />
                <Button label="Edit" size="sm" variant="ghost" onPress={() => setEditingItem(item)} />
              </View>
            </Card>
          );
        }}
      />

      <ItemFormModal visible={addOpen} onClose={() => setAddOpen(false)} />
      <ItemFormModal visible={editingItem !== null} item={editingItem} onClose={() => setEditingItem(null)} />

      <BottomSheet visible={adjusting !== null} onClose={() => setAdjusting(null)}>
        {adjusting && (
          <View>
            <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600" }}>{adjusting.name}</Text>
            <Text style={{ color: color.textSecondary, fontSize: 12, marginVertical: spacing.sm }}>
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
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
