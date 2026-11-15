import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView } from "react-native";
import { color, radius, spacing } from "@/constants/theme";
import { Button } from "@/components/common/Button";
import { BottomSheet } from "@/components/common/BottomSheet";
import { getDb } from "@/services/database";
import { enqueueSync } from "@/services/syncQueue";
import { useAuthStore } from "@/store/authStore";
import type { Employee, Role } from "@/types";

interface EmployeeFormModalProps {
  visible: boolean;
  employee: Employee | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
}

const ROLES: Role[] = ["admin", "kasir", "stylist"];

async function hashPin(pin: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = (hash << 5) - hash + pin.charCodeAt(i);
    hash |= 0;
  }
  return `v1:${hash}`;
}

/** Create/edit employee: name, role (RBAC), PIN, default commission basis/value. */
export function EmployeeFormModal({ visible, employee, onClose, onSaved }: EmployeeFormModalProps) {
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("stylist");
  const [pin, setPin] = useState("");
  const [basis, setBasis] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setRole(employee.role);
      setActive(employee.active);
      setPin("");
      setBasis(employee.defaultCommissionBasis);
      setValue(
        employee.defaultCommissionBasis === "percent"
          ? String(employee.defaultCommissionValue / 100)
          : String(employee.defaultCommissionValue)
      );
    } else {
      setName("");
      setActive(true);
      setRole("stylist");
      setPin("");
      setBasis("percent");
      setValue("");
    }
  }, [employee, visible]);

  async function handleSave() {
    if (!name.trim()) return Alert.alert("Nama wajib diisi");
    if (!employee && pin.length !== 4) return Alert.alert("PIN harus 4 digit");

    const commissionValue = basis === "percent" ? Math.round(Number(value) * 100) : Number(value) || 0;

    setSaving(true);
    try {
      const db = await getDb();
      const id = employee?.id ?? `emp-${Date.now()}`;

      if (employee && employee.role === "admin" && (role !== "admin" || !active)) {
        const others = await db.getFirstAsync<{ cnt: number }>(
          "SELECT COUNT(*) as cnt FROM employees WHERE role = 'admin' AND active = 1 AND id != ?",
          [id]
        );
        if (!others || others.cnt === 0) {
          Alert.alert("Tidak bisa", "Harus ada minimal satu admin aktif. Jadikan karyawan lain admin dulu.");
          return;
        }
      }

      if (employee) {
        const pinHash = pin ? await hashPin(pin) : employee.pinHash;
        await db.runAsync(
          `UPDATE employees SET name = ?, role = ?, pin_hash = ?, default_commission_basis = ?, default_commission_value = ?, active = ? WHERE id = ?`,
          [name.trim(), role, pinHash, basis, commissionValue, active ? 1 : 0, id]
        );
      } else {
        const pinHash = await hashPin(pin);
        await db.runAsync(
          `INSERT INTO employees (id, name, role, pin_hash, default_commission_basis, default_commission_value, active)
           VALUES (?,?,?,?,?,?,1)`,
          [id, name.trim(), role, pinHash, basis, commissionValue]
        );
      }

      const row = await db.getFirstAsync<any>("SELECT * FROM employees WHERE id = ?", [id]);
      if (row) {
        enqueueSync("Employees", id, {
          id: row.id,
          name: row.name,
          role: row.role,
          pin: row.pin_hash,
          defaultCommissionBasis: row.default_commission_basis,
          defaultCommissionValue: row.default_commission_value,
          active: !!row.active,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      Alert.alert("Gagal menyimpan", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!employee) return;
    if (currentEmployee?.id === employee.id) {
      return Alert.alert("Tidak bisa dihapus", "Akun yang sedang dipakai tidak bisa dihapus. Masuk sebagai admin lain dulu.");
    }
    const db = await getDb();

    if (employee.role === "admin") {
      const others = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) AS c FROM employees WHERE role = 'admin' AND active = 1 AND id <> ?",
        [employee.id]
      );
      if (!others || others.c === 0) {
        return Alert.alert("Tidak bisa dihapus", "Harus ada minimal satu admin aktif.");
      }
    }

    const refs = await db.getFirstAsync<{ c: number }>(
      `SELECT (SELECT COUNT(*) FROM transactions WHERE cashier_id = ?)
            + (SELECT COUNT(*) FROM transaction_items WHERE stylist_id = ?)
            + (SELECT COUNT(*) FROM bookings WHERE stylist_id = ?) AS c`,
      [employee.id, employee.id, employee.id]
    );

    if (refs && refs.c > 0) {
      // Hard delete would orphan sales, commission and booking history.
      Alert.alert(
        "Punya riwayat",
        `${employee.name} tercatat di ${refs.c} transaksi/booking. Dihapus akan merusak laporan dan komisi, jadi nonaktifkan saja.`,
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Nonaktifkan",
            onPress: async () => {
              await db.runAsync("UPDATE employees SET active = 0 WHERE id = ?", [employee.id]);
              onSaved();
              onClose();
            },
          },
        ]
      );
      return;
    }

    Alert.alert("Hapus karyawan?", `${employee.name} akan dihapus permanen.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          await db.runAsync("DELETE FROM employees WHERE id = ?", [employee.id]);
          onSaved();
          onClose();
        },
      },
    ]);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View>
          <Text style={{ color: color.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.md }}>
            {employee ? "Edit Karyawan" : "Tambah Karyawan"}
          </Text>

          <TextInput value={name} onChangeText={setName} placeholder="Nama" placeholderTextColor={color.textMuted} style={inputStyle} />

          <Text style={{ color: color.textSecondary, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xxs }}>Role</Text>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            {ROLES.map((r) => (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.pill,
                  backgroundColor: role === r ? color.primary : color.surfaceAlt,
                  borderWidth: 1,
                  borderColor: role === r ? color.primary : color.border,
                }}
              >
                <Text style={{ color: role === r ? color.textOnPrimary : color.textSecondary, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ color: color.textSecondary, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xxs }}>
            PIN {employee ? "(kosongkan jika tidak diubah)" : "(4 digit)"}
          </Text>
          <TextInput
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
            keyboardType="numeric"
            secureTextEntry
            placeholder="••••"
            placeholderTextColor={color.textMuted}
            style={inputStyle}
          />

          <Text style={{ color: color.textSecondary, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.xxs }}>
            Komisi default
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>
            <Pressable
              onPress={() => setBasis("percent")}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: basis === "percent" ? color.primary : color.surfaceAlt,
                borderWidth: 1,
                borderColor: basis === "percent" ? color.primary : color.border,
              }}
            >
              <Text style={{ color: basis === "percent" ? color.textOnPrimary : color.textSecondary, fontSize: 12, fontWeight: "600" }}>
                Persen (%)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setBasis("fixed")}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: basis === "fixed" ? color.primary : color.surfaceAlt,
                borderWidth: 1,
                borderColor: basis === "fixed" ? color.primary : color.border,
              }}
            >
              <Text style={{ color: basis === "fixed" ? color.textOnPrimary : color.textSecondary, fontSize: 12, fontWeight: "600" }}>
                Nominal tetap (Rp)
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            placeholder={basis === "percent" ? "contoh: 30" : "contoh: 25000"}
            placeholderTextColor={color.textMuted}
            style={inputStyle}
          />

          {employee && (
            <Button
              label={active ? "Nonaktifkan karyawan" : "Aktifkan kembali"}
              variant="ghost"
              fullWidth
              style={{ marginTop: spacing.sm }}
              onPress={() => setActive((a) => !a)}
            />
          )}
          {employee && !active && (
            <Text style={{ color: color.danger, fontSize: 12, textAlign: "center" }}>
              Nonaktif: tidak bisa login dan tidak muncul di pilihan stylist. Tekan Simpan untuk menerapkan.
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <Button label="Batal" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
            <Button label="Simpan" loading={saving} style={{ flex: 1 }} onPress={handleSave} />
          </View>
          {employee && (
            <Button label="Hapus karyawan" variant="danger" fullWidth style={{ marginTop: spacing.sm }} onPress={handleDelete} />
          )}
        </View>
      </ScrollView>
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
  fontSize: 14,
} as const;
