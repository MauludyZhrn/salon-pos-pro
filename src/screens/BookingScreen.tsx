import { useEffect, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarView } from "@/components/booking/CalendarView";
import { BookingFormModal } from "@/components/booking/BookingFormModal";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useCloud } from "@/services/cloudSync";
import { Button } from "@/components/common/Button";
import { color, elevation, radius, spacing } from "@/constants/theme";
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
  const { useWideCalendar, isCompactHeight, pagePadding } = useResponsiveLayout();
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
          flexDirection: useWideCalendar ? "row" : "column",
          alignItems: useWideCalendar ? "center" : "stretch",
          justifyContent: "space-between",
          gap: spacing.xs,
          paddingHorizontal: pagePadding,
          paddingVertical: isCompactHeight ? spacing.xs : spacing.sm,
        }}
      >
        <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
          Booking · {date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Button
            size="sm"
            variant="secondary"
            label="‹"
            style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 0 }}
            accessibilityLabel="Hari sebelumnya"
            onPress={() => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))}
          />
          <Button
            size="sm"
            variant="secondary"
            label="Hari ini"
            style={{ minHeight: 44 }}
            onPress={() => setDate(new Date())}
          />
          <Button
            size="sm"
            variant="secondary"
            label="›"
            style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 0 }}
            accessibilityLabel="Hari berikutnya"
            onPress={() => setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))}
          />
        </View>
      </View>

      {stylists.length === 0 && (
        <Text style={{ color: color.textMuted, fontSize: 13, paddingHorizontal: pagePadding, marginBottom: spacing.xs }}>
          Belum ada stylist aktif. Tambahkan di Profil › Karyawan & Komisi.
        </Text>
      )}

      <View style={{ flex: 1, paddingHorizontal: pagePadding }}>
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
            marginHorizontal: pagePadding,
            marginBottom: spacing.sm,
            marginTop: spacing.xs,
            padding: spacing.md,
            backgroundColor: color.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: color.borderStrong,
            ...elevation.card,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
                {selected.customerName}
              </Text>
              <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 2 }}>
                Status: {STATUS_LABEL[selected.status]} ·{" "}
                {new Date(selected.startAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            <Button size="sm" variant="ghost" label="Tutup" onPress={() => setSelected(null)} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm }}>
            {NEXT_STATUS[selected.status] && (
              <Button
                size="sm"
                label={`Tandai ${STATUS_LABEL[NEXT_STATUS[selected.status]!].toLowerCase()}`}
                style={{ flexGrow: 1 }}
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
          </View>
        </View>
      )}

      {!selected && (
        <Pressable
          onPress={() => {
            if (stylists.length === 0) {
              Alert.alert("Belum ada stylist", "Tambahkan karyawan di Profil › Karyawan & Komisi dulu.");
              return;
            }
            setFormSlot({ stylistId: stylists[0].id, hour: Math.min(19, Math.max(9, new Date().getHours() + 1)) });
          }}
          accessibilityLabel="Booking baru"
          style={({ pressed }) => ({
            position: "absolute",
            right: pagePadding,
            bottom: spacing.md,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: pressed ? "#DB6C93" : color.primary,
            alignItems: "center",
            justifyContent: "center",
            ...elevation.modal,
          })}
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
