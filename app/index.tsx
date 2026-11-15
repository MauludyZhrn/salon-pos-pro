import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, radius, spacing, type as typeScale } from "@/constants/theme";
import { getDb } from "@/services/database";
import { useCloud } from "@/services/cloudSync";
import { CloudLoginForm } from "@/components/common/CloudLoginForm";

interface EmployeeOption {
  id: string;
  name: string;
  role: string;
}

/** PIN-pad login. First run (no employees yet) shows the owner setup form instead. */
export default function LoginScreen() {
  const { orientation, isCompactHeight, isSmallPhone, pagePadding } = useResponsiveLayout();
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: pagePadding,
            }}
          >
            <View style={{ width: "100%", maxWidth: 460, alignSelf: "center" }}>
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
                  minHeight: 48,
                  marginTop: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: canSave ? color.primary : color.surfaceAlt,
                }}
              >
                <Text style={{ color: canSave ? color.textOnPrimary : color.textMuted, fontWeight: "700", fontSize: 15 }}>
                  Buat akun & masuk
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowCloud((v) => !v)}
                hitSlop={8}
                style={{ marginTop: spacing.lg, minHeight: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: color.primaryDeep, fontSize: 13, fontWeight: "600" }}>
                  {showCloud ? "Tutup" : "Sudah punya data di cloud? Sambungkan"}
                </Text>
              </Pressable>
              {showCloud && (
                <View style={{ marginTop: spacing.sm }}>
                  <CloudLoginForm label="Sambungkan & ambil data" />
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const keySize = isCompactHeight ? 56 : isSmallPhone ? 62 : 68;
  const keypadWidth = keySize * 3 + spacing.sm * 2;
  const isSideBySide = orientation === "landscape" && !isSmallPhone;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: pagePadding,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: isSideBySide ? 760 : 420,
            flexDirection: isSideBySide ? "row" : "column",
            alignItems: "center",
            justifyContent: "center",
            gap: isSideBySide ? spacing.xl : spacing.md,
          }}
        >
          <View style={{ flex: isSideBySide ? 1 : undefined, alignItems: isSideBySide ? "flex-start" : "center" }}>
            <Text
              style={{
                color: color.textPrimary,
                fontSize: isCompactHeight ? 24 : typeScale.display.fontSize,
                fontWeight: "700",
                marginBottom: spacing.xxs,
                textAlign: isSideBySide ? "left" : "center",
              }}
            >
              Salon POS Pro
            </Text>
            <Text
              style={{
                color: color.textMuted,
                fontSize: 13,
                marginBottom: spacing.md,
                textAlign: isSideBySide ? "left" : "center",
              }}
            >
              Pilih karyawan, masukkan PIN
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
                justifyContent: isSideBySide ? "flex-start" : "center",
              }}
            >
              {employees.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    setSelected(e.id);
                    setPin("");
                  }}
                  hitSlop={4}
                  style={({ pressed }) => ({
                    minHeight: 40,
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.pill,
                    backgroundColor: selected === e.id ? color.primary : pressed ? color.border : color.surfaceAlt,
                    borderWidth: 1,
                    borderColor: selected === e.id ? color.primary : color.border,
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <Text style={{ color: selected === e.id ? color.textOnPrimary : color.textSecondary, fontWeight: "600", fontSize: 14 }}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: i < pin.length ? color.primary : color.surfaceAlt,
                    borderWidth: 1,
                    borderColor: i < pin.length ? color.primaryDeep : color.borderStrong,
                  }}
                />
              ))}
            </View>

            {error && <Text style={{ color: color.danger, fontSize: 13, marginBottom: spacing.xs }}>{error}</Text>}

            <View style={{ width: keypadWidth, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" }}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"].map((k) => (
                <Pressable
                  key={k}
                  disabled={isUnlocking}
                  onPress={() => (k === "⌫" ? setPin((p) => p.slice(0, -1)) : handlePinDigit(k))}
                  style={({ pressed }) => ({
                    width: keySize,
                    height: keySize,
                    borderRadius: radius.lg,
                    backgroundColor: pressed ? color.primarySoft : color.surfaceAlt,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: color.border,
                  })}
                >
                  <Text style={{ color: color.textPrimary, fontSize: isCompactHeight ? 18 : 20, fontWeight: "600" }}>{k}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const setupInput = {
  minHeight: 48,
  backgroundColor: color.surfaceAlt,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.border,
  color: color.textPrimary,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  fontSize: 16,
} as const;
