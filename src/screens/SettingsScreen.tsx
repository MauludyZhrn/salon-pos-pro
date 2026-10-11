import { useState } from "react";
import { View, Text, TextInput, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { color, radius, spacing } from "@/constants/theme";
import { configureSync, drainQueue, pendingCount } from "@/services/syncQueue";
import { scanPrinters, connectPrinter, type PairedPrinter } from "@/services/printerService";
import { useAuthStore } from "@/store/authStore";

export function SettingsScreen() {
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const logout = useAuthStore((s) => s.logout);

  const [sheetsUrl, setSheetsUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(0);
  const [printers, setPrinters] = useState<PairedPrinter[]>([]);
  const [connectedPrinter, setConnectedPrinter] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function saveSheetsConfig() {
    if (!sheetsUrl || !apiKey) {
      Alert.alert("Lengkapi data", "URL Apps Script dan API Key wajib diisi.");
      return;
    }
    configureSync(sheetsUrl, apiKey);
    Alert.alert("Tersimpan", "Konfigurasi Google Sheets aktif untuk sesi ini.");
  }

  async function runSyncNow() {
    setSyncing(true);
    try {
      await drainQueue();
      setPending(await pendingCount());
    } finally {
      setSyncing(false);
    }
  }

  async function scanForPrinters() {
    try {
      const found = await scanPrinters();
      setPrinters(found);
    } catch {
      Alert.alert("Bluetooth tidak tersedia", "Aktifkan Bluetooth dan coba lagi.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <Text style={{ color: color.textPrimary, fontSize: 20, fontWeight: "700" }}>Pengaturan</Text>

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.xs }}>Akun</Text>
          <Text style={{ color: color.textSecondary, fontSize: 13 }}>{currentEmployee?.name ?? "-"}</Text>
          <Text style={{ color: color.textMuted, fontSize: 12, textTransform: "capitalize" }}>{currentEmployee?.role}</Text>
          <Button label="Keluar" variant="danger" size="sm" style={{ marginTop: spacing.sm, alignSelf: "flex-start" }} onPress={logout} />
        </Card>

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.xs }}>Google Sheets Sync</Text>
          <Text style={{ color: color.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
            Tempel URL Web App Apps Script (/exec) dan API Key dari Code.gs.
          </Text>
          <TextInput
            value={sheetsUrl}
            onChangeText={setSheetsUrl}
            placeholder="https://script.google.com/macros/s/.../exec"
            placeholderTextColor={color.textMuted}
            autoCapitalize="none"
            style={inputStyle}
          />
          <TextInput
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="API Key"
            placeholderTextColor={color.textMuted}
            autoCapitalize="none"
            secureTextEntry
            style={[inputStyle, { marginTop: spacing.xs }]}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Button label="Simpan" size="sm" onPress={saveSheetsConfig} />
            <Button label={`Sync sekarang (${pending} tertunda)`} size="sm" variant="secondary" loading={syncing} onPress={runSyncNow} />
          </View>
        </Card>

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.xs }}>Printer Thermal (Bluetooth)</Text>
          <Button label="Cari printer" size="sm" variant="secondary" onPress={scanForPrinters} />
          {printers.map((p) => (
            <View
              key={p.address}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs }}
            >
              <Text style={{ color: color.textSecondary, fontSize: 13 }}>{p.name}</Text>
              <Button
                label={connectedPrinter === p.address ? "Terhubung" : "Hubungkan"}
                size="sm"
                variant={connectedPrinter === p.address ? "primary" : "secondary"}
                onPress={async () => {
                  await connectPrinter(p.address);
                  setConnectedPrinter(p.address);
                }}
              />
            </View>
          ))}
        </Card>

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600" }}>Pajak</Text>
          <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2 }}>
            PPN default 11% diterapkan pada seluruh transaksi POS — ubah di src/utils/transaction.ts (TAX_RATE_BPS)
            atau sambungkan ke tabel Settings di Sheets untuk konfigurasi per-outlet.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
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
  fontSize: 14,
} as const;
