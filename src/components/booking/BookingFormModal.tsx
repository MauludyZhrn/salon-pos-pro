import { useEffect, useState } from "react";
import { View, Text, TextInput, Alert, ScrollView } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Chip } from "@/components/common/Chip";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, font, radius, spacing } from "@/constants/theme";
import { Button } from "@/components/common/Button";
import { useBookingStore } from "@/store/bookingStore";

interface BookingFormModalProps {
  visible: boolean;
  stylists: { id: string; name: string }[];
  initialStylistId: string;
  initialHour: number;
  date: Date;
  services: { id: string; name: string; durationMinutes: number }[];
  onClose: () => void;
}

/** New-booking form opened from a calendar slot tap. Validates conflict via bookingStore.hasConflict before insert. */
export function BookingFormModal({ visible, stylists, initialStylistId, initialHour, date, services, onClose }: BookingFormModalProps) {
  const { sheetMaxBodyHeight, isCompactHeight } = useResponsiveLayout();
  const [stylistId, setStylistId] = useState(initialStylistId);
  const [hour, setHour] = useState(initialHour);
  useEffect(() => {
    if (visible) {
      setStylistId(initialStylistId);
      setHour(initialHour);
    }
  }, [visible, initialStylistId, initialHour]);
  const HOURS = Array.from({ length: 11 }, (_, i) => 9 + i);
  const createBooking = useBookingStore((s) => s.createBooking);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const durationMinutes = services
    .filter((s) => selectedServiceIds.includes(s.id))
    .reduce((sum, s) => sum + s.durationMinutes, 0) || 30;

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!customerName.trim()) {
      Alert.alert("Nama wajib diisi");
      return;
    }
    if (selectedServiceIds.length === 0) {
      Alert.alert("Pilih minimal 1 layanan");
      return;
    }

    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    setSaving(true);
    try {
      await createBooking({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        stylistId,
        serviceIds: selectedServiceIds,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        notes: notes.trim() || null,
      });
      reset();
      onClose();
    } catch (err) {
      Alert.alert("Gagal buat booking", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setCustomerName("");
    setCustomerPhone("");
    setSelectedServiceIds([]);
    setNotes("");
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: isCompactHeight ? 20 : 22, fontWeight: "600" }}>
          Booking Baru
        </Text>
        <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm }}>
          {date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
        </Text>

        <ScrollView
          style={{ maxHeight: sheetMaxBodyHeight }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: color.textSecondary, fontSize: 13, marginBottom: spacing.xs }}>Stylist</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {stylists.map((st) => (
              <Chip key={st.id} active={stylistId === st.id} label={st.name} onPress={() => setStylistId(st.id)} />
            ))}
          </View>

          <Text style={{ color: color.textSecondary, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.xs }}>Jam mulai</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}>
            {HOURS.map((h) => (
              <Chip key={h} active={hour === h} label={`${String(h).padStart(2, "0")}:00`} onPress={() => setHour(h)} />
            ))}
          </ScrollView>

          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Nama pelanggan"
            placeholderTextColor={color.textMuted}
            style={[inputStyle, { marginTop: spacing.md }]}
          />
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="No. HP (opsional)"
            placeholderTextColor={color.textMuted}
            keyboardType="phone-pad"
            style={[inputStyle, { marginTop: spacing.xs }]}
          />

          <Text style={{ color: color.textSecondary, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.xs }}>
            Layanan
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {services.map((svc) => (
              <Chip
                key={svc.id}
                active={selectedServiceIds.includes(svc.id)}
                label={svc.name}
                onPress={() => toggleService(svc.id)}
              />
            ))}
          </View>

          <Text style={{ color: color.textMuted, fontSize: 11, marginTop: spacing.xs }}>
            Estimasi durasi: {durationMinutes} menit (selesai {String((hour + Math.ceil(durationMinutes / 60)) % 24).padStart(2, "0")}:
            {String(durationMinutes % 60).padStart(2, "0")})
          </Text>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Catatan (opsional)"
            placeholderTextColor={color.textMuted}
            style={[inputStyle, { marginTop: spacing.md }]}
          />
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: isCompactHeight ? spacing.sm : spacing.md }}>
          <Button label="Batal" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Button label="Simpan Booking" loading={saving} style={{ flex: 2 }} onPress={handleSave} />
        </View>
      </View>
    </BottomSheet>
  );
}

const inputStyle = {
  minHeight: 46,
  backgroundColor: color.surfaceAlt,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.border,
  color: color.textPrimary,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  fontSize: 14,
} as const;
