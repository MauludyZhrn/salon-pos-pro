import { useState } from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { PrinterDropdown } from "@/components/printer/PrinterDropdown";
import { ReceiptPreview } from "@/components/pos/ReceiptPreview";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, font, radius, spacing } from "@/constants/theme";
import { useReceiptConfig } from "@/hooks/useReceiptConfig";
import { ensureBluetoothPermission, askBluetoothDenied } from "@/services/bluetoothPermissions";
import { connectPrinter, type PairedPrinter } from "@/services/printerService";
import { printReceiptFromConfig } from "@/services/receiptPrinter";
import type { Transaction } from "@/types";

interface TransactionDetailSheetProps {
  visible: boolean;
  tx: Transaction | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}

/** Detail satu transaksi: pratinjau struk, cetak ulang, dan (untuk yang berhak) edit. */
export function TransactionDetailSheet({ visible, tx, canEdit, onClose, onEdit }: TransactionDetailSheetProps) {
  const { sheetMaxBodyHeight } = useResponsiveLayout();
  const cfg = useReceiptConfig(visible);
  const [printer, setPrinter] = useState<PairedPrinter | null>(null);
  const [printing, setPrinting] = useState(false);

  async function handleReprint() {
    if (!tx) return;
    setPrinting(true);
    try {
      // Tanpa koneksi, library printer hanya mencatat error ke log dan struk tidak keluar,
      // jadi printer wajib dipilih dan terhubung dulu.
      if (!printer) {
        Alert.alert("Pilih printer dulu", "Pilih printer di atas, lalu tekan Cetak ulang lagi.");
        return;
      }
      if (!(await ensureBluetoothPermission())) return askBluetoothDenied();
      await connectPrinter(printer.address);
      await printReceiptFromConfig(tx, cfg, { reprint: true });
      Alert.alert("Terkirim ke printer", "Struk cetak ulang dikirim.");
    } catch {
      Alert.alert("Gagal cetak", "Pastikan printer menyala dan terhubung, lalu coba lagi.");
    } finally {
      setPrinting(false);
    }
  }

  const isVoid = tx?.status === "void";

  return (
    <BottomSheet visible={visible && tx !== null} onClose={onClose}>
      {tx && (
        <View>
          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600" }}>{tx.receiptNo}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2, marginBottom: spacing.sm, flexWrap: "wrap" }}>
            <Text style={{ color: color.textMuted, fontSize: 12 }}>
              {new Date(tx.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </Text>
            {tx.editedAt && <Pill label="Diedit" bg="#FBEBD0" fg="#8A5A12" />}
            {isVoid && <Pill label="Void" bg="#F6D9DD" fg={color.danger} />}
          </View>

          <ScrollView style={{ maxHeight: sheetMaxBodyHeight }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <ReceiptPreview tx={tx} cfg={cfg} reprint />
            <View style={{ height: spacing.md }} />
            <PrinterDropdown onChange={setPrinter} />
          </ScrollView>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Button label="Tutup" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button label="Cetak ulang struk" loading={printing} onPress={handleReprint} style={{ flex: 2 }} />
          </View>
          {canEdit && !isVoid && <Button label="Edit transaksi" variant="secondary" onPress={onEdit} style={{ marginTop: spacing.xs }} />}
        </View>
      )}
    </BottomSheet>
  );
}

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: fg }}>{label}</Text>
    </View>
  );
}
