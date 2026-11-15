import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { CartPanel } from "@/components/pos/CartPanel";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, spacing } from "@/constants/theme";

/** Keranjang tab (phones). On tablets the cart is the POS side rail, this tab mirrors it with comfortable width. */
export function CartScreen() {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { pagePadding, isTablet } = useResponsiveLayout();
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Keranjang" showBack={false} />
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: isTablet ? 720 : undefined,
          alignSelf: "center",
          paddingHorizontal: pagePadding,
          paddingBottom: spacing.sm,
        }}
      >
        <CartPanel onCheckout={() => setPaymentOpen(true)} />
      </View>
      <PaymentModal visible={paymentOpen} onClose={() => setPaymentOpen(false)} />
    </SafeAreaView>
  );
}
