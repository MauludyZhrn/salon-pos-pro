import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Button } from "@/components/common/Button";
import { color, radius, spacing } from "@/constants/theme";
import {
  configureSync,
  clearSyncSettings,
  drainQueue,
  lastSheetsError,
  loadSyncSettings,
  pendingCount,
  testSheetsConnection,
} from "@/services/syncQueue";
import { useAuthStore } from "@/store/authStore";
import { useCloud, syncNow, cloudLogout } from "@/services/cloudSync";
import { CloudLoginForm } from "@/components/common/CloudLoginForm";
import { PromotionsCard } from "@/components/promo/PromotionsCard";
import { getDb } from "@/services/database";
import { enqueueSync } from "@/services/syncQueue";

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const logout = useAuthStore((s) => s.logout);
  const refreshCurrent = useAuthStore((s) => s.refreshCurrent);
  const cloudSignedIn = useCloud((c) => c.signedIn);
  const cloudEmail = useCloud((c) => c.email);
  const cloudSyncing = useCloud((c) => c.syncing);
  const cloudError = useCloud((c) => c.error);
  const cloudPending = useCloud((c) => c.pending);
  const cloudLast = useCloud((c) => c.lastSyncAt);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  async function saveName() {
    const name = nameDraft.trim();
    if (!name || !currentEmployee) return Alert.alert("Nama wajib diisi");
    const db = await getDb();
    await db.runAsync("UPDATE employees SET name = ? WHERE id = ?", [name, currentEmployee.id]);
    const row = await db.getFirstAsync<any>("SELECT * FROM employees WHERE id = ?", [currentEmployee.id]);
    if (row) {
      enqueueSync("Employees", row.id, {
        id: row.id,
        name: row.name,
        role: row.role,
        pin: row.pin_hash,
        defaultCommissionBasis: row.default_commission_basis,
        defaultCommissionValue: row.default_commission_value,
        active: !!row.active,
      });
    }
    await refreshCurrent();
    setEditingName(false);
  }

  const [sheetsUrl, setSheetsUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [sheetsActive, setSheetsActive] = useState(false);
  const [sheetsBusy, setSheetsBusy] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await loadSyncSettings();
      if (saved) {
        setSheetsUrl(saved.endpoint);
        setApiKey(saved.apiKey);
        setSheetsActive(true);
      }
      setPending(await pendingCount());
    })();
  }, []);

  async function saveSheetsConfig() {
    if (!sheetsUrl.trim() || !apiKey.trim()) {
      Alert.alert("Lengkapi data", "URL Apps Script dan API Key wajib diisi.");
      return;
    }
    setSheetsBusy(true);
    try {
      await testSheetsConnection(sheetsUrl, apiKey);
      await configureSync(sheetsUrl, apiKey);
      setSheetsActive(true);
      setSheetsError(null);
      setPending(await pendingCount());
      Alert.alert("Aktif", "Terhubung ke Google Sheets. Data lama dan baru dikirim otomatis, pengaturan tersimpan di HP ini.");
    } catch (e) {
      Alert.alert("Gagal terhubung", e instanceof Error ? e.message : String(e));
    } finally {
      setSheetsBusy(false);
    }
  }

  async function disableSheets() {
    await clearSyncSettings();
    setSheetsActive(false);
    setSheetsError(null);
  }

  async function runSyncNow() {
    setSyncing(true);
    try {
      await drainQueue();
      setPending(await pendingCount());
      setSheetsError(lastSheetsError());
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Pengaturan" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.md + insets.bottom, gap: spacing.md }} keyboardShouldPersistTaps="handled">

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.xs }}>Akun</Text>
          {editingName ? (
            <>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Nama baru"
                placeholderTextColor={color.textMuted}
                autoFocus
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
              <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm }}>
                <Button label="Simpan" size="sm" onPress={saveName} />
                <Button label="Batal" size="sm" variant="ghost" onPress={() => setEditingName(false)} />
              </View>
            </>
          ) : (
            <>
              <Text style={{ color: color.textSecondary, fontSize: 13 }}>{currentEmployee?.name ?? "-"}</Text>
              <Text style={{ color: color.textMuted, fontSize: 12, textTransform: "capitalize" }}>{currentEmployee?.role}</Text>
              <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm }}>
                <Button
                  label="Ubah nama"
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setNameDraft(currentEmployee?.name ?? "");
                    setEditingName(true);
                  }}
                />
                <Button label="Keluar" variant="danger" size="sm" onPress={logout} />
              </View>
            </>
          )}
        </Card>

        <PromotionsCard />

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.xs }}>Cloud (multi-device)</Text>
          {cloudSignedIn ? (
            <>
              <Text style={{ color: color.textSecondary, fontSize: 13 }}>Terhubung: {cloudEmail}</Text>
              <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2 }}>
                {cloudSyncing
                  ? "Menyinkronkan..."
                  : cloudLast
                    ? `Terakhir sinkron ${new Date(cloudLast).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                    : "Belum sinkron"}
                {cloudPending > 0 ? ` · ${cloudPending} menunggu kirim` : ""}
              </Text>
              {cloudError && <Text style={{ color: color.danger, fontSize: 12, marginTop: 4 }}>{cloudError}</Text>}
              <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm }}>
                <Button label="Sinkron sekarang" size="sm" variant="secondary" loading={cloudSyncing} onPress={() => syncNow()} />
                <Button label="Putuskan" size="sm" variant="ghost" onPress={cloudLogout} />
              </View>
            </>
          ) : (
            <>
              <Text style={{ color: color.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
                Pakai akun outlet yang sama di semua HP (kasir dan owner) supaya data tersinkron.
              </Text>
              <CloudLoginForm />
            </>
          )}
        </Card>

        <Card>
          <Text style={{ color: color.textPrimary, fontWeight: "600", marginBottom: spacing.xs }}>
            Google Sheets (laporan){sheetsActive ? "  ·  Aktif" : ""}
          </Text>
          <Text style={{ color: color.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
            Tempel URL Web App Apps Script (/exec) dan API Key dari Code.gs. Disimpan di HP, jadi tetap aktif setelah app dibuka ulang.
          </Text>
          {sheetsError && <Text style={{ color: color.danger, fontSize: 12, marginBottom: spacing.xs }}>{sheetsError}</Text>}
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
            <Button label={sheetsActive ? "Simpan ulang" : "Simpan & aktifkan"} size="sm" loading={sheetsBusy} onPress={saveSheetsConfig} />
            {sheetsActive && (
              <Button label={`Kirim sekarang (${pending})`} size="sm" variant="secondary" loading={syncing} onPress={runSyncNow} />
            )}
            {sheetsActive && <Button label="Matikan" size="sm" variant="ghost" onPress={disableSheets} />}
          </View>
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
