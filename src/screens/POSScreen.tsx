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
  const { useSidePanel } = useResponsiveLayout();
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

  const header = (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 24, fontWeight: "600" }} numberOfLines={1}>
            Hai, {firstName}
          </Text>
          <Text style={{ color: color.textMuted, fontSize: 13, marginTop: 2 }}>Siap melayani hari ini</Text>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: font.display, fontSize: 20, fontWeight: "600", color: color.primaryDeep }}>
            {firstName.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={{ backgroundColor: color.primarySoft, borderRadius: radius.xl, padding: spacing.md, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: -24, top: -24, width: 110, height: 110, borderRadius: 55, backgroundColor: color.primary, opacity: 0.35 }} />
        <View style={{ position: "absolute", right: 36, bottom: -34, width: 70, height: 70, borderRadius: 35, backgroundColor: color.peach, opacity: 0.9 }} />
        <Text style={{ color: color.textSecondary, fontSize: 12 }}>Penjualan hari ini</Text>
        <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 26, fontWeight: "600", marginTop: 2 }}>
          {formatRupiah(sales.total)}
        </Text>
        <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 2 }}>{sales.count} transaksi selesai</Text>
      </View>
    </View>
  );

  if (useSidePanel) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
        <View style={{ flex: 1, flexDirection: "row", gap: spacing.md, paddingRight: spacing.md }}>
          <View style={{ flex: 2 }}>
            <ProductGrid items={items} header={header} onSelect={(item) => addItem(item, null)} />
          </View>
          <Card style={{ width: 360, marginVertical: spacing.md }}>
            <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 20, fontWeight: "600", marginBottom: spacing.sm }}>
              Keranjang
            </Text>
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
        bottomInset={lineCount > 0 ? 72 : 0}
        onSelect={(item) => addItem(item, null)}
      />

      {lineCount > 0 && (
        <Pressable
          onPress={() => router.push("/(tabs)/cart")}
          style={{
            position: "absolute",
            left: spacing.md,
            right: spacing.md,
            bottom: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: color.primary,
            borderRadius: radius.pill,
            paddingVertical: 14,
            paddingHorizontal: spacing.md,
            ...elevation.modal,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Icon name="cart" color={color.textOnPrimary} size={20} />
            <Text style={{ color: color.textOnPrimary, fontWeight: "700", fontSize: 14 }}>{lineCount} item</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: color.textOnPrimary, fontWeight: "700", fontSize: 15 }}>{formatRupiah(totals.grandTotal)}</Text>
            <Icon name="chevronRight" color={color.textOnPrimary} size={18} />
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
