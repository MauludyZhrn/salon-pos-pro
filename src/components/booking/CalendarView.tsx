import { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { color, radius, spacing } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { STATUS_LABEL } from "@/utils/bookingLabels";
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
const HOUR_HEIGHT = 64;
const TIME_AXIS_WIDTH = 56;
const MIN_STYLIST_COL_WIDTH = 160;

const STATUS_COLOR: Record<BookingStatus, string> = {
  booked: color.info,
  confirmed: color.primaryDeep,
  checked_in: color.warn,
  in_progress: color.accent,
  completed: color.textMuted,
  no_show: color.danger,
  cancelled: color.textMuted,
};

const STATUS_BG: Record<BookingStatus, string> = {
  booked: "#E5E9F5",
  confirmed: color.primarySoft,
  checked_in: "#FBEBD0",
  in_progress: "#DDEFE3",
  completed: "#EFEAE8",
  no_show: "#F6D9DD",
  cancelled: "#EFEAE8",
};

/**
 * Adaptive booking calendar:
 * - Wide (tablet / landscape, useWideCalendar): stylist-column day grid —
 *   each stylist gets a vertical lane with horizontal scrolling when stylists
 *   exceed the available width so columns are never clipped.
 * - Narrow (phone portrait / compact): single scrollable agenda list sorted by
 *   time, with stylist and status tags on each booking card.
 */
export function CalendarView({ date, bookings, stylists, onSlotPress, onBookingPress }: CalendarViewProps) {
  const { useWideCalendar, width, pagePadding } = useResponsiveLayout();
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

  if (useWideCalendar && stylists.length > 0) {
    const availableColumnsWidth = Math.max(240, width - pagePadding * 2 - TIME_AXIS_WIDTH);
    const colWidth = Math.max(
      MIN_STYLIST_COL_WIDTH,
      Math.floor(availableColumnsWidth / Math.max(1, stylists.length))
    );

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 88 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: color.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: color.border,
            overflow: "hidden",
          }}
        >
          <View style={{ width: TIME_AXIS_WIDTH, backgroundColor: color.surfaceAlt }}>
            <View
              style={{
                height: 42,
                borderBottomWidth: 1,
                borderBottomColor: color.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: color.textMuted, fontSize: 11, fontWeight: "600" }}>Jam</Text>
            </View>
            {hours.map((h) => (
              <View
                key={h}
                style={{
                  height: HOUR_HEIGHT,
                  justifyContent: "flex-start",
                  alignItems: "center",
                  paddingTop: 6,
                  borderTopWidth: h === DAY_START_HOUR ? 0 : 1,
                  borderTopColor: color.border,
                }}
              >
                <Text style={{ color: color.textSecondary, fontSize: 11, fontWeight: "600" }}>
                  {String(h).padStart(2, "0")}:00
                </Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <View style={{ flexDirection: "row" }}>
              {stylists.map((stylist) => (
                <View
                  key={stylist.id}
                  style={{
                    width: colWidth,
                    borderLeftWidth: 1,
                    borderLeftColor: color.border,
                  }}
                >
                  <View
                    style={{
                      height: 42,
                      paddingHorizontal: spacing.xs,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: color.surfaceAlt,
                      borderBottomWidth: 1,
                      borderBottomColor: color.border,
                    }}
                  >
                    <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                      {stylist.name}
                    </Text>
                  </View>
                  <View style={{ position: "relative" }}>
                    {hours.map((h) => (
                      <Pressable
                        key={h}
                        onPress={() => onSlotPress(stylist.id, h)}
                        style={({ pressed }) => ({
                          height: HOUR_HEIGHT,
                          backgroundColor: pressed ? color.surfaceAlt : color.surface,
                          borderTopWidth: h === DAY_START_HOUR ? 0 : 1,
                          borderTopColor: color.border,
                        })}
                      />
                    ))}
                    {(bookingsByStylist.get(stylist.id) ?? []).map((b) => {
                      const start = new Date(b.startAt);
                      const end = new Date(b.endAt);
                      const startOffset =
                        (start.getHours() - DAY_START_HOUR) * HOUR_HEIGHT +
                        (start.getMinutes() / 60) * HOUR_HEIGHT;
                      const durationH = (end.getTime() - start.getTime()) / 36e5;
                      const blockHeight = Math.max(36, durationH * HOUR_HEIGHT - 4);
                      return (
                        <Pressable
                          key={b.id}
                          onPress={() => onBookingPress(b)}
                          style={{
                            position: "absolute",
                            top: Math.max(2, startOffset + 2),
                            left: 4,
                            right: 4,
                            height: blockHeight,
                            backgroundColor: STATUS_BG[b.status],
                            borderLeftWidth: 4,
                            borderLeftColor: STATUS_COLOR[b.status],
                            borderRadius: radius.sm,
                            paddingHorizontal: 6,
                            paddingVertical: 4,
                            justifyContent: "center",
                          }}
                        >
                          <Text numberOfLines={1} style={{ color: color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                            {b.customerName}
                          </Text>
                          {blockHeight >= 46 && (
                            <Text numberOfLines={1} style={{ color: STATUS_COLOR[b.status], fontSize: 10, fontWeight: "700", marginTop: 1 }}>
                              {start.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {STATUS_LABEL[b.status]}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    );
  }

  // Narrow: agenda list sorted by time.
  const sorted = [...bookings].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return (
    <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: 88 }} showsVerticalScrollIndicator={false}>
      {sorted.length === 0 && (
        <View
          style={{
            backgroundColor: color.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: color.border,
            padding: spacing.lg,
            alignItems: "center",
            marginTop: spacing.md,
          }}
        >
          <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
            Belum ada jadwal booking
          </Text>
          <Text style={{ color: color.textMuted, fontSize: 12, textAlign: "center", marginTop: 4 }}>
            Tidak ada booking pada {date.toLocaleDateString("id-ID")}. Ketuk tombol + di kanan bawah untuk membuat jadwal baru.
          </Text>
        </View>
      )}
      {sorted.map((b) => {
        const stylist = stylists.find((s) => s.id === b.stylistId);
        const start = new Date(b.startAt);
        const end = new Date(b.endAt);
        return (
          <Pressable
            key={b.id}
            onPress={() => onBookingPress(b)}
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: spacing.sm,
              backgroundColor: pressed ? color.surfaceAlt : color.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: color.border,
              padding: spacing.sm,
              alignItems: "center",
            })}
          >
            <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: STATUS_COLOR[b.status] }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
                <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                  {b.customerName}
                </Text>
                <View
                  style={{
                    backgroundColor: STATUS_BG[b.status],
                    borderRadius: radius.pill,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: STATUS_COLOR[b.status], fontSize: 10, fontWeight: "700" }}>
                    {STATUS_LABEL[b.status]}
                  </Text>
                </View>
              </View>
              <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 3 }}>
                {start.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} –{" "}
                {end.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · Stylist:{" "}
                <Text style={{ fontWeight: "600", color: color.textPrimary }}>{stylist?.name ?? b.stylistId}</Text>
              </Text>
              {b.notes ? (
                <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  Catatan: {b.notes}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
