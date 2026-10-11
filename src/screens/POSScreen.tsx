import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { color, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { usePosStore } from "@/store/posStore";
import { useAuthStore } from "@/store/authStore";
import { useCatalog } from "@/hooks/useCatalog";

/**
 * Orientation contract:
 * - Landscape / tablet (useSidePanel true): grid fills left ~65%, cart is a
 *   fixed-width right rail — both always visible, no modal needed to see totals.
 * - Portrait phone: grid is full width; cart collapses to a bottom summary
 *   bar that expands into a sheet on tap (CartPanel reused inside the sheet).
 */
export function POSScreen() {
  const { useSidePanel } = useResponsiveLayout();
  const { items } = useCatalog();
  const addItem = usePosStore((s) => s.addItem);
  const lineCount = usePosStore((s) => s.lines.length);
  const totals = usePosStore((s) => s.totals());
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Cashier identity for the receipt/journal comes from the logged-in PIN session.
  useEffect(() => {
    if (currentEmployee) usePosStore.setState({ cashierId: currentEmployee.id });
  }, [currentEmployee]);

  const grid = <ProductGrid items={items} onSelect={(item) => addItem(item, null)} />;

  if (useSidePanel) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
        <View style={{ flex: 1, flexDirection: "row", padding: spacing.md, gap: spacing.md }}>
          <View style={{ flex: 2 }}>{grid}</View>
          <Card style={{ width: 340 }}>
            <CartPanel onCheckout={() => setPaymentOpen(true)} />
          </Card>
        </View>
        <PaymentModal visible={paymentOpen} onClose={() => setPaymentOpen(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ flex: 1, padding: spacing.md }}>{grid}</View>

      {/* Bottom summary bar — tap to expand full CartPanel as a sheet */}
      <Card
        raised
        onTouchEnd={() => lineCount > 0 && setCartSheetOpen(true)}
        style={{
          margin: spacing.md,
          marginTop: 0,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: lineCount === 0 ? 0.5 : 1,
        }}
      >
        <View>
          <Text style={{ color: color.textSecondary, fontSize: 12 }}>{lineCount} item di keranjang</Text>
          <Text style={{ color: color.primary, fontSize: 18, fontWeight: "700" }}>
            {formatRupiah(totals.grandTotal)}
          </Text>
        </View>
        <Button
          label="Bayar"
          disabled={lineCount === 0}
          onPress={() => setPaymentOpen(true)}
        />
      </Card>

      {cartSheetOpen && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
          onTouchEnd={() => setCartSheetOpen(false)}
        >
          <View
            onStartShouldSetResponder={() => true}
            style={{
              backgroundColor: color.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: spacing.md,
              maxHeight: "80%",
            }}
          >
            <CartPanel
              onCheckout={() => {
                setCartSheetOpen(false);
                setPaymentOpen(true);
              }}
            />
          </View>
        </View>
      )}

      <PaymentModal visible={paymentOpen} onClose={() => setPaymentOpen(false)} />
    </SafeAreaView>
  );
}
