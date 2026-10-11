import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { color, radius, spacing, type as typeScale } from "@/constants/theme";
import { getDb } from "@/services/database";
import { useEffect } from "react";

interface EmployeeOption {
  id: string;
  name: string;
  role: string;
}

/** PIN-pad login — picks employee, enters 4-digit PIN. Demo PIN: 1111. */
export default function LoginScreen() {
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const error = useAuthStore((s) => s.error);
  const isUnlocking = useAuthStore((s) => s.isUnlocking);
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const rows = await db.getAllAsync<any>("SELECT id, name, role FROM employees WHERE active = 1 ORDER BY role");
      setEmployees(rows);
      if (rows[0]) setSelected(rows[0].id);
    })();
  }, []);

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
