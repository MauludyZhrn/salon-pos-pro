import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloud } from "@/services/cloudSync";
import { Card } from "@/components/common/Card";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Button } from "@/components/common/Button";
import { EmployeeFormModal } from "@/components/employee/EmployeeFormModal";
import { color, radius, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { getDb } from "@/services/database";
import { useFinanceStore } from "@/store/financeStore";
import { useAuthStore } from "@/store/authStore";
import type { Employee } from "@/types";

/**
 * Employee & commission management: RBAC role per employee, default
 * commission basis/value. Per-transaction commission actuals are read from
 * journal_entries (beban_komisi) via financeStore, grouped here by stylist
 * for a payroll-ready summary.
 */
export function EmployeeScreen() {
  const insets = useSafeAreaInsets();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const pnlByDay = useFinanceStore((s) => s.pnlByDay);
  const refreshCurrent = useAuthStore((s) => s.refreshCurrent);
  const totalCommission = pnlByDay.reduce((s, d) => s + d.bebanKomisi, 0);

  const reload = useCallback(async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM employees ORDER BY role, name");
    setEmployees(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        pinHash: r.pin_hash,
        defaultCommissionBasis: r.default_commission_basis,
        defaultCommissionValue: r.default_commission_value,
        active: !!r.active,
      }))
    );
  }, []);

  const syncVersion = useCloud((c) => c.version);
  useEffect(() => {
    reload();
  }, [reload, syncVersion]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Karyawan & Komisi" />
      <View style={{ padding: spacing.md, paddingTop: spacing.xs }}>
        <Card>
          <Text style={{ color: color.textMuted, fontSize: 11 }}>Total komisi terutang (30 hari)</Text>
          <Text style={{ color: color.primaryDeep, fontSize: 18, fontWeight: "700" }}>{formatRupiah(totalCommission)}</Text>
        </Card>
      </View>

      <FlatList
        data={employees}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0, paddingBottom: spacing.md + insets.bottom, gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={{ color: color.textMuted, textAlign: "center", marginTop: spacing.lg }}>Belum ada karyawan.</Text>
        }
        renderItem={({ item: emp }) => (
          <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={{ color: emp.active ? color.textPrimary : color.textMuted, fontSize: 14, fontWeight: "600" }}>
                {emp.name}
                {emp.active ? "" : "  (nonaktif)"}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: 4 }}>
                <RoleBadge role={emp.role} />
                <Text style={{ color: color.textMuted, fontSize: 11 }}>
                  Komisi default:{" "}
                  {emp.defaultCommissionBasis === "percent"
                    ? `${(emp.defaultCommissionValue / 100).toFixed(1)}%`
                    : formatRupiah(emp.defaultCommissionValue)}
                </Text>
              </View>
            </View>
            <Button
              size="sm"
              variant="secondary"
              label="Edit"
              onPress={() => {
                setEditing(emp);
                setFormOpen(true);
              }}
            />
          </Card>
        )}
        ListFooterComponent={
          <Button
            label="+ Tambah Karyawan"
            variant="secondary"
            fullWidth
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            style={{ marginTop: spacing.sm }}
          />
        }
      />

      <EmployeeFormModal
        visible={formOpen}
        employee={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          reload();
          refreshCurrent();
        }}
      />
    </SafeAreaView>
  );
}

function RoleBadge({ role }: { role: Employee["role"] }) {
  const map = { admin: color.primaryDeep, kasir: "#5468A0", stylist: "#3F7D5C" };
  return (
    <View
      style={{
        backgroundColor: `${map[role]}22`,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.xs,
        paddingVertical: 1,
      }}
    >
      <Text style={{ color: map[role], fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{role}</Text>
    </View>
  );
}
