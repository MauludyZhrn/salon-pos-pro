import { useCallback, useEffect } from "react";
import { useFocusEffect, router } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { Card } from "@/components/common/Card";
import { Icon } from "@/components/common/Icon";
import { color, elevation, font, radius, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { usePosStore, useCartTotals } from "@/store/posStore";
import { useAuthStore } from "@/store/authStore";
import { useCatalog } from "@/hooks/useCatalog";
import { useTodaySales } from "@/hooks/useTodaySales";
import { useState } from "react";

/**
 * Kasir (home). Phone portrait: greeting + sales banner + product grid, with a
 * floating pill that opens the Cart tab. Tablet / landscape (useSidePanel):
 * grid on the left, cart as a fixed right rail, both always visible.
 */
export function POSScreen() {
  const { useSidePanel, sidePanelWidth, isCompactHeight, isSmallPhone, pagePadding } = useResponsiveLayout();
  const { items, reload: reloadCatalog } = useCatalog();
  const addItem = usePosStore((s) => s.addItem);
  const lineCount = usePosStore((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const totals = useCartTotals();
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const sales = useTodaySales();
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Tabs stay mounted: re-read the catalog whenever Kasir regains focus (new retail products).
  useFocusEffect(
    useCallback(() => {
      reloadCatalog();
    }, [reloadCatalog])
  );

  // Cashier identity for the receipt/journal comes from the logged-in PIN session.
  useEffect(() => {
    if (currentEmployee) usePosStore.setState({ cashierId: currentEmployee.id });
  }, [currentEmployee]);

  const firstName = (currentEmployee?.name ?? "").split(" ")[0] || "Kasir";

  const header = isCompactHeight ? (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
        marginBottom: spacing.xs,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: color.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: font.display, fontSize: 17, fontWeight: "600", color: color.primaryDeep }}>
            {firstName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 18, fontWeight: "600" }} numberOfLines={1}>
            Hai, {firstName}
          </Text>
          <Text style={{ color: color.textMuted, fontSize: 11 }} numberOfLines={1}>
            Siap melayani hari ini
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: color.primarySoft,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          alignItems: "flex-end",
        }}
      >
        <Text style={{ color: color.textSecondary, fontSize: 10 }}>Penjualan hari ini ({sales.count} tx)</Text>
        <Text
          style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 17, fontWeight: "600" }}
          numberOfLines={1}
        >
          {formatRupiah(sales.total)}
        </Text>
      </View>
    </View>
  ) : (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <View style={{ flex: 1, marginRight: spacing.xs }}>
          <Text
            style={{
              color: color.textPrimary,
              fontFamily: font.display,
              fontSize: isSmallPhone ? 21 : 24,
              fontWeight: "600",
            }}
            numberOfLines={1}
          >
            Hai, {firstName}
          </Text>
          <Text style={{ color: color.textMuted, fontSize: 13, marginTop: 2 }}>Siap melayani hari ini</Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: color.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: font.display, fontSize: 20, fontWeight: "600", color: color.primaryDeep }}>
            {firstName.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: color.primarySoft,
          borderRadius: radius.xl,
          padding: isSmallPhone ? spacing.sm : spacing.md,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -24,
            top: -24,
            width: 110,
            height: 110,
            borderRadius: 55,
            backgroundColor: color.primary,
            opacity: 0.35,
          }}
        />
        <View
          style={{
            position: "absolute",
            right: 36,
            bottom: -34,
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: color.peach,
            opacity: 0.9,
          }}
        />
        <Text style={{ color: color.textSecondary, fontSize: 12 }}>Penjualan hari ini</Text>
        <Text
          style={{
            color: color.textPrimary,
            fontFamily: font.display,
            fontSize: isSmallPhone ? 22 : 26,
            fontWeight: "600",
            marginTop: 2,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatRupiah(sales.total)}
        </Text>
        <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 2 }}>{sales.count} transaksi selesai</Text>
      </View>
    </View>
  );

  if (useSidePanel) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
        <View style={{ flex: 1, flexDirection: "row", gap: spacing.sm, paddingRight: pagePadding }}>
          <View style={{ flex: 1 }}>
            <ProductGrid items={items} header={header} onSelect={(item) => addItem(item, null)} />
          </View>
          <Card style={{ width: sidePanelWidth, marginVertical: spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.xs,
              }}
            >
              <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 20, fontWeight: "600" }}>
                Keranjang
              </Text>
              {lineCount > 0 && (
                <View
                  style={{
                    backgroundColor: color.primarySoft,
                    borderRadius: radius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: color.primaryDeep, fontSize: 12, fontWeight: "700" }}>{lineCount} item</Text>
                </View>
              )}
            </View>
            <CartPanel onCheckout={() => setPaymentOpen(true)} />
          </Card>
        </View>
        <PaymentModal visible={paymentOpen} onClose={() => setPaymentOpen(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ProductGrid
        items={items}
        header={header}
        bottomInset={lineCount > 0 ? 88 : 0}
        onSelect={(item) => addItem(item, null)}
      />

      {lineCount > 0 && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: pagePadding,
            right: pagePadding,
            bottom: spacing.sm,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => router.push("/(tabs)/cart")}
            style={({ pressed }) => ({
              width: "100%",
              maxWidth: 560,
              minHeight: 52,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: pressed ? "#DB6C93" : color.primary,
              borderRadius: radius.pill,
              paddingVertical: 14,
              paddingHorizontal: spacing.md,
              ...elevation.modal,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <Icon name="cart" color={color.textOnPrimary} size={20} />
              <Text style={{ color: color.textOnPrimary, fontWeight: "700", fontSize: 14 }}>{lineCount} item</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ color: color.textOnPrimary, fontWeight: "700", fontSize: 15 }}>
                {formatRupiah(totals.grandTotal)}
              </Text>
              <Icon name="chevronRight" color={color.textOnPrimary} size={18} />
            </View>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
