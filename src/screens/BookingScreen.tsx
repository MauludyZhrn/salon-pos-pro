import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarView } from "@/components/booking/CalendarView";
import { BookingFormModal } from "@/components/booking/BookingFormModal";
import { Button } from "@/components/common/Button";
import { color, spacing } from "@/constants/theme";
import { useBookingStore } from "@/store/bookingStore";
import { useCatalog } from "@/hooks/useCatalog";
import type { Booking, BookingStatus } from "@/types";

const STYLISTS = [
  { id: "stylist-1", name: "Rani" },
  { id: "stylist-2", name: "Dimas" },
  { id: "stylist-3", name: "Putri" },
];

const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  booked: "confirmed",
  confirmed: "checked_in",
  checked_in: "in_progress",
  in_progress: "completed",
};

export function BookingScreen() {
  const [date, setDate] = useState(new Date());
  const bookings = useBookingStore((s) => s.bookings);
  const loadRange = useBookingStore((s) => s.loadRange);
  const updateStatus = useBookingStore((s) => s.updateStatus);
  const { items: catalogItems } = useCatalog();
  const [selected, setSelected] = useState<Booking | null>(null);
  const [formSlot, setFormSlot] = useState<{ stylistId: string; hour: number } | null>(null);

  useEffect(() => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    loadRange(start.toISOString(), end.toISOString());
  }, [date, loadRange]);

  const services = catalogItems
    .filter((i) => i.type === "service")
    .map((i) => ({ id: i.id, name: i.name, durationMinutes: i.durationMinutes ?? 30 }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md }}>
        <Text style={{ color: color.textPrimary, fontSize: 18, fontWeight: "700" }}>
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

      <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
        <CalendarView
          date={date}
          bookings={bookings}
          stylists={STYLISTS}
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
          <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 2 }}>Status: {selected.status}</Text>
          <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm }}>
            {NEXT_STATUS[selected.status] && (
              <Button
                size="sm"
                label={`Tandai ${NEXT_STATUS[selected.status]}`}
                onPress={() => {
                  updateStatus(selected.id, NEXT_STATUS[selected.status]!);
                  setSelected(null);
                }}
              />
            )}
            <Button
              size="sm"
              variant="danger"
              label="No-show"
              onPress={() => {
                updateStatus(selected.id, "no_show");
                setSelected(null);
              }}
            />
            <Button size="sm" variant="ghost" label="Tutup" onPress={() => setSelected(null)} />
          </View>
        </View>
      )}

      {formSlot && (
        <BookingFormModal
          visible
          stylistId={formSlot.stylistId}
          stylistName={STYLISTS.find((s) => s.id === formSlot.stylistId)?.name ?? formSlot.stylistId}
          hour={formSlot.hour}
          date={date}
          services={services}
          onClose={() => setFormSlot(null)}
        />
      )}
    </SafeAreaView>
  );
}
