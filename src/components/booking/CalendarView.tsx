import { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { color, radius, spacing } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import type { Booking, BookingStatus } from "@/types";

interface CalendarViewProps {
  date: Date;
  bookings: Booking[];
  stylists: { id: string; name: string }[];
  onSlotPress: (stylistId: string, hour: number) => void;
  onBookingPress: (booking: Booking) => void;
}

const DAY_START_HOUR = 9;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 56;

const STATUS_COLOR: Record<BookingStatus, string> = {
  booked: color.info,
  confirmed: color.primary,
  checked_in: color.warn,
  in_progress: color.accent,
  completed: color.textMuted,
  no_show: color.danger,
  cancelled: color.textMuted,
};

/**
 * Adaptive booking calendar:
 * - Wide (tablet / landscape, useWideCalendar): stylist-column week/day grid —
 *   each stylist gets a vertical lane, slots render side by side.
 * - Narrow (phone portrait): single scrollable agenda list grouped by hour,
 *   stylist shown as a tag per booking instead of a column.
 */
export function CalendarView({ date, bookings, stylists, onSlotPress, onBookingPress }: CalendarViewProps) {
  const { useWideCalendar } = useResponsiveLayout();
  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i),
    []
  );

  const bookingsByStylist = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const s of stylists) map.set(s.id, []);
    for (const b of bookings) {
      if (!map.has(b.stylistId)) map.set(b.stylistId, []);
      map.get(b.stylistId)!.push(b);
    }
    return map;
  }, [bookings, stylists]);

  if (useWideCalendar) {
    return (
      <ScrollView>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 56 }}>
            <View style={{ height: 36 }} />
            {hours.map((h) => (
              <View key={h} style={{ height: HOUR_HEIGHT, justifyContent: "flex-start" }}>
                <Text style={{ color: color.textMuted, fontSize: 11 }}>{String(h).padStart(2, "0")}:00</Text>
              </View>
            ))}
          </View>

          {stylists.map((stylist) => (
            <View key={stylist.id} style={{ flex: 1, minWidth: 140, borderLeftWidth: 1, borderLeftColor: color.border }}>
              <View style={{ height: 36, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: color.textPrimary, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                  {stylist.name}
                </Text>
              </View>
              <View style={{ position: "relative" }}>
                {hours.map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => onSlotPress(stylist.id, h)}
                    style={{
                      height: HOUR_HEIGHT,
                      borderTopWidth: 1,
                      borderTopColor: color.border,
                    }}
                  />
                ))}
                {(bookingsByStylist.get(stylist.id) ?? []).map((b) => {
                  const start = new Date(b.startAt);
                  const end = new Date(b.endAt);
                  const startOffset = (start.getHours() - DAY_START_HOUR) * HOUR_HEIGHT + (start.getMinutes() / 60) * HOUR_HEIGHT;
                  const durationH = (end.getTime() - start.getTime()) / 36e5;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => onBookingPress(b)}
                      style={{
                        position: "absolute",
                        top: startOffset + 2,
                        left: 4,
                        right: 4,
                        height: Math.max(28, durationH * HOUR_HEIGHT - 4),
                        backgroundColor: STATUS_COLOR[b.status],
                        borderRadius: radius.sm,
                        padding: 4,
                      }}
                    >
                      <Text numberOfLines={2} style={{ color: "#0B0B0D", fontSize: 11, fontWeight: "600" }}>
                        {b.customerName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // Narrow: agenda list grouped by hour.
  const sorted = [...bookings].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return (
    <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
      {sorted.length === 0 && (
        <Text style={{ color: color.textMuted, textAlign: "center", marginTop: spacing.xl }}>
          Tidak ada booking pada {date.toLocaleDateString("id-ID")}
        </Text>
      )}
      {sorted.map((b) => {
        const stylist = stylists.find((s) => s.id === b.stylistId);
        const start = new Date(b.startAt);
        return (
          <Pressable
            key={b.id}
            onPress={() => onBookingPress(b)}
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              backgroundColor: color.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: color.border,
              padding: spacing.sm,
            }}
          >
            <View style={{ width: 4, borderRadius: 2, backgroundColor: STATUS_COLOR[b.status] }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "600" }}>
                {start.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {b.customerName}
              </Text>
              <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2 }}>
                {stylist?.name ?? b.stylistId} · {b.status}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
