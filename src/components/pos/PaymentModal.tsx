import { useState } from "react";
import { Modal, View, Text, TextInput, ScrollView, Alert } from "react-native";
import { color, radius, spacing } from "@/constants/theme";
import { Button } from "@/components/common/Button";
import { formatRupiah, type Rupiah } from "@/utils/money";
import { usePosStore } from "@/store/posStore";
import { createMidtransCharge, awaitMidtransSettlement, midtransOrderIdFor } from "@/services/midtransService";
import { printReceipt } from "@/services/printerService";
import type { PaymentLeg, PaymentMethod } from "@/types";

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
}

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Tunai" },
  { key: "midtrans_qris", label: "QRIS" },
  { key: "midtrans_cc", label: "Kartu" },
  { key: "midtrans_va", label: "Virtual Account" },
  { key: "split", label: "Split" },
];

export function PaymentModal({ visible, onClose }: PaymentModalProps) {
  const totals = usePosStore((s) => s.totals());
  const checkout = usePosStore((s) => s.checkout);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [splitLegs, setSplitLegs] = useState<{ method: Exclude<PaymentMethod, "split">; amount: string }[]>([
    { method: "cash", amount: "" },
    { method: "midtrans_qris", amount: "" },
  ]);
  const [processing, setProcessing] = useState(false);

  const grandTotal: Rupiah = totals.grandTotal;
  const cashReceivedNum = Number(cashReceived.replace(/\D/g, "")) || 0;
  const change = Math.max(0, cashReceivedNum - grandTotal);

  async function handleConfirm() {
    setProcessing(true);
    try {
      let breakdown: PaymentLeg[] = [];
      let midtransOrderId: string | undefined;

      if (method === "cash") {
        if (cashReceivedNum < grandTotal) throw new Error("Uang diterima kurang dari total");
        breakdown = [{ method: "cash", amount: grandTotal }];
      } else if (method === "split") {
        breakdown = splitLegs
          .filter((l) => Number(l.amount) > 0)
          .map((l) => ({ method: l.method, amount: Number(l.amount) }));
      } else {
        // Midtrans path: create charge, show QR/VA (simplified here to a blocking
        // await — a full build shows the QRIS code / VA number in-modal while polling).
        const orderId = midtransOrderIdFor(String(Date.now()));
        const charge = await createMidtransCharge({ orderId, grossAmount: grandTotal, channel: methodToChannel(method) });
        const status = await awaitMidtransSettlement(charge.orderId);
        if (status !== "settlement") throw new Error(`Pembayaran ${status}`);
        breakdown = [{ method, amount: grandTotal }];
        midtransOrderId = charge.orderId;
      }

      const tx = await checkout({ paymentMethod: method, paymentBreakdown: breakdown, midtransOrderId });

      try {
        await printReceipt(tx);
      } catch {
        // Printer not connected — non-fatal, transaction already saved & queued for sync.
        Alert.alert("Transaksi tersimpan", "Struk tidak tercetak (printer belum terhubung).");
      }

      onClose();
      setCashReceived("");
    } catch (err) {
      Alert.alert("Pembayaran gagal", err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  }

  const splitSum = splitLegs.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "90%" }}>
          <Text style={{ color: color.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.md }}>
            Bayar {formatRupiah(grandTotal)}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md }}>
            {METHODS.map((m) => (
              <Button
                key={m.key}
                label={m.label}
                size="sm"
                variant={method === m.key ? "primary" : "secondary"}
                onPress={() => setMethod(m.key)}
              />
            ))}
          </View>

          <ScrollView style={{ maxHeight: 320 }}>
            {method === "cash" && (
              <View>
                <Text style={{ color: color.textSecondary, fontSize: 13, marginBottom: spacing.xxs }}>Uang diterima</Text>
                <TextInput
                  value={cashReceived}
                  onChangeText={setCashReceived}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={color.textMuted}
                  style={inputStyle}
                />
                <Text style={{ color: color.textSecondary, fontSize: 13, marginTop: spacing.sm }}>
                  Kembalian: <Text style={{ color: color.accent, fontWeight: "700" }}>{formatRupiah(change)}</Text>
                </Text>
              </View>
            )}

            {(method === "midtrans_qris" || method === "midtrans_cc" || method === "midtrans_va") && (
              <Text style={{ color: color.textSecondary, fontSize: 13 }}>
                Tekan konfirmasi untuk membuat kode {method === "midtrans_qris" ? "QRIS" : method === "midtrans_cc" ? "pembayaran kartu" : "Virtual Account"} via Midtrans.
                Aplikasi akan menunggu status settlement sebelum struk dicetak.
              </Text>
            )}

            {method === "split" && (
              <View style={{ gap: spacing.sm }}>
                {splitLegs.map((leg, idx) => (
                  <View key={idx} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                    <Text style={{ color: color.textSecondary, width: 90, fontSize: 13 }}>
                      {METHODS.find((m) => m.key === leg.method)?.label}
                    </Text>
                    <TextInput
                      value={leg.amount}
                      onChangeText={(v) =>
                        setSplitLegs((prev) => prev.map((l, i) => (i === idx ? { ...l, amount: v.replace(/\D/g, "") } : l)))
                      }
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={color.textMuted}
                      style={[inputStyle, { flex: 1 }]}
                    />
                  </View>
                ))}
                <Text style={{ color: splitSum === grandTotal ? color.accent : color.danger, fontSize: 13 }}>
                  Total dibagi: {formatRupiah(splitSum)} / {formatRupiah(grandTotal)}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <Button label="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label="Konfirmasi"
              loading={processing}
              onPress={handleConfirm}
              disabled={method === "split" && splitSum !== grandTotal}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function methodToChannel(method: PaymentMethod): "qris" | "credit_card" | "bank_transfer" {
  if (method === "midtrans_cc") return "credit_card";
  if (method === "midtrans_va") return "bank_transfer";
  return "qris";
}

const inputStyle = {
  backgroundColor: color.surfaceAlt,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.border,
  color: color.textPrimary,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  fontSize: 15,
} as const;
