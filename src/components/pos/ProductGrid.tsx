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
  const { posGridColumns, catalogWidth, isCompactHeight, isSmallPhone, pagePadding } = useResponsiveLayout();
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

  const gap = isSmallPhone ? spacing.xs : spacing.sm;
  const maxCardWidth =
    posGridColumns > 1
      ? Math.floor((catalogWidth - pagePadding * 2 - gap * (posGridColumns - 1)) / posGridColumns)
      : undefined;

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
          minHeight: 46,
          marginBottom: spacing.xs,
        }}
      >
        <Icon name="search" color={color.textMuted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari layanan atau produk"
          placeholderTextColor={color.textMuted}
          style={{ flex: 1, color: color.textPrimary, paddingVertical: 10, fontSize: 15 }}
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => setQuery("")}
            hitSlop={10}
            accessibilityLabel="Bersihkan pencarian"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: color.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: color.textSecondary, fontSize: 13, fontWeight: "700" }}>✕</Text>
          </Pressable>
        )}
      </View>

      {!isCompactHeight && (
        <Text style={{ color: color.textMuted, fontSize: 11, marginBottom: spacing.xs }}>
          Ketuk untuk menambah 1. Tahan produk untuk mengisi jumlah.
        </Text>
      )}

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={["all", ...categories]}
        keyExtractor={(c) => c}
        style={{ flexGrow: 0, marginBottom: spacing.xs }}
        contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}
        renderItem={({ item: cat }) => {
          const active = activeCategory === cat;
          return (
            <Pressable
              onPress={() => setActiveCategory(cat)}
              hitSlop={6}
              style={({ pressed }) => ({
                minHeight: 38,
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: 8,
                borderRadius: radius.pill,
                backgroundColor: active ? color.primary : pressed ? color.surfaceAlt : color.surface,
                borderWidth: 1,
                borderColor: active ? color.primary : color.borderStrong,
                alignItems: "center",
                justifyContent: "center",
              })}
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
        columnWrapperStyle={posGridColumns > 1 ? { gap } : undefined}
        contentContainerStyle={{
          gap,
          paddingHorizontal: pagePadding,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl + bottomInset,
        }}
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            maxWidth={maxCardWidth}
            compactHeight={isCompactHeight}
            smallPhone={isSmallPhone}
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
  maxWidth,
  compactHeight,
  smallPhone,
  qty,
  rules,
  onAdd,
  onLongPress,
}: {
  item: CatalogItem;
  maxWidth?: number;
  compactHeight: boolean;
  smallPhone: boolean;
  qty: number;
  rules: AdjustmentRule[];
  onAdd: () => void;
  onLongPress: () => void;
}) {
  const unit = evaluateRules(item.price, 1, rules);
  const netPrice = item.price - unit.discount;
  const badge = badgeFor(rules, item.price);
  const bannerHeight = compactHeight ? 68 : smallPhone ? 80 : 92;

  return (
    <Pressable
      onPress={onAdd}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => ({
        flex: 1,
        maxWidth,
        backgroundColor: color.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: qty > 0 ? color.primary : color.border,
        overflow: "hidden",
        opacity: pressed ? 0.85 : 1,
        ...elevation.card,
      })}
    >
      <View style={{ height: bannerHeight, backgroundColor: tintFor(item.category), alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: font.display, fontSize: compactHeight ? 30 : 38, color: color.primaryDeep, opacity: 0.5 }}>
          {item.name.trim().charAt(0).toUpperCase()}
        </Text>
        {item.type === "retail" && (
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: color.surface,
              borderRadius: radius.pill,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: color.textSecondary }}>Retail</Text>
          </View>
        )}
        {badge && (
          <View
            style={{
              position: "absolute",
              bottom: 6,
              left: 8,
              maxWidth: "88%",
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
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              minWidth: 24,
              height: 24,
              borderRadius: 12,
              paddingHorizontal: 6,
              backgroundColor: color.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: color.textOnPrimary }}>{qty}</Text>
          </View>
        )}
      </View>

      <View style={{ padding: smallPhone ? spacing.xs + 2 : spacing.sm }}>
        <Text
          numberOfLines={2}
          style={{
            color: color.textPrimary,
            fontSize: smallPhone ? 13 : 14,
            fontWeight: "600",
            minHeight: compactHeight ? 34 : 36,
          }}
        >
          {item.name}
        </Text>
        <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 2, minHeight: 14 }} numberOfLines={1}>
          {item.durationMinutes ? `${item.durationMinutes} menit` : item.type === "retail" ? "Produk retail" : ""}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs, gap: 6 }}>
          <View style={{ flex: 1 }}>
            {unit.discount > 0 && (
              <Text style={{ color: color.textMuted, fontSize: 11, textDecorationLine: "line-through" }} numberOfLines={1}>
                {formatRupiah(item.price)}
              </Text>
            )}
            <Text
              style={{ color: color.primaryDeep, fontSize: smallPhone ? 14 : 15, fontWeight: "700" }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {formatRupiah(netPrice)}
            </Text>
            {unit.extra > 0 && (
              <Text style={{ color: "#8A5A12", fontSize: 10, fontWeight: "600" }} numberOfLines={1}>
                + {formatRupiah(unit.extra)} biaya
              </Text>
            )}
          </View>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: color.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="plus" color={color.primaryDeep} size={18} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
