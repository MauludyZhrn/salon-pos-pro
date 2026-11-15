import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Alert } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { color, font, radius, spacing } from "@/constants/theme";
import { Button } from "@/components/common/Button";
import { formatRupiah, type Rupiah } from "@/utils/money";
import { usePosStore, useCartTotals } from "@/store/posStore";
import { connectPrinter, type PairedPrinter } from "@/services/printerService";
import { printReceiptFromConfig } from "@/services/receiptPrinter";
import { PrinterDropdown } from "@/components/printer/PrinterDropdown";
import { ensureBluetoothPermission, askBluetoothDenied } from "@/services/bluetoothPermissions";
import { ReceiptPreview } from "@/components/pos/ReceiptPreview";
import { useReceiptConfig } from "@/hooks/useReceiptConfig";
import type { Transaction } from "@/types";
import type { PaymentLeg, PaymentMethod } from "@/types";

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
}

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Tunai" },
  { key: "qris", label: "QRIS" },
  { key: "edc", label: "Kartu (EDC BCA)" },
  { key: "split", label: "Split" },
];

export function PaymentModal({ visible, onClose }: PaymentModalProps) {
  const totals = useCartTotals();
  const checkout = usePosStore((s) => s.checkout);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  // Uang diterima terisi total saat popup dibuka, supaya bayar pas cukup satu tekan.
  useEffect(() => {
    if (visible) setCashReceived(String(totals.grandTotal));
  }, [visible, totals.grandTotal]);
  const [splitLegs, setSplitLegs] = useState<{ method: Exclude<PaymentMethod, "split">; amount: string }[]>([
    { method: "cash", amount: "" },
    { method: "qris", amount: "" },
  ]);
  const [processing, setProcessing] = useState(false);

  const grandTotal: Rupiah = totals.grandTotal;
  const cashReceivedNum = Number(cashReceived.replace(/\D/g, "")) || 0;
  const change = Math.max(0, cashReceivedNum - grandTotal);

  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);
  const [printer, setPrinter] = useState<PairedPrinter | null>(null);
  const [printing, setPrinting] = useState(false);
  const receiptCfg = useReceiptConfig(visible);

  function finishSale() {
    setReceiptTx(null);
    setCashReceived("");
    onClose();
  }

  async function handlePrint() {
    if (!receiptTx) return;
    setPrinting(true);
    try {
      // Printer wajib dipilih dan terhubung. Tanpa koneksi, library hanya mencatat error ke log
      // dan struk diam-diam tidak tercetak, jadi jangan tutup popup sebelum benar-benar dikirim.
      if (!printer) {
        Alert.alert("Pilih printer dulu", "Pilih printer di atas, lalu tekan Cetak struk lagi. Atau tekan Lewati.");
        return;
      }
      if (!(await ensureBluetoothPermission())) return askBluetoothDenied();
      await connectPrinter(printer.address);
      await printReceiptFromConfig(receiptTx, receiptCfg);
      finishSale();
    } catch {
      Alert.alert("Gagal cetak", "Pastikan printer menyala dan terhubung, lalu coba lagi. Atau lewati struk.");
    } finally {
      setPrinting(false);
    }
  }

  async function handleConfirm() {
    setProcessing(true);
    try {
      let breakdown: PaymentLeg[] = [];

      if (method === "cash") {
        if (cashReceivedNum < grandTotal) throw new Error("Uang diterima kurang dari total");
        breakdown = [{ method: "cash", amount: grandTotal }];
      } else if (method === "split") {
        breakdown = splitLegs
          .filter((l) => Number(l.amount) > 0)
          .map((l) => ({ method: l.method, amount: Number(l.amount) }));
      } else {
        // QRIS fisik dan EDC BCA: pembayaran terjadi di luar app, kasir konfirmasi manual.
        breakdown = [{ method, amount: grandTotal }];
      }

      const tx = await checkout({ paymentMethod: method, paymentBreakdown: breakdown });
      // Transaction is already saved. Show the receipt step; printing is optional.
      setReceiptTx(tx);
    } catch (err) {
      Alert.alert("Pembayaran gagal", err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  }

  const splitSum = splitLegs.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  if (receiptTx) {
    return (
      <BottomSheet visible={visible} onClose={finishSale}>
        <View>
          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600", marginBottom: spacing.xs }}>
            Struk
          </Text>
          <Text style={{ color: color.textMuted, fontSize: 12, marginBottom: spacing.md }}>Transaksi tersimpan. Cetak atau lewati.</Text>

          <PrinterDropdown onChange={setPrinter} />
          <View style={{ height: spacing.md }} />
          <ReceiptPreview tx={receiptTx} cfg={receiptCfg} />

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <Button label="Lewati" variant="secondary" onPress={finishSale} style={{ flex: 1 }} />
            <Button label="Cetak struk" loading={printing} onPress={handlePrint} style={{ flex: 2 }} />
          </View>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
        <View>
          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600", marginBottom: spacing.md }}>
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

            {method === "qris" && (
              <Text style={{ color: color.textSecondary, fontSize: 13 }}>
                Pelanggan scan QRIS toko. Pastikan notifikasi pembayaran {formatRupiah(grandTotal)} sudah masuk, lalu tekan Konfirmasi.
              </Text>
            )}
            {method === "edc" && (
              <Text style={{ color: color.textSecondary, fontSize: 13 }}>
                Input nominal {formatRupiah(grandTotal)} di mesin EDC BCA. Tunggu status approved dan slip tercetak, lalu tekan Konfirmasi.
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
    </BottomSheet>
  );
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
