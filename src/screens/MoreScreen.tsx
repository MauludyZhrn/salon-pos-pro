import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Icon, type IconName } from "@/components/common/Icon";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, elevation, font, radius, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { useAuthStore, PERMISSIONS } from "@/store/authStore";
import { useTodaySales } from "@/hooks/useTodaySales";
import type { Role } from "@/types";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", kasir: "Kasir", stylist: "Stylist" };

interface Row {
  label: string;
  icon: IconName;
  href: string;
  roles: Role[];
}

const ROWS: Row[] = [
  { label: "Membership & Poin", icon: "award", href: "/membership", roles: PERMISSIONS.membership },
  { label: "Karyawan & Komisi", icon: "users", href: "/employees", roles: PERMISSIONS.employees },
  { label: "Riwayat Transaksi", icon: "receipt", href: "/history", roles: PERMISSIONS.history },
  { label: "Keuangan", icon: "chart", href: "/finance", roles: PERMISSIONS.finance },
  { label: "Layanan", icon: "scissors", href: "/services", roles: PERMISSIONS.services },
  { label: "Printer & Struk", icon: "printer", href: "/printer", roles: PERMISSIONS.printer },
  { label: "Inventaris", icon: "box", href: "/inventory", roles: PERMISSIONS.inventory },
  { label: "Pengaturan", icon: "sliders", href: "/settings", roles: PERMISSIONS.settings },
];

/** Profil tab: who is logged in, today's numbers, and the entry points to every secondary screen (RBAC-filtered). */
export function MoreScreen() {
  const { listColumns, isCompactHeight, pagePadding, contentMaxWidth } = useResponsiveLayout();
  const me = useAuthStore((s) => s.currentEmployee);
  const logout = useAuthStore((s) => s.logout);
  const sales = useTodaySales();
  if (!me) return null;

  const rows = ROWS.filter((r) => r.roles.includes(me.role));
  const useGrid = listColumns >= 2;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Profil" showBack={false} />
      <ScrollView
        contentContainerStyle={{
          padding: pagePadding,
          paddingTop: spacing.xs,
          gap: spacing.md,
          width: "100%",
          maxWidth: contentMaxWidth,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: isCompactHeight || useGrid ? "row" : "column",
            alignItems: "center",
            justifyContent: isCompactHeight || useGrid ? "space-between" : "center",
            gap: spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: isCompactHeight || useGrid ? "row" : "column",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                width: isCompactHeight ? 64 : 84,
                height: isCompactHeight ? 64 : 84,
                borderRadius: isCompactHeight ? 32 : 42,
                backgroundColor: color.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 4,
                borderColor: color.surface,
                ...elevation.card,
              }}
            >
              <Text style={{ fontFamily: font.display, fontSize: isCompactHeight ? 28 : 34, fontWeight: "600", color: color.primaryDeep }}>
                {me.name.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ alignItems: isCompactHeight || useGrid ? "flex-start" : "center" }}>
              <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600" }}>
                {me.name}
              </Text>
              <View style={{ marginTop: 4, backgroundColor: color.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 3 }}>
                <Text style={{ color: color.primaryDeep, fontSize: 12, fontWeight: "700" }}>{ROLE_LABEL[me.role]}</Text>
              </View>
            </View>
          </View>

          {me.role !== "stylist" && (
            <View style={{ flexDirection: "row", gap: spacing.sm, flex: isCompactHeight || useGrid ? 1 : undefined, maxWidth: useGrid ? 440 : undefined, alignSelf: "stretch" }}>
              <Stat label="Transaksi hari ini" value={String(sales.count)} />
              <Stat label="Penjualan hari ini" value={formatRupiah(sales.total)} />
            </View>
          )}
        </View>

        {useGrid ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {rows.map((r) => (
              <Pressable
                key={r.href}
                onPress={() => router.push(r.href as never)}
                style={({ pressed }) => ({
                  width: listColumns >= 3 ? "32%" : "48.8%",
                  flexGrow: 1,
                  minHeight: 58,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: 14,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: color.border,
                  backgroundColor: pressed ? color.surfaceAlt : color.surface,
                  ...elevation.card,
                })}
              >
                <Icon name={r.icon} color={color.primaryDeep} size={22} />
                <Text style={{ flex: 1, color: color.textPrimary, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
                  {r.label}
                </Text>
                <Icon name="chevronRight" color={color.textMuted} size={18} />
              </Pressable>
            ))}
            <Pressable
              onPress={logout}
              style={({ pressed }) => ({
                width: listColumns >= 3 ? "32%" : "48.8%",
                flexGrow: 1,
                minHeight: 58,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: 14,
                paddingHorizontal: spacing.md,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: color.border,
                backgroundColor: pressed ? color.surfaceAlt : color.surface,
              })}
            >
              <Icon name="logout" color={color.danger} size={22} />
              <Text style={{ flex: 1, color: color.danger, fontSize: 15, fontWeight: "600" }}>Keluar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ backgroundColor: color.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: color.border, overflow: "hidden" }}>
            {rows.map((r, i) => (
              <Pressable
                key={r.href}
                onPress={() => router.push(r.href as never)}
                style={({ pressed }) => ({
                  minHeight: 52,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: 14,
                  paddingHorizontal: spacing.md,
                  backgroundColor: pressed ? color.surfaceAlt : color.surface,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: color.border,
                })}
              >
                <Icon name={r.icon} color={color.primaryDeep} size={22} />
                <Text style={{ flex: 1, color: color.textPrimary, fontSize: 15 }}>{r.label}</Text>
                <Icon name="chevronRight" color={color.textMuted} size={18} />
              </Pressable>
            ))}
            <Pressable
              onPress={logout}
              style={({ pressed }) => ({
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingVertical: 14,
                paddingHorizontal: spacing.md,
                backgroundColor: pressed ? color.surfaceAlt : color.surface,
                borderTopWidth: rows.length === 0 ? 0 : 1,
                borderTopColor: color.border,
              })}
            >
              <Icon name="logout" color={color.danger} size={22} />
              <Text style={{ flex: 1, color: color.danger, fontSize: 15 }}>Keluar</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.primarySoft, borderRadius: radius.xl, padding: spacing.md }}>
      <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 20, fontWeight: "600" }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ color: color.textSecondary, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
