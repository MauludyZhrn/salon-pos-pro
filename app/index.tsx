import { useState } from "react";
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { color, radius, spacing, type as typeScale } from "@/constants/theme";
import { getDb } from "@/services/database";
import { useEffect } from "react";
import { useCloud } from "@/services/cloudSync";
import { CloudLoginForm } from "@/components/common/CloudLoginForm";

interface EmployeeOption {
  id: string;
  name: string;
  role: string;
}

/** PIN-pad login. First run (no employees yet) shows the owner setup form instead. */
export default function LoginScreen() {
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const error = useAuthStore((s) => s.error);
  const isUnlocking = useAuthStore((s) => s.isUnlocking);
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [loaded, setLoaded] = useState(false);
  const createOwner = useAuthStore((s) => s.createOwner);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPin, setOwnerPin] = useState("");
  const [showCloud, setShowCloud] = useState(false);
  const syncVersion = useCloud((c) => c.version);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const rows = await db.getAllAsync<any>("SELECT id, name, role FROM employees WHERE active = 1 ORDER BY role");
      setEmployees(rows);
      if (rows[0]) setSelected(rows[0].id);
      setLoaded(true);
    })();
  }, [syncVersion]);

  useEffect(() => {
    if (currentEmployee) router.replace("/(tabs)/pos");
  }, [currentEmployee]);

  async function handlePinDigit(d: string) {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4 && selected) {
      const ok = await loginWithPin(selected, next);
      if (!ok) setPin("");
    }
  }

  if (loaded && employees.length === 0) {
    const canSave = ownerName.trim().length > 0 && ownerPin.length === 4;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "center", padding: spacing.lg }}
        >
          <Text style={{ color: color.textPrimary, fontSize: typeScale.display.fontSize, fontWeight: "700", marginBottom: spacing.xs }}>
            Selamat datang
          </Text>
          <Text style={{ color: color.textMuted, fontSize: 13, marginBottom: spacing.lg }}>
            Buat akun owner untuk mulai. Nama dan PIN bisa diubah nanti di tab Karyawan.
          </Text>

          <Text style={{ color: color.textSecondary, fontSize: 13, marginBottom: spacing.xxs }}>Nama owner</Text>
          <TextInput
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="Nama Anda"
            placeholderTextColor={color.textMuted}
            style={setupInput}
          />

          <Text style={{ color: color.textSecondary, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xxs }}>PIN (4 digit)</Text>
          <TextInput
            value={ownerPin}
            onChangeText={(v) => setOwnerPin(v.replace(/\D/g, "").slice(0, 4))}
            keyboardType="numeric"
            secureTextEntry
            placeholder="••••"
            placeholderTextColor={color.textMuted}
            style={setupInput}
          />

          {error && <Text style={{ color: color.danger, fontSize: 13, marginTop: spacing.sm }}>{error}</Text>}

          <Pressable
            disabled={!canSave || isUnlocking}
            onPress={() => createOwner(ownerName, ownerPin)}
            style={{
              marginTop: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.lg,
              alignItems: "center",
              backgroundColor: canSave ? color.primary : color.surfaceAlt,
            }}
          >
            <Text style={{ color: canSave ? color.textOnPrimary : color.textMuted, fontWeight: "700", fontSize: 15 }}>
              Buat akun & masuk
            </Text>
          </Pressable>

          <Pressable onPress={() => setShowCloud((v) => !v)} style={{ marginTop: spacing.lg, alignItems: "center" }}>
            <Text style={{ color: color.primaryDeep, fontSize: 13, fontWeight: "600" }}>
              {showCloud ? "Tutup" : "Sudah punya data di cloud? Sambungkan"}
            </Text>
          </Pressable>
          {showCloud && (
            <View style={{ marginTop: spacing.sm }}>
              <CloudLoginForm label="Sambungkan & ambil data" />
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
      <Text style={{ color: color.textPrimary, fontSize: typeScale.display.fontSize, fontWeight: "700", marginBottom: spacing.xs }}>
        Salon POS Pro
      </Text>
      <Text style={{ color: color.textMuted, fontSize: 13, marginBottom: spacing.lg }}>Pilih karyawan, masukkan PIN</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "center", marginBottom: spacing.lg }}>
        {employees.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => {
              setSelected(e.id);
              setPin("");
            }}
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: radius.pill,
              backgroundColor: selected === e.id ? color.primary : color.surfaceAlt,
              borderWidth: 1,
              borderColor: selected === e.id ? color.primary : color.border,
            }}
          >
            <Text style={{ color: selected === e.id ? color.textOnPrimary : color.textSecondary, fontWeight: "600" }}>
              {e.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: i < pin.length ? color.primary : color.surfaceAlt,
              borderWidth: 1,
              borderColor: color.border,
            }}
          />
        ))}
      </View>

      {error && <Text style={{ color: color.danger, fontSize: 13, marginBottom: spacing.sm }}>{error}</Text>}

      <View style={{ width: 240, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"].map((k) => (
          <Pressable
            key={k}
            disabled={isUnlocking}
            onPress={() => (k === "⌫" ? setPin((p) => p.slice(0, -1)) : handlePinDigit(k))}
            style={{
              width: 68,
              height: 68,
              borderRadius: radius.lg,
              backgroundColor: color.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: color.border,
            }}
          >
            <Text style={{ color: color.textPrimary, fontSize: 20, fontWeight: "600" }}>{k}</Text>
          </Pressable>
        ))}
      </View>

    </SafeAreaView>
  );
}

const setupInput = {
  backgroundColor: color.surfaceAlt,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.border,
  color: color.textPrimary,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  fontSize: 16,
} as const;
