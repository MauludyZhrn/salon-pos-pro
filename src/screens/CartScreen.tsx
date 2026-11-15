import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { CartPanel } from "@/components/pos/CartPanel";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { color, spacing } from "@/constants/theme";

/** Keranjang tab (phones). On tablets the cart is the POS side rail, this tab just mirrors it. */
export function CartScreen() {
  const [paymentOpen, setPaymentOpen] = useState(false);
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Keranjang" showBack={false} />
      <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
        <CartPanel onCheckout={() => setPaymentOpen(true)} />
      </View>
      <PaymentModal visible={paymentOpen} onClose={() => setPaymentOpen(false)} />
    </SafeAreaView>
  );
}
