import { useEffect } from "react";
import { Tabs, router } from "expo-router";
import { color } from "@/constants/theme";
import { useAuthStore, PERMISSIONS } from "@/store/authStore";

/**
 * Tabs are filtered per RBAC role — a stylist, for instance, never sees
 * Finance or Settings tabs at all (not just blocked after tapping).
 */
export default function TabsLayout() {
  const currentEmployee = useAuthStore((s) => s.currentEmployee);

  useEffect(() => {
    if (!currentEmployee) router.replace("/");
  }, [currentEmployee]);

  if (!currentEmployee) return null;
  const role = currentEmployee.role;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
      }}
    >
      <Tabs.Screen name="pos" options={{ title: "Kasir", href: PERMISSIONS.pos.includes(role) ? undefined : null }} />
      <Tabs.Screen name="booking" options={{ title: "Booking", href: PERMISSIONS.booking.includes(role) ? undefined : null }} />
      <Tabs.Screen name="finance" options={{ title: "Keuangan", href: PERMISSIONS.finance.includes(role) ? undefined : null }} />
      <Tabs.Screen name="inventory" options={{ title: "Stok", href: PERMISSIONS.inventory.includes(role) ? undefined : null }} />
      <Tabs.Screen name="employees" options={{ title: "Karyawan", href: PERMISSIONS.employees.includes(role) ? undefined : null }} />
      <Tabs.Screen name="settings" options={{ title: "Pengaturan", href: PERMISSIONS.settings.includes(role) ? undefined : null }} />
    </Tabs>
  );
}
