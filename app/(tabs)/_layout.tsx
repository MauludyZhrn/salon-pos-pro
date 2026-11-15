import { useEffect } from "react";
import type { ColorValue } from "react-native";
import { Tabs, router } from "expo-router";
import { color } from "@/constants/theme";
import { useAuthStore, PERMISSIONS } from "@/store/authStore";
import { usePosStore } from "@/store/posStore";
import { Icon, type IconName } from "@/components/common/Icon";

const icon = (name: IconName) => ({ color: c }: { color: ColorValue }) => <Icon name={name} color={String(c)} size={24} />;

/**
 * Four tabs: Kasir, Booking, Keranjang, Profil. Finance / Inventory /
 * Employees / Settings are pushed screens reached from Profil. RBAC hides
 * tabs per role (a stylist only sees Booking and Profil).
 */
export default function TabsLayout() {
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const cartCount = usePosStore((s) => s.lines.reduce((n, l) => n + l.qty, 0));

  useEffect(() => {
    if (!currentEmployee) router.replace("/");
  }, [currentEmployee]);

  if (!currentEmployee) return null;
  const role = currentEmployee.role;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.bg },
        tabBarActiveTintColor: color.primaryDeep,
        tabBarInactiveTintColor: color.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
      }}
    >
      <Tabs.Screen name="pos" options={{ title: "Kasir", tabBarIcon: icon("home"), href: PERMISSIONS.pos.includes(role) ? undefined : null }} />
      <Tabs.Screen name="booking" options={{ title: "Booking", tabBarIcon: icon("calendar"), href: PERMISSIONS.booking.includes(role) ? undefined : null }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Keranjang",
          tabBarIcon: icon("cart"),
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: { backgroundColor: color.primary, color: color.textOnPrimary, fontSize: 10 },
          href: PERMISSIONS.pos.includes(role) ? undefined : null,
        }}
      />
      <Tabs.Screen name="more" options={{ title: "Profil", tabBarIcon: icon("user") }} />
    </Tabs>
  );
}
