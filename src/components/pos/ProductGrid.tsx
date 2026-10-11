import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, radius, spacing, type as typeScale } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import type { CatalogItem } from "@/types";

interface ProductGridProps {
  items: CatalogItem[];
  onSelect: (item: CatalogItem) => void;
}

const CATEGORY_ORDER = ["haircut", "coloring", "spa", "retail-haircare", "retail-skincare"];

/**
 * The core POS grid. Column count is computed from live width via
 * useResponsiveLayout — rotating the device re-renders with a new column
 * count on the same frame as the dimension change, no separate listener,
 * no layout jump.
 */
export function ProductGrid({ items, onSelect }: ProductGridProps) {
  const { posGridColumns, orientation } = useResponsiveLayout();
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return CATEGORY_ORDER.filter((c) => set.has(c)).concat(Array.from(set).filter((c) => !CATEGORY_ORDER.includes(c)));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (activeCategory !== "all" && i.category !== activeCategory) return false;
      if (query && !i.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [items, activeCategory, query]);

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Cari layanan atau produk..."
        placeholderTextColor={color.textMuted}
        style={{
          backgroundColor: color.surfaceAlt,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.border,
          color: color.textPrimary,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          marginBottom: spacing.sm,
          fontSize: typeScale.body.fontSize,
        }}
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={["all", ...categories]}
        keyExtractor={(c) => c}
        style={{ flexGrow: 0, marginBottom: spacing.sm }}
        contentContainerStyle={{ gap: spacing.xs }}
        renderItem={({ item: cat }) => {
          const active = activeCategory === cat;
          return (
            <Pressable
              onPress={() => setActiveCategory(cat)}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: active ? color.primary : color.surfaceAlt,
                borderWidth: 1,
                borderColor: active ? color.primary : color.border,
              }}
            >
              <Text
                style={{
                  color: active ? color.textOnPrimary : color.textSecondary,
                  fontSize: 13,
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {cat === "all" ? "Semua" : cat.replace("-", " ")}
              </Text>
            </Pressable>
          );
        }}
      />

      <FlatList
        key={posGridColumns} // force re-layout when column count changes across rotation
        data={filtered}
        keyExtractor={(i) => i.id}
        numColumns={posGridColumns}
        columnWrapperStyle={posGridColumns > 1 ? { gap: spacing.sm } : undefined}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => ({
              flex: 1 / posGridColumns,
              backgroundColor: pressed ? color.surfaceRaised : color.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: color.border,
              padding: spacing.sm,
              minHeight: orientation === "landscape" ? 96 : 110,
              justifyContent: "space-between",
            })}
          >
            <View>
              <Text numberOfLines={2} style={{ color: color.textPrimary, fontSize: 14, fontWeight: "600" }}>
                {item.name}
              </Text>
              {item.durationMinutes ? (
                <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 2 }}>
                  {item.durationMinutes} menit
                </Text>
              ) : null}
            </View>
            <Text style={{ color: color.primary, fontSize: 15, fontWeight: "700", marginTop: spacing.xs }}>
              {formatRupiah(item.price)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
