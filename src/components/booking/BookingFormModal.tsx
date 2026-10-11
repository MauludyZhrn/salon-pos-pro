import { useState } from "react";
import { Modal, View, Text, TextInput, Pressable, Alert } from "react-native";
import { color, radius, spacing } from "@/constants/theme";
import { Button } from "@/components/common/Button";
import { useBookingStore } from "@/store/bookingStore";

interface BookingFormModalProps {
  visible: boolean;
  stylistId: string;
  stylistName: string;
  hour: number;
  date: Date;
  services: { id: string; name: string; durationMinutes: number }[];
  onClose: () => void;
}

/** New-booking form opened from a calendar slot tap. Validates conflict via bookingStore.hasConflict before insert. */
export function BookingFormModal({ visible, stylistId, stylistName, hour, date, services, onClose }: BookingFormModalProps) {
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: color.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "90%" }}>
          <Text style={{ color: color.textPrimary, fontSize: 18, fontWeight: "700" }}>Booking Baru</Text>
          <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.md }}>
            {stylistName} · {String(hour).padStart(2, "0")}:00 · {date.toLocaleDateString("id-ID")}
          </Text>

          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Nama pelanggan"
            placeholderTextColor={color.textMuted}
            style={inputStyle}
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
            {services.map((svc) => {
              const active = selectedServiceIds.includes(svc.id);
              return (
                <Pressable
                  key={svc.id}
                  onPress={() => toggleService(svc.id)}
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.pill,
                    backgroundColor: active ? color.primary : color.surfaceAlt,
                    borderWidth: 1,
                    borderColor: active ? color.primary : color.border,
                  }}
                >
                  <Text style={{ color: active ? color.textOnPrimary : color.textSecondary, fontSize: 12, fontWeight: "600" }}>
                    {svc.name}
                  </Text>
                </Pressable>
              );
            })}
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

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <Button label="Batal" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
            <Button label="Simpan Booking" loading={saving} style={{ flex: 2 }} onPress={handleSave} />
          </View>
        </View>
      </View>
    </Modal>
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
  fontSize: 14,
} as const;
