import { useEffect, useState } from "react";
import { View, Text, Pressable, Alert, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarView } from "@/components/booking/CalendarView";
import { BookingFormModal } from "@/components/booking/BookingFormModal";
import { useCloud } from "@/services/cloudSync";
import { Button } from "@/components/common/Button";
import { color, elevation, spacing } from "@/constants/theme";
import { useBookingStore } from "@/store/bookingStore";
import { useCatalog } from "@/hooks/useCatalog";
import { useStylists } from "@/hooks/useStylists";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Icon } from "@/components/common/Icon";
import { STATUS_LABEL } from "@/utils/bookingLabels";
import type { Booking, BookingStatus } from "@/types";

const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  booked: "confirmed",
  confirmed: "checked_in",
  checked_in: "in_progress",
  in_progress: "completed",
};

export function BookingScreen() {
  const [date, setDate] = useState(new Date());
  const { width } = useWindowDimensions();
  const stylists = useStylists();
  const bookings = useBookingStore((s) => s.bookings);
  const loadRange = useBookingStore((s) => s.loadRange);
  const updateStatus = useBookingStore((s) => s.updateStatus);
  const { items: catalogItems } = useCatalog();
  const syncVersion = useCloud((c) => c.version);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [formSlot, setFormSlot] = useState<{ stylistId: string; hour: number } | null>(null);

  useEffect(() => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    loadRange(start.toISOString(), end.toISOString());
  }, [date, loadRange, syncVersion]);

  const services = catalogItems
    .filter((i) => i.type === "service")
    .map((i) => ({ id: i.id, name: i.name, durationMinutes: i.durationMinutes ?? 30 }));

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader title="Booking" showBack={false} />
      <View
        style={{
          flexDirection: width < 600 ? "column" : "row",
          alignItems: width < 600 ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: spacing.sm,
          padding: spacing.md,
        }}
      >
        <Text style={{ color: color.textPrimary, fontSize: 16, fontWeight: "600", flexShrink: 1 }}>
          Booking · {date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          <Button
            size="sm"
            variant="secondary"
            label="‹"
            onPress={() => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))}
          />
          <Button size="sm" variant="secondary" label="Hari ini" onPress={() => setDate(new Date())} />
          <Button
            size="sm"
            variant="secondary"
            label="›"
            onPress={() => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))}
          />
        </View>
      </View>

      {stylists.length === 0 && (
        <Text style={{ color: color.textMuted, fontSize: 13, paddingHorizontal: spacing.md }}>
          Belum ada stylist aktif. Tambahkan di Profil › Karyawan & Komisi.
        </Text>
      )}

      <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
        <CalendarView
          date={date}
          bookings={bookings}
          stylists={stylists}
          onSlotPress={(stylistId, hour) => setFormSlot({ stylistId, hour })}
          onBookingPress={setSelected}
        />
      </View>

      {selected && (
        <View
          style={{
            margin: spacing.md,
            padding: spacing.md,
            backgroundColor: color.surfaceAlt,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: color.border,
          }}
        >
          <Text style={{ color: color.textPrimary, fontWeight: "700" }}>{selected.customerName}</Text>
          <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 2 }}>Status: {STATUS_LABEL[selected.status]}</Text>
          <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm }}>
            {NEXT_STATUS[selected.status] && (
              <Button
                size="sm"
                label={`Tandai ${STATUS_LABEL[NEXT_STATUS[selected.status]!].toLowerCase()}`}
                onPress={() => {
                  updateStatus(selected.id, NEXT_STATUS[selected.status]!);
                  setSelected(null);
                }}
              />
            )}
            <Button
              size="sm"
              variant="danger"
              label="Tidak hadir"
              onPress={() => {
                updateStatus(selected.id, "no_show");
                setSelected(null);
              }}
            />
            <Button size="sm" variant="ghost" label="Tutup" onPress={() => setSelected(null)} />
          </View>
        </View>
      )}

      {(
        <Pressable
          onPress={() => {
            if (stylists.length === 0) {
              Alert.alert("Belum ada stylist", "Tambahkan karyawan di Profil › Karyawan & Komisi dulu.");
              return;
            }
            setFormSlot({ stylistId: stylists[0].id, hour: Math.min(19, Math.max(9, new Date().getHours() + 1)) });
          }}
          accessibilityLabel="Booking baru"
          style={{
            position: "absolute",
            right: spacing.md,
            bottom: spacing.md,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: color.primary,
            alignItems: "center",
            justifyContent: "center",
            ...elevation.modal,
          }}
        >
          <Icon name="plus" color={color.textOnPrimary} size={26} />
        </Pressable>
      )}

      {formSlot && (
        <BookingFormModal
          visible
          stylists={stylists}
          initialStylistId={formSlot.stylistId}
          initialHour={formSlot.hour}
          date={date}
          services={services}
          onClose={() => setFormSlot(null)}
        />
      )}
    </SafeAreaView>
  );
}
