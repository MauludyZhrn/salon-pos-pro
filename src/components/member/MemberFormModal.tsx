import { useEffect, useState } from "react";
import { View, Text, TextInput, Alert, ScrollView, Switch } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { Chip } from "@/components/common/Chip";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, font, radius, spacing } from "@/constants/theme";
import { useMemberStore } from "@/store/memberStore";
import { POINTS_PER_TREATMENT } from "@/utils/membership";
import type { Member } from "@/types";

interface MemberFormModalProps {
  visible: boolean;
  /** null = tambah member baru */
  member: Member | null;
  onClose: () => void;
  onSaved?: (member: Member) => void;
}

const digits = (v: string) => v.replace(/\D/g, "");

const QUICK_POINTS = [
  { label: "0 Poin (Baru)", pts: 0 },
  { label: "10 Poin (1x)", pts: 10 },
  { label: "30 Poin (3x)", pts: 30 },
  { label: "50 Poin (5x)", pts: 50 },
  { label: "100 Poin (Gratis 1x)", pts: 100 },
];

/** Form tambah / ubah / hapus member beserta poinnya. */
export function MemberFormModal({ visible, member, onClose, onSaved }: MemberFormModalProps) {
  const { sheetMaxBodyHeight } = useResponsiveLayout();
  const save = useMemberStore((s) => s.save);
  const remove = useMemberStore((s) => s.remove);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pointsText, setPointsText] = useState("0");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (member) {
      setName(member.name);
      setPhone(member.phone ?? "");
      setPointsText(String(member.points));
      setNotes(member.notes ?? "");
      setActive(member.active);
    } else {
      setName("");
      setPhone("");
      setPointsText("0");
      setNotes("");
      setActive(true);
    }
  }, [visible, member]);

  const pointsNum = Number(digits(pointsText)) || 0;
  const equivalentTreatments = Math.floor(pointsNum / POINTS_PER_TREATMENT);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return Alert.alert("Nama wajib diisi", "Masukkan nama pelanggan member.");
    }

    setSaving(true);
    try {
      const saved = await save(
        {
          name: trimmedName,
          phone: phone.trim() ? phone.trim() : null,
          points: pointsNum,
          notes: notes.trim() ? notes.trim() : null,
          active,
        },
        member?.id
      );
      onSaved?.(saved);
      onClose();
    } catch (e) {
      Alert.alert("Gagal menyimpan", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!member) return;
    Alert.alert("Hapus member?", `Member "${member.name}" (${member.memberCode}) beserta riwayat poinnya akan dihapus.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          await remove(member.id);
          onClose();
        },
      },
    ]);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600", marginBottom: spacing.xs }}>
          {member ? "Edit Member" : "Tambah Member Baru"}
        </Text>
        {member && (
          <Text style={{ color: color.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
            Kode Member: {member.memberCode}
          </Text>
        )}

        <ScrollView style={{ maxHeight: sheetMaxBodyHeight }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Label>Nama Pelanggan</Label>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="mis. Siti Rahmawati"
            placeholderTextColor={color.textMuted}
            maxLength={60}
            style={inputStyle}
          />

          <Label>Nomor HP / WhatsApp (opsional)</Label>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="mis. 081234567890"
            placeholderTextColor={color.textMuted}
            keyboardType="phone-pad"
            maxLength={20}
            style={inputStyle}
          />

          <Label>{member ? "Saldo Poin Saat Ini" : "Saldo Poin Awal"}</Label>
          <TextInput
            value={pointsText}
            onChangeText={(v) => setPointsText(digits(v).slice(0, 6))}
            placeholder="0"
            placeholderTextColor={color.textMuted}
            keyboardType="number-pad"
            style={inputStyle}
          />
          <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 4 }}>
            Setara {equivalentTreatments}x treatment (1x treatment = 10 poin, 100 poin = 1x gratis treatment).
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>
            {QUICK_POINTS.map((q) => (
              <Chip
                key={q.pts}
                label={q.label}
                active={pointsNum === q.pts}
                onPress={() => setPointsText(String(q.pts))}
              />
            ))}
          </View>

          <Label>Catatan Member (opsional)</Label>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="mis. Suka hair spa aroma lavender, rambut sensitif"
            placeholderTextColor={color.textMuted}
            maxLength={150}
            style={inputStyle}
          />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
            <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "600" }}>Status Member Aktif</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: color.primary, false: color.border }} thumbColor="#FFFFFF" />
          </View>
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <Button label="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Simpan" loading={saving} onPress={handleSave} style={{ flex: 2 }} />
        </View>
        {member && <Button label="Hapus Member" variant="danger" onPress={confirmDelete} style={{ marginTop: spacing.xs }} />}
      </View>
    </BottomSheet>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text style={{ color: color.textSecondary, fontSize: 13, fontWeight: "600", marginTop: spacing.sm, marginBottom: spacing.xxs }}>
      {children}
    </Text>
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
  fontSize: 15,
} as const;
