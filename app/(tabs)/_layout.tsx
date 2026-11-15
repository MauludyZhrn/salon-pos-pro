import { useEffect } from "react";
import type { ColorValue } from "react-native";
import { Tabs, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color } from "@/constants/theme";
import { useAuthStore, PERMISSIONS } from "@/store/authStore";
import { usePosStore } from "@/store/posStore";
import { Icon, type IconName } from "@/components/common/Icon";

const icon = (name: IconName) => ({ color: c }: { color: ColorValue }) => <Icon name={name} color={String(c)} size={22} />;

/**
 * Four tabs: Kasir, Booking, Keranjang, Profil. Finance / Inventory /
 * Employees / Settings are pushed screens reached from Profil. RBAC hides
 * tabs per role (a stylist only sees Booking and Profil).
 */
export default function TabsLayout() {
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const cartCount = usePosStore((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const insets = useSafeAreaInsets();
  const { isTablet, isCompactHeight } = useResponsiveLayout();

  useEffect(() => {
    if (!currentEmployee) router.replace("/");
  }, [currentEmployee]);

  if (!currentEmployee) return null;
  const role = currentEmployee.role;
  const besideIcon = isTablet || isCompactHeight;
  const baseHeight = isCompactHeight ? 48 : isTablet ? 60 : 58;
  const bottomPad = Math.max(insets.bottom, isCompactHeight ? 4 : 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.bg },
        tabBarActiveTintColor: color.primaryDeep,
        tabBarInactiveTintColor: color.textMuted,
        tabBarLabelPosition: besideIcon ? "beside-icon" : "below-icon",
        tabBarLabelStyle: {
          fontSize: isTablet ? 13 : 11,
          fontWeight: "600",
        },
        tabBarItemStyle: {
          minHeight: 44,
          paddingVertical: isCompactHeight ? 2 : 4,
        },
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          height: baseHeight + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: isCompactHeight ? 4 : 6,
          paddingHorizontal: isTablet ? 24 : 4,
        },
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
          tabBarBadgeStyle: { backgroundColor: color.primary, color: color.textOnPrimary, fontSize: 10, fontWeight: "700" },
          href: PERMISSIONS.pos.includes(role) ? undefined : null,
        }}
      />
      <Tabs.Screen name="more" options={{ title: "Profil", tabBarIcon: icon("user") }} />
    </Tabs>
  );
}
