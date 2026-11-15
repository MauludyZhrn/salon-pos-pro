import { useCallback, useEffect, useState } from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { StampCardView } from "@/components/member/StampCardView";
import { color, font, radius, spacing } from "@/constants/theme";
import { useMemberStore } from "@/store/memberStore";
import { usePosStore } from "@/store/posStore";
import { FREE_TREATMENT_POINTS, POINTS_PER_TREATMENT } from "@/utils/membership";
import type { Member, MemberPointLog } from "@/types";

interface MemberDetailModalProps {
  visible: boolean;
  member: Member | null;
  onClose: () => void;
  onEdit: (member: Member) => void;
}

/** Detail member: kartu stamp 10x treatment, tombol tambah poin / klaim gratis, pakai di kasir, dan riwayat poin. */
export function MemberDetailModal({ visible, member, onClose, onEdit }: MemberDetailModalProps) {
  const members = useMemberStore((s) => s.members);
  const addTreatmentPoints = useMemberStore((s) => s.addTreatmentPoints);
  const redeemFreeTreatment = useMemberStore((s) => s.redeemFreeTreatment);
  const getLogs = useMemberStore((s) => s.getLogs);
  const setPosMember = usePosStore((s) => s.setMember);

  const liveMember = members.find((m) => m.id === member?.id) ?? member;
  const [logs, setLogs] = useState<MemberPointLog[]>([]);
  const [busy, setBusy] = useState(false);

  const reloadLogs = useCallback(async () => {
    if (!liveMember) return;
    const rows = await getLogs(liveMember.id);
    setLogs(rows);
  }, [liveMember, getLogs]);

  useEffect(() => {
    if (visible && liveMember) {
      reloadLogs();
    }
  }, [visible, liveMember, reloadLogs]);

  if (!liveMember) return null;

  const canRedeem = liveMember.points >= FREE_TREATMENT_POINTS;

  function handleAddTreatment() {
    if (!liveMember) return;
    Alert.alert(
      "Tambah 1x Treatment?",
      `Tambahkan +${POINTS_PER_TREATMENT} poin (1x treatment) untuk ${liveMember.name}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: `+${POINTS_PER_TREATMENT} Poin`,
          onPress: async () => {
            setBusy(true);
            try {
              await addTreatmentPoints(liveMember.id, 1, "Catat 1x treatment manual");
              await reloadLogs();
            } catch (e) {
              Alert.alert("Gagal", e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function handleRedeemFree() {
    if (!liveMember) return;
    if (!canRedeem) {
      return Alert.alert(
        "Poin Belum Cukup",
        `Poin saat ini ${liveMember.points} poin. Butuh minimal ${FREE_TREATMENT_POINTS} poin (10x treatment) untuk klaim Gratis 1x Treatment.`
      );
    }
    Alert.alert(
      "Klaim Gratis 1x Treatment?",
      `Tukar ${FREE_TREATMENT_POINTS} poin milik ${liveMember.name} untuk 1x Gratis Treatment?\n\nTip: Anda juga bisa menekan "Pakai di Kasir" agar potongan gratis tercatat langsung di struk transaksi.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Klaim Langsung (-100 Poin)",
          onPress: async () => {
            setBusy(true);
            try {
              await redeemFreeTreatment(liveMember.id, "Klaim Gratis 1x Treatment");
              await reloadLogs();
              Alert.alert("Berhasil!", `1x Gratis Treatment untuk ${liveMember.name} berhasil diklaim.`);
            } catch (e) {
              Alert.alert("Gagal", e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  function handleUseInPos() {
    if (!liveMember) return;
    setPosMember(liveMember);
    onClose();
    router.push("/(tabs)/pos");
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.xs }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600" }} numberOfLines={1}>
              {liveMember.name}
            </Text>
            <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 2 }}>
              {liveMember.memberCode}
              {liveMember.phone ? `  •  ${liveMember.phone}` : ""}
            </Text>
          </View>
          <Button label="Edit" size="sm" variant="secondary" onPress={() => onEdit(liveMember)} />
        </View>

        {liveMember.notes ? (
          <Text style={{ color: color.textMuted, fontSize: 12, fontStyle: "italic", marginBottom: spacing.xs }}>
            Catatan: {liveMember.notes}
          </Text>
        ) : null}

        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <StampCardView points={liveMember.points} />

          <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm }}>
            <MiniStat label="Poin Aktif" value={`${liveMember.points} poin`} />
            <MiniStat label="Total Treatment" value={`${liveMember.totalTreatments}x`} />
            <MiniStat label="Gratis Diklaim" value={`${liveMember.totalRedeemed}x`} />
          </View>

          <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
            <Button label="Pakai Member Ini di Kasir (POS)" fullWidth onPress={handleUseInPos} />
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              <Button
                label="+1 Treatment (+10p)"
                variant="secondary"
                loading={busy}
                onPress={handleAddTreatment}
                style={{ flex: 1 }}
              />
              <Button
                label="Klaim Gratis (-100p)"
                variant={canRedeem ? "primary" : "secondary"}
                disabled={!canRedeem || busy}
                onPress={handleRedeemFree}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 16, fontWeight: "600", marginTop: spacing.md, marginBottom: spacing.xs }}>
            Riwayat Poin & Treatment
          </Text>
          {logs.length === 0 ? (
            <Text style={{ color: color.textMuted, fontSize: 12, paddingVertical: spacing.sm }}>
              Belum ada riwayat poin untuk member ini.
            </Text>
          ) : (
            <View style={{ borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, overflow: "hidden", backgroundColor: color.surface }}>
              {logs.map((log, idx) => {
                const positive = log.pointsDelta > 0;
                return (
                  <View
                    key={log.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 10,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: color.border,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                        {log.note}
                      </Text>
                      <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 1 }}>
                        {new Date(log.createdAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: positive ? "#DDEFE3" : "#FBEBD0",
                        borderRadius: radius.pill,
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: positive ? "#2F6B4A" : "#8A5A12",
                        }}
                      >
                        {positive ? `+${log.pointsDelta}` : log.pointsDelta} poin
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <Button label="Tutup" variant="secondary" fullWidth onPress={onClose} style={{ marginTop: spacing.md }} />
      </View>
    </BottomSheet>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.surfaceAlt,
        borderRadius: radius.md,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        borderWidth: 1,
        borderColor: color.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: color.primaryDeep, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: color.textSecondary, fontSize: 10, marginTop: 1 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
