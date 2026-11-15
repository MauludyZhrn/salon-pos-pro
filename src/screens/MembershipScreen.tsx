import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Card } from "@/components/common/Card";
import { Chip } from "@/components/common/Chip";
import { Button } from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { StampCardView } from "@/components/member/StampCardView";
import { MemberFormModal } from "@/components/member/MemberFormModal";
import { MemberDetailModal } from "@/components/member/MemberDetailModal";
import { color, font, radius, spacing } from "@/constants/theme";
import { useMemberStore } from "@/store/memberStore";
import { usePosStore } from "@/store/posStore";
import { useCloud } from "@/services/cloudSync";
import { FREE_TREATMENT_POINTS, POINTS_PER_TREATMENT } from "@/utils/membership";
import type { Member } from "@/types";

type FilterMode = "all" | "ready_free" | "active";

/**
 * Halaman Membership & Poin (diakses dari tab Profil):
 * - Sistem: 1x treatment = 10 poin, 10x treatment (100 poin) = Gratis 1x treatment.
 * - Kelola daftar member, kartu stamp 10x treatment, tambah poin, klaim gratis, atau pakai langsung di Kasir.
 */
export function MembershipScreen() {
  const insets = useSafeAreaInsets();
  const members = useMemberStore((s) => s.members);
  const load = useMemberStore((s) => s.load);
  const addTreatmentPoints = useMemberStore((s) => s.addTreatmentPoints);
  const setPosMember = usePosStore((s) => s.setMember);
  const syncVersion = useCloud((c) => c.version);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [detailMember, setDetailMember] = useState<Member | null>(null);

  useEffect(() => {
    load();
  }, [load, syncVersion]);

  const stats = useMemo(() => {
    const activeMembers = members.filter((m) => m.active);
    const readyCount = activeMembers.filter((m) => m.points >= FREE_TREATMENT_POINTS).length;
    const totalRedeemed = members.reduce((sum, m) => sum + m.totalRedeemed, 0);
    return {
      totalActive: activeMembers.length,
      readyCount,
      totalRedeemed,
    };
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "ready_free" && m.points < FREE_TREATMENT_POINTS) return false;
      if (filter === "active" && !m.active) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        (m.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [members, query, filter]);

  function quickAddTreatment(member: Member) {
    Alert.alert(
      "Tambah 1x Treatment?",
      `Tambahkan +${POINTS_PER_TREATMENT} poin (1x treatment) untuk ${member.name}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: `+${POINTS_PER_TREATMENT} Poin`,
          onPress: async () => {
            try {
              await addTreatmentPoints(member.id, 1, "Catat 1x treatment manual");
            } catch (e) {
              Alert.alert("Gagal", e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader
        title="Membership & Poin"
        right={
          <Pressable
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            hitSlop={10}
            accessibilityLabel="Tambah Member"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: color.primary,
            }}
          >
            <Icon name="plus" color={color.textOnPrimary} size={20} />
          </Pressable>
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.md,
          paddingTop: spacing.xs,
          paddingBottom: spacing.md + insets.bottom,
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.xs }}>
            <View
              style={{
                backgroundColor: color.primarySoft,
                borderRadius: radius.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: color.borderStrong,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: color.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="gift" color={color.primaryDeep} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 16, fontWeight: "600" }}>
                  Program Loyalitas 10x Treatment
                </Text>
                <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 2 }}>
                  1x Treatment = <Text style={{ fontWeight: "700", color: color.primaryDeep }}>10 Poin</Text> • Kumpulkan{" "}
                  <Text style={{ fontWeight: "700", color: color.primaryDeep }}>100 Poin (10x Treatment)</Text> untuk{" "}
                  <Text style={{ fontWeight: "700", color: color.accent }}>Gratis 1x Treatment</Text>!
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              <SummaryBox label="Member Aktif" value={String(stats.totalActive)} />
              <SummaryBox label="Siap Gratis (≥100p)" value={String(stats.readyCount)} highlight={stats.readyCount > 0} />
              <SummaryBox label="Gratis Terklaim" value={`${stats.totalRedeemed}x`} />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: color.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: color.border,
                paddingHorizontal: spacing.sm,
              }}
            >
              <Icon name="search" color={color.textMuted} size={18} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Cari nama member, kode MBR, atau no. HP..."
                placeholderTextColor={color.textMuted}
                style={{ flex: 1, color: color.textPrimary, paddingVertical: 10, paddingHorizontal: spacing.xs, fontSize: 14 }}
              />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              <Chip label={`Semua (${members.length})`} active={filter === "all"} onPress={() => setFilter("all")} />
              <Chip
                label={`Siap Gratis (${stats.readyCount})`}
                active={filter === "ready_free"}
                onPress={() => setFilter("ready_free")}
              />
              <Chip label="Aktif" active={filter === "active"} onPress={() => setFilter("active")} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Icon name="award" color={color.borderStrong} size={44} />
            <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600", marginTop: spacing.sm }}>
              {query.trim() || filter !== "all" ? "Tidak ada member yang cocok" : "Belum ada member terdaftar"}
            </Text>
            <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 4, textAlign: "center" }}>
              Tambahkan pelanggan ke membership untuk mulai mengumpulkan 10 poin setiap 1x treatment.
            </Text>
          </Card>
        }
        renderItem={({ item: member }) => {
          const readyFreeCount = Math.floor(member.points / FREE_TREATMENT_POINTS);
          return (
            <Pressable onPress={() => setDetailMember(member)}>
              <Card style={{ opacity: member.active ? 1 : 0.6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: readyFreeCount > 0 ? "#DDEFE3" : color.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: font.display,
                          fontSize: 18,
                          fontWeight: "700",
                          color: readyFreeCount > 0 ? color.accent : color.primaryDeep,
                        }}
                      >
                        {member.name.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
                        {member.name}
                        {member.active ? "" : " (nonaktif)"}
                      </Text>
                      <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                        {member.memberCode}
                        {member.phone ? `  •  ${member.phone}` : ""}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: readyFreeCount > 0 ? color.accent : color.primarySoft,
                      borderRadius: radius.pill,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: readyFreeCount > 0 ? color.accentOn : color.primaryDeep,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      {member.points} Poin
                    </Text>
                  </View>
                </View>

                <StampCardView points={member.points} compact />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTopWidth: 1,
                    borderTopColor: color.border,
                    marginTop: spacing.sm,
                    paddingTop: spacing.xs,
                    gap: spacing.xs,
                  }}
                >
                  <Text style={{ color: color.textMuted, fontSize: 11, flex: 1 }}>
                    Total {member.totalTreatments}x treatment • {member.totalRedeemed}x gratis dipakai
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Button
                      label="+10 Poin"
                      size="sm"
                      variant="secondary"
                      onPress={() => quickAddTreatment(member)}
                    />
                    <Button
                      label={readyFreeCount > 0 ? "Klaim di Kasir" : "Ke Kasir"}
                      size="sm"
                      variant={readyFreeCount > 0 ? "primary" : "secondary"}
                      onPress={() => {
                        setPosMember(member);
                        router.push("/(tabs)/pos");
                      }}
                    />
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Button
            label="+ Tambah Member Baru"
            variant="secondary"
            fullWidth
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            style={{ marginTop: spacing.xs }}
          />
        }
      />

      <MemberDetailModal
        visible={detailMember !== null}
        member={detailMember}
        onClose={() => setDetailMember(null)}
        onEdit={(m) => {
          setDetailMember(null);
          setEditing(m);
          setFormOpen(true);
        }}
      />

      <MemberFormModal
        visible={formOpen}
        member={editing}
        onClose={() => setFormOpen(false)}
      />
    </SafeAreaView>
  );
}

function SummaryBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: highlight ? "#DDEFE3" : color.surface,
        borderRadius: radius.lg,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: highlight ? color.accent : color.border,
      }}
    >
      <Text
        style={{
          color: highlight ? color.accent : color.primaryDeep,
          fontFamily: font.display,
          fontSize: 20,
          fontWeight: "700",
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={{ color: color.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
