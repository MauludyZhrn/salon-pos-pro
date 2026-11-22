import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { Chip } from "@/components/common/Chip";
import { Icon } from "@/components/common/Icon";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, font, radius, spacing } from "@/constants/theme";
import { addDaysToDateString, localDateString } from "@/utils/promotions";
import {
  buildMonthGridCells,
  CALENDAR_WEEKDAYS,
  countInclusiveDays,
  formatMonthYearId,
  formatShortDateId,
  monthRange,
  parseLocalDate,
} from "@/utils/dateFormat";

export interface AppliedDateRange {
  /** null berarti rentang bebas / tanpa batas. */
  fromDate: string | null;
  toDate: string | null;
}

interface DateRangePickerModalProps {
  visible: boolean;
  fromDate: string | null;
  toDate: string | null;
  onClose: () => void;
  onApply: (range: AppliedDateRange) => void;
}

type ActiveEdge = "from" | "to";

/** Modal pemilih batas rentang tanggal (Dari – Sampai) untuk Riwayat Transaksi. */
export function DateRangePickerModal({ visible, fromDate, toDate, onClose, onApply }: DateRangePickerModalProps) {
  const { sheetMaxBodyHeight, isSmallPhone } = useResponsiveLayout();
  const [draftFrom, setDraftFrom] = useState<string | null>(fromDate);
  const [draftTo, setDraftTo] = useState<string | null>(toDate);
  const [activeEdge, setActiveEdge] = useState<ActiveEdge>("from");
  const [cursorYear, setCursorYear] = useState(() => new Date().getFullYear());
  const [cursorMonth, setCursorMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    if (!visible) return;
    setDraftFrom(fromDate);
    setDraftTo(toDate);
    setActiveEdge(fromDate && !toDate ? "to" : "from");
    const anchor = (toDate && parseLocalDate(toDate)) || (fromDate && parseLocalDate(fromDate)) || new Date();
    setCursorYear(anchor.getFullYear());
    setCursorMonth(anchor.getMonth());
  }, [visible, fromDate, toDate]);

  const todayStr = localDateString();
  const cells = useMemo(() => buildMonthGridCells(cursorYear, cursorMonth), [cursorYear, cursorMonth]);
  const rows = useMemo(() => {
    const out: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [cells]);

  function focusMonthOf(yyyyMmDd: string) {
    const dt = parseLocalDate(yyyyMmDd);
    if (!dt) return;
    setCursorYear(dt.getFullYear());
    setCursorMonth(dt.getMonth());
  }

  function stepMonth(delta: number) {
    const dt = new Date(cursorYear, cursorMonth + delta, 1);
    setCursorYear(dt.getFullYear());
    setCursorMonth(dt.getMonth());
  }

  function applyQuickPreset(from: string | null, to: string | null) {
    setDraftFrom(from);
    setDraftTo(to);
    setActiveEdge("from");
    if (to) focusMonthOf(to);
    else if (from) focusMonthOf(from);
  }

  function handleDayPress(dayStr: string) {
    if (activeEdge === "from") {
      setDraftFrom(dayStr);
      // Mulai rentang baru: lanjut ke pemilihan tanggal selesai (kecuali jika sudah ada draftTo >= dayStr tidak diubah otomatis, lebih nyaman 2-tap langsung pilih akhir).
      setDraftTo(null);
      setActiveEdge("to");
      return;
    }

    if (draftFrom && dayStr < draftFrom) {
      setDraftFrom(dayStr);
      setDraftTo(draftFrom);
    } else {
      setDraftTo(dayStr);
    }
    setActiveEdge("from");
  }

  function handleConfirm() {
    // Jika hanya memilih satu tanggal di kalender, anggap rentang 1 hari tersebut.
    if (draftFrom && !draftTo) {
      onApply({ fromDate: draftFrom, toDate: draftFrom });
      return;
    }
    if (!draftFrom && draftTo) {
      onApply({ fromDate: draftTo, toDate: draftTo });
      return;
    }
    onApply({ fromDate: draftFrom, toDate: draftTo });
  }

  const dayCount = draftFrom && draftTo ? countInclusiveDays(draftFrom, draftTo) : draftFrom || draftTo ? 1 : null;
  const cellHeight = isSmallPhone ? 36 : 40;
  const rangeSummary =
    draftFrom && draftTo
      ? `${dayCount} hari terpilih`
      : draftFrom
        ? "Pilih tanggal akhir di kalender (atau Terapkan untuk 1 hari)"
        : "Pilih tanggal di kalender atau tanpa batas";

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 21, fontWeight: "600" }}>
          Atur Rentang Tanggal
        </Text>
        <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm }}>
          {rangeSummary}
        </Text>

        <ScrollView style={{ maxHeight: sheetMaxBodyHeight }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm }}>
            <Chip
              label="Hari ini"
              active={draftFrom === todayStr && draftTo === todayStr}
              onPress={() => applyQuickPreset(todayStr, todayStr)}
            />
            <Chip
              label="7 hari"
              active={draftFrom === addDaysToDateString(todayStr, -6) && draftTo === todayStr}
              onPress={() => applyQuickPreset(addDaysToDateString(todayStr, -6), todayStr)}
            />
            <Chip
              label="30 hari"
              active={draftFrom === addDaysToDateString(todayStr, -29) && draftTo === todayStr}
              onPress={() => applyQuickPreset(addDaysToDateString(todayStr, -29), todayStr)}
            />
            <Chip
              label="Bulan ini"
              active={(() => {
                const m = monthRange(0);
                return draftFrom === m.fromDate && draftTo === m.toDate;
              })()}
              onPress={() => {
                const m = monthRange(0);
                applyQuickPreset(m.fromDate, m.toDate);
              }}
            />
            <Chip
              label="Bulan lalu"
              active={(() => {
                const m = monthRange(-1);
                return draftFrom === m.fromDate && draftTo === m.toDate;
              })()}
              onPress={() => {
                const m = monthRange(-1);
                applyQuickPreset(m.fromDate, m.toDate);
              }}
            />
            <Chip
              label="Tanpa batas"
              active={draftFrom === null && draftTo === null}
              onPress={() => applyQuickPreset(null, null)}
            />
          </View>

          <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm }}>
            <EdgeBox
              label="Dari tanggal"
              value={draftFrom ? formatShortDateId(draftFrom, true) : "Awal data"}
              active={activeEdge === "from"}
              onPress={() => {
                setActiveEdge("from");
                if (draftFrom) focusMonthOf(draftFrom);
              }}
              onClear={draftFrom ? () => setDraftFrom(null) : undefined}
            />
            <EdgeBox
              label="Sampai tanggal"
              value={draftTo ? formatShortDateId(draftTo, true) : draftFrom ? formatShortDateId(draftFrom, true) : "Sekarang"}
              active={activeEdge === "to"}
              onPress={() => {
                setActiveEdge("to");
                if (draftTo) focusMonthOf(draftTo);
              }}
              onClear={draftTo ? () => setDraftTo(null) : undefined}
            />
          </View>

          <View
            style={{
              backgroundColor: color.surfaceAlt,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: color.border,
              padding: spacing.xs,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs }}>
              <Pressable
                onPress={() => stepMonth(-1)}
                accessibilityLabel="Bulan sebelumnya"
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? color.surface : "transparent",
                })}
              >
                <Icon name="chevronLeft" color={color.textPrimary} size={18} />
              </Pressable>
              <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "700" }}>
                {formatMonthYearId(cursorYear, cursorMonth)}
              </Text>
              <Pressable
                onPress={() => stepMonth(1)}
                accessibilityLabel="Bulan berikutnya"
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? color.surface : "transparent",
                })}
              >
                <Icon name="chevronRight" color={color.textPrimary} size={18} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", marginBottom: 4 }}>
              {CALENDAR_WEEKDAYS.map((wd) => (
                <Text
                  key={wd}
                  style={{ flex: 1, textAlign: "center", color: color.textMuted, fontSize: 11, fontWeight: "600" }}
                >
                  {wd}
                </Text>
              ))}
            </View>

            <View style={{ gap: 2 }}>
              {rows.map((week, wi) => (
                <View key={wi} style={{ flexDirection: "row" }}>
                  {week.map((dayStr, di) => {
                    if (!dayStr) {
                      return <View key={`blank-${wi}-${di}`} style={{ flex: 1, height: cellHeight }} />;
                    }
                    const isStart = draftFrom === dayStr;
                    const isEnd = draftTo === dayStr;
                    const isSelected = isStart || isEnd;
                    const inRange = Boolean(draftFrom && draftTo && dayStr > draftFrom && dayStr < draftTo);
                    const isToday = dayStr === todayStr;
                    const isFuture = dayStr > todayStr;
                    const dayNum = Number(dayStr.slice(8, 10));

                    return (
                      <Pressable
                        key={dayStr}
                        onPress={() => handleDayPress(dayStr)}
                        style={{
                          flex: 1,
                          height: cellHeight,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: isSelected ? radius.pill : inRange ? radius.sm : radius.md,
                          backgroundColor: isSelected ? color.primary : inRange ? color.primarySoft : "transparent",
                          borderWidth: isToday && !isSelected ? 1.5 : 0,
                          borderColor: color.primaryDeep,
                          opacity: isFuture && !isSelected ? 0.5 : 1,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected || isToday ? "700" : "500",
                            color: isSelected ? color.textOnPrimary : inRange ? color.primaryDeep : color.textPrimary,
                          }}
                        >
                          {dayNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <Button label="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Terapkan" onPress={handleConfirm} style={{ flex: 2 }} />
        </View>
      </View>
    </BottomSheet>
  );
}

function EdgeBox({
  label,
  value,
  active,
  onPress,
  onClear,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 52,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: active ? color.primary : color.border,
        backgroundColor: active ? color.primarySoft : color.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.xs,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: active ? color.primaryDeep : color.textMuted, fontSize: 10, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "600", marginTop: 1 }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {onClear && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onClear();
          }}
          hitSlop={8}
          accessibilityLabel={`Hapus ${label}`}
          style={{ paddingHorizontal: 4, paddingVertical: 2 }}
        >
          <Text style={{ color: color.textMuted, fontSize: 14, fontWeight: "700" }}>✕</Text>
        </Pressable>
      )}
    </Pressable>
  );
}
