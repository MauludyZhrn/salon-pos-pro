import { useMemo, useState, type ReactNode } from "react";
import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Icon } from "@/components/common/Icon";
import { color, elevation, font, radius, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { usePosStore } from "@/store/posStore";
import { usePromoStore } from "@/store/promoStore";
import { QtyInputModal } from "@/components/common/QtyInputModal";
import { badgeFor, evaluateRules, rulesForItem } from "@/utils/promotions";
import type { AdjustmentRule, CatalogItem } from "@/types";

interface ProductGridProps {
  items: CatalogItem[];
  onSelect: (item: CatalogItem) => void;
  /** Scrolls away with the list (greeting, sales banner). */
  header?: ReactNode;
  /** Extra bottom padding so a floating bar never covers the last row. */
  bottomInset?: number;
}

const CATEGORY_ORDER = ["haircut", "coloring", "spa"];
const RETAIL_CHIP = "retail";
const TINTS = ["#F4C5D7", "#FEC9C3", "#F9ADB7", "#FAF2DD"];

function tintFor(category: string) {
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h + category.charCodeAt(i)) % TINTS.length;
  return TINTS[h];
}

/**
 * The core POS grid. Column count is computed from live width via
 * useResponsiveLayout, so rotating the device re-renders with a new column
 * count on the same frame as the dimension change.
 */
export function ProductGrid({ items, onSelect, header, bottomInset = 0 }: ProductGridProps) {
  const { posGridColumns } = useResponsiveLayout();
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const lines = usePosStore((s) => s.lines);
  const addItem = usePosStore((s) => s.addItem);
  const promos = usePromoStore((s) => s.promos);
  const [qtyItem, setQtyItem] = useState<CatalogItem | null>(null);

  const qtyById = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.item.id, (m.get(l.item.id) ?? 0) + l.qty);
    return m;
  }, [lines]);

  // Service categories become chips; every retail product (any category, including
  // ones added later from Inventaris) is grouped under one "Retail" chip.
  const categories = useMemo(() => {
    const set = new Set(items.filter((i) => i.type === "service").map((i) => i.category));
    const services = CATEGORY_ORDER.filter((c) => set.has(c)).concat(Array.from(set).filter((c) => !CATEGORY_ORDER.includes(c)));
    return items.some((i) => i.type === "retail") ? [...services, RETAIL_CHIP] : services;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (activeCategory === RETAIL_CHIP) {
        if (i.type !== "retail") return false;
      } else if (activeCategory !== "all" && i.category !== activeCategory) return false;
      if (query && !i.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [items, activeCategory, query]);

  const listHeader = (
    <View>
      {header}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          backgroundColor: color.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color.border,
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.sm,
        }}
      >
        <Icon name="search" color={color.textMuted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari layanan atau produk"
          placeholderTextColor={color.textMuted}
          style={{ flex: 1, color: color.textPrimary, paddingVertical: spacing.sm, fontSize: 15 }}
        />
      </View>

      <Text style={{ color: color.textMuted, fontSize: 11, marginBottom: spacing.xs }}>
        Ketuk untuk menambah 1. Tahan produk untuk mengisi jumlah.
      </Text>

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
                paddingVertical: 7,
                borderRadius: radius.pill,
                backgroundColor: active ? color.primary : color.surface,
                borderWidth: 1,
                borderColor: active ? color.primary : color.borderStrong,
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
                {cat === "all" ? "Semua" : cat.replace(/-/g, " ")}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );

  return (
    <>
    <FlatList
      key={posGridColumns} // force re-layout when column count changes across rotation
      data={filtered}
      keyExtractor={(i) => i.id}
      numColumns={posGridColumns}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <Text style={{ color: color.textMuted, textAlign: "center", marginTop: spacing.lg }}>
          Belum ada layanan atau produk yang cocok.
        </Text>
      }
      columnWrapperStyle={posGridColumns > 1 ? { gap: spacing.sm } : undefined}
      contentContainerStyle={{ gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.xl + bottomInset }}
      renderItem={({ item }) => (
        <ProductCard
          item={item}
          columns={posGridColumns}
          qty={qtyById.get(item.id) ?? 0}
          rules={rulesForItem(item, promos)}
          onAdd={() => onSelect(item)}
          onLongPress={() => setQtyItem(item)}
        />
      )}
    />
    <QtyInputModal
      visible={qtyItem !== null}
      title={qtyItem?.name ?? ""}
      subtitle="Berapa yang ditambahkan ke keranjang?"
      initial={1}
      confirmLabel="Tambah"
      onClose={() => setQtyItem(null)}
      onConfirm={(qty) => {
        if (qtyItem) addItem(qtyItem, null, qty);
        setQtyItem(null);
      }}
    />
    </>
  );
}

function ProductCard({
  item,
  columns,
  qty,
  rules,
  onAdd,
  onLongPress,
}: {
  item: CatalogItem;
  columns: number;
  qty: number;
  rules: AdjustmentRule[];
  onAdd: () => void;
  onLongPress: () => void;
}) {
  const unit = evaluateRules(item.price, 1, rules);
  const netPrice = item.price - unit.discount;
  const badge = badgeFor(rules, item.price);
  return (
    <Pressable
      onPress={onAdd}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => ({
        flex: 1 / columns,
        backgroundColor: color.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: color.border,
        overflow: "hidden",
        opacity: pressed ? 0.85 : 1,
        ...elevation.card,
      })}
    >
      <View style={{ height: 92, backgroundColor: tintFor(item.category), alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: font.display, fontSize: 38, color: color.primaryDeep, opacity: 0.5 }}>
          {item.name.trim().charAt(0).toUpperCase()}
        </Text>
        {item.type === "retail" && (
          <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: color.surface, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: color.textSecondary }}>Retail</Text>
          </View>
        )}
        {badge && (
          <View
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              maxWidth: "90%",
              backgroundColor: badge.tone === "discount" ? "#2F9E63" : "#D9953E",
              borderRadius: radius.pill,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF" }}>
              {badge.text}
            </Text>
          </View>
        )}
        {qty > 0 && (
          <View style={{ position: "absolute", top: 8, right: 8, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: color.textOnPrimary }}>{qty}</Text>
          </View>
        )}
      </View>

      <View style={{ padding: spacing.sm }}>
        <Text numberOfLines={2} style={{ color: color.textPrimary, fontSize: 14, fontWeight: "600", minHeight: 36 }}>
          {item.name}
        </Text>
        <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 2, minHeight: 14 }}>
          {item.durationMinutes ? `${item.durationMinutes} menit` : ""}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs }}>
          <View style={{ flexShrink: 1 }}>
            {unit.discount > 0 && (
              <Text style={{ color: color.textMuted, fontSize: 11, textDecorationLine: "line-through" }} numberOfLines={1}>
                {formatRupiah(item.price)}
              </Text>
            )}
            <Text style={{ color: color.primaryDeep, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
              {formatRupiah(netPrice)}
            </Text>
            {unit.extra > 0 && (
              <Text style={{ color: "#8A5A12", fontSize: 10, fontWeight: "600" }} numberOfLines={1}>
                + {formatRupiah(unit.extra)} biaya
              </Text>
            )}
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="plus" color={color.primaryDeep} size={18} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
