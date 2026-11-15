import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Button } from "@/components/common/Button";
import { PrinterDropdown } from "@/components/printer/PrinterDropdown";
import { ReceiptPreview } from "@/components/pos/ReceiptPreview";
import { color, radius, spacing } from "@/constants/theme";
import { DEFAULT_RECEIPT, loadReceiptConfig, saveReceiptConfig, type ReceiptConfig } from "@/services/receiptConfig";
import { sampleTransaction } from "@/utils/sampleReceipt";
import { connectPrinter, type PairedPrinter } from "@/services/printerService";
import { printReceiptFromConfig } from "@/services/receiptPrinter";
import { ensureBluetoothPermission, askBluetoothDenied } from "@/services/bluetoothPermissions";

/** Printer choice and receipt layout. Changes show in the preview right away. */
export function PrinterScreen() {
  const insets = useSafeAreaInsets();
  const [cfg, setCfg] = useState<ReceiptConfig>(DEFAULT_RECEIPT);
  const [sample] = useState(() => sampleTransaction());
  const [printer, setPrinter] = useState<PairedPrinter | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadReceiptConfig().then(setCfg);
  }, []);

  function update<K extends keyof ReceiptConfig>(key: K, value: ReceiptConfig[K]) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  async function save() {
    if (!cfg.outletName.trim()) return Alert.alert("Nama toko wajib diisi");
    await saveReceiptConfig({ ...cfg, outletName: cfg.outletName.trim() });
    Alert.alert("Tersimpan", "Pengaturan struk disimpan di HP ini.");
  }

  async function testPrint() {
    if (!printer) return Alert.alert("Pilih printer dulu");
    setTesting(true);
    try {
      if (!(await ensureBluetoothPermission())) return askBluetoothDenied();
      await connectPrinter(printer.address);
      await printReceiptFromConfig(sample, cfg);
    } catch {
      Alert.alert("Gagal cetak", "Pastikan printer menyala dan terhubung, lalu coba lagi.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Printer & Struk" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.md + insets.bottom, gap: spacing.md }}
      >
        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.xs }}>Printer</Text>
          <PrinterDropdown onChange={setPrinter} />
        </Card>

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.sm }}>Isi struk</Text>
          <Field label="Nama toko" value={cfg.outletName} onChangeText={(v) => update("outletName", v)} />
          <Field label="Alamat" value={cfg.address} onChangeText={(v) => update("address", v)} placeholder="opsional" />
          <Field label="Telepon" value={cfg.phone} onChangeText={(v) => update("phone", v)} placeholder="opsional" keyboardType="phone-pad" />
          <Field label="Catatan bawah struk" value={cfg.footer} onChangeText={(v) => update("footer", v)} placeholder="contoh: Terima kasih!" />

          <Text style={label}>Lebar kertas</Text>
          <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm }}>
            <Chip active={cfg.paperWidth === 32} text="58 mm" onPress={() => update("paperWidth", 32)} />
            <Chip active={cfg.paperWidth === 48} text="80 mm" onPress={() => update("paperWidth", 48)} />
          </View>

          <Toggle label="Tampilkan logo" value={cfg.showLogo} onChange={(v) => update("showLogo", v)} />
          <Toggle label="Tampilkan diskon" value={cfg.showDiscount} onChange={(v) => update("showDiscount", v)} />

          <View style={{ marginTop: spacing.md }}>
            <Button label="Simpan pengaturan struk" fullWidth onPress={save} />
          </View>
        </Card>

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.sm }}>Contoh struk</Text>
          <ReceiptPreview tx={sample} cfg={cfg} />
          <View style={{ marginTop: spacing.sm }}>
            <Button label="Tes cetak" variant="secondary" loading={testing} onPress={testPrint} fullWidth />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label: text,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad";
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={label}>{text}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textMuted}
        keyboardType={keyboardType ?? "default"}
        style={{
          backgroundColor: color.surfaceAlt,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.border,
          color: color.textPrimary,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          fontSize: 14,
        }}
      />
    </View>
  );
}

function Toggle({ label: text, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs }}
    >
      <Text style={{ color: color.textPrimary, fontSize: 14 }}>{text}</Text>
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          padding: 3,
          backgroundColor: value ? color.primary : color.border,
          justifyContent: "center",
          alignItems: value ? "flex-end" : "flex-start",
        }}
      >
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" }} />
      </View>
    </Pressable>
  );
}

function Chip({ active, text, onPress }: { active: boolean; text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: active ? color.primary : color.surfaceAlt,
        borderWidth: 1,
        borderColor: active ? color.primary : color.border,
      }}
    >
      <Text style={{ color: active ? color.textOnPrimary : color.textSecondary, fontSize: 12, fontWeight: "600" }}>{text}</Text>
    </Pressable>
  );
}

const label = { color: color.textSecondary, fontSize: 13, marginBottom: spacing.xxs } as const;
