import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { MemberFormModal } from "@/components/member/MemberFormModal";
import { color, font, radius, spacing } from "@/constants/theme";
import { useMemberStore } from "@/store/memberStore";
import { FREE_TREATMENT_POINTS } from "@/utils/membership";
import type { Member } from "@/types";

interface MemberPickerModalProps {
  visible: boolean;
  selectedMemberId: string | null;
  onClose: () => void;
  onSelect: (member: Member | null) => void;
}

/** Modal pemilih member di keranjang kasir, dilengkapi pencarian dan tombol daftar member baru. */
export function MemberPickerModal({ visible, selectedMemberId, onClose, onSelect }: MemberPickerModalProps) {
  const members = useMemberStore((s) => s.members);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const activeMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => m.active)
      .filter((m) => {
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          m.memberCode.toLowerCase().includes(q) ||
          (m.phone ?? "").toLowerCase().includes(q)
        );
      });
  }, [members, query]);

  return (
    <>
      <BottomSheet visible={visible && !createOpen} onClose={onClose}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs }}>
            <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600" }}>
              Pilih Member
            </Text>
            <Button
              label="+ Member Baru"
              size="sm"
              variant="secondary"
              onPress={() => setCreateOpen(true)}
            />
          </View>
          <Text style={{ color: color.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
            1x treatment = +10 poin • 100 poin (10x treatment) = Gratis 1x treatment
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: color.surfaceAlt,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.border,
              paddingHorizontal: spacing.sm,
              marginBottom: spacing.sm,
            }}
          >
            <Icon name="search" color={color.textMuted} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cari nama, kode MBR, atau no. HP..."
              placeholderTextColor={color.textMuted}
              style={{ flex: 1, color: color.textPrimary, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs, fontSize: 14 }}
            />
          </View>

          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {activeMembers.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
                <Text style={{ color: color.textMuted, fontSize: 13 }}>
                  {query.trim() ? "Member tidak ditemukan." : "Belum ada member terdaftar."}
                </Text>
              </View>
            ) : (
              <View style={{ gap: spacing.xs }}>
                {activeMembers.map((m) => {
                  const selected = m.id === selectedMemberId;
                  const readyFree = m.points >= FREE_TREATMENT_POINTS;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => {
                        onSelect(m);
                        onClose();
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: spacing.sm,
                        borderRadius: radius.lg,
                        backgroundColor: selected ? color.primarySoft : color.surface,
                        borderWidth: 1.5,
                        borderColor: selected ? color.primaryDeep : color.border,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: spacing.sm }}>
                        <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Text style={{ color: color.textSecondary, fontSize: 11, marginTop: 2 }}>
                          {m.memberCode}
                          {m.phone ? ` • ${m.phone}` : ""} • {m.totalTreatments}x treatment
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <View
                          style={{
                            backgroundColor: readyFree ? color.accent : color.primarySoft,
                            borderRadius: radius.pill,
                            paddingHorizontal: 10,
                            paddingVertical: 3,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "800",
                              color: readyFree ? color.accentOn : color.primaryDeep,
                            }}
                          >
                            {readyFree ? `🎁 ${m.points} Poin (Gratis!)` : `${m.points} Poin`}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            {selectedMemberId && (
              <Button
                label="Lepas Member"
                variant="danger"
                onPress={() => {
                  onSelect(null);
                  onClose();
                }}
                style={{ flex: 1 }}
              />
            )}
            <Button label="Tutup" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </View>
      </BottomSheet>

      <MemberFormModal
        visible={createOpen}
        member={null}
        onClose={() => setCreateOpen(false)}
        onSaved={(newMember) => {
          setCreateOpen(false);
          onSelect(newMember);
          onClose();
        }}
      />
    </>
  );
}
