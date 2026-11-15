import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, TextInput, ScrollView } from "react-native";
import { Icon } from "@/components/common/Icon";
import { Button } from "@/components/common/Button";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, font, radius, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { usePosStore, useCartTotals } from "@/store/posStore";
import { useMemberStore } from "@/store/memberStore";
import { useStylists } from "@/hooks/useStylists";
import { QtyInputModal } from "@/components/common/QtyInputModal";
import { MemberPickerModal } from "@/components/member/MemberPickerModal";
import {
  calcCheckoutMemberPoints,
  canRedeemFreeTreatment,
  countCartTreatments,
  FREE_TREATMENT_POINTS,
} from "@/utils/membership";
import type { CartLine } from "@/types";

interface CartPanelProps {
  onCheckout: () => void;
}

/**
 * Cart rows + order summary. Orientation-agnostic: fills whatever container
 * it is given (full Cart tab on phones, fixed side rail on tablets).
 * Service lines get a stylist picker, which is what makes commission work.
 */
export function CartPanel({ onCheckout }: CartPanelProps) {
  const { isCompactHeight, isSmallPhone } = useResponsiveLayout();
  const lines = usePosStore((s) => s.lines);
  const customerName = usePosStore((s) => s.customerName);
  const memberId = usePosStore((s) => s.memberId);
  const redeemFreeLineId = usePosStore((s) => s.redeemFreeLineId);
  const removeLine = usePosStore((s) => s.removeLine);
  const updateLineQty = usePosStore((s) => s.updateLineQty);
  const setLineStylist = usePosStore((s) => s.setLineStylist);
  const setCustomerName = usePosStore((s) => s.setCustomerName);
  const setMember = usePosStore((s) => s.setMember);
  const setRedeemFreeLine = usePosStore((s) => s.setRedeemFreeLine);
  const members = useMemberStore((s) => s.members);
  const totals = useCartTotals();
  const stylists = useStylists();
  const [qtyLine, setQtyLine] = useState<CartLine | null>(null);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);

  const selectedMember = useMemo(
    () => (memberId ? members.find((m) => m.id === memberId) ?? null : null),
    [memberId, members]
  );

  const totalServiceQty = useMemo(() => countCartTreatments(lines), [lines]);
  const memberEligibleForFree = useMemo(
    () => (selectedMember ? canRedeemFreeTreatment(selectedMember.points, totalServiceQty) : false),
    [selectedMember, totalServiceQty]
  );
  const pointCalc = useMemo(
    () =>
      selectedMember
        ? calcCheckoutMemberPoints(lines, redeemFreeLineId, selectedMember.points)
        : null,
    [selectedMember, lines, redeemFreeLineId]
  );
  const firstServiceLine = useMemo(
    () => lines.find((l) => l.item.type === "service") ?? null,
    [lines]
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={lines}
        keyExtractor={(l) => l.lineId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: isCompactHeight ? spacing.md : spacing.xl }}>
            <Icon name="cart" color={color.borderStrong} size={isCompactHeight ? 36 : 48} />
            <Text style={{ color: color.textMuted, fontSize: 14, marginTop: spacing.xs }}>Keranjang masih kosong</Text>
          </View>
        }
        renderItem={({ item: line }) => (
          <View
            style={{
              backgroundColor: color.surface,
              borderRadius: radius.xl,
              padding: isSmallPhone ? spacing.xs + 2 : spacing.sm,
              borderWidth: 1,
              borderColor: color.border,
              flexDirection: "row",
              gap: spacing.sm,
            }}
          >
            {!isSmallPhone && (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.md,
                  backgroundColor: color.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: font.display, fontSize: 22, color: color.primaryDeep, opacity: 0.6 }}>
                  {line.item.name.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.xs }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>
                    {line.item.name}
                  </Text>
                  <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 1 }}>{formatRupiah(line.item.price)}</Text>
                </View>
                <Pressable
                  onPress={() => removeLine(line.lineId)}
                  hitSlop={8}
                  accessibilityLabel="Hapus item"
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: pressed ? "#F6D9DD" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: -4,
                    marginRight: -4,
                  })}
                >
                  <Icon name="trash" color={color.danger} size={19} />
                </Pressable>
              </View>

              {line.item.type === "service" && stylists.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, marginTop: spacing.xs, paddingVertical: 2 }}
                >
                  {stylists.map((st) => {
                    const active = line.stylistId === st.id;
                    return (
                      <Pressable
                        key={st.id}
                        onPress={() => setLineStylist(line.lineId, active ? null : st.id)}
                        hitSlop={4}
                        style={({ pressed }) => ({
                          minHeight: 34,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: radius.pill,
                          backgroundColor: active ? color.primary : pressed ? color.border : color.surfaceAlt,
                          borderWidth: 1,
                          borderColor: active ? color.primary : color.border,
                          alignItems: "center",
                          justifyContent: "center",
                        })}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "600", color: active ? color.textOnPrimary : color.textSecondary }}>
                          {st.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {line.item.type === "service" && stylists.length > 0 && !line.stylistId && (
                <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 3 }}>Pilih stylist agar komisi terhitung</Text>
              )}

              {line.item.type === "service" && selectedMember && memberEligibleForFree && (
                <View style={{ marginTop: spacing.xs }}>
                  <Pressable
                    onPress={() =>
                      setRedeemFreeLine(redeemFreeLineId === line.lineId ? null : line.lineId)
                    }
                    hitSlop={6}
                    style={{
                      alignSelf: "flex-start",
                      minHeight: 34,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radius.pill,
                      backgroundColor: redeemFreeLineId === line.lineId ? color.accent : color.surfaceAlt,
                      borderWidth: 1,
                      borderColor: redeemFreeLineId === line.lineId ? color.accent : color.borderStrong,
                    }}
                  >
                    <Icon
                      name="gift"
                      color={redeemFreeLineId === line.lineId ? color.accentOn : color.primaryDeep}
                      size={14}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: redeemFreeLineId === line.lineId ? color.accentOn : color.primaryDeep,
                      }}
                    >
                      {redeemFreeLineId === line.lineId
                        ? "✓ Gratis 1x Treatment Dipakai (-100p)"
                        : "Pakai Gratis 1x Treatment (100p)"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {line.adjustments.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.xs }}>
                  {line.adjustments.map((a, i) => {
                    const extra = a.kind === "additional";
                    return (
                      <View
                        key={`${a.promoId}-${i}`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: radius.pill,
                          backgroundColor: extra ? "#FBEBD0" : "#DDEFE3",
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "800", color: extra ? "#8A5A12" : "#2F6B4A" }}>
                          {extra ? "TAMBAHAN" : a.kind === "promo" ? "PROMO" : "DISKON"}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: extra ? "#8A5A12" : "#2F6B4A" }} numberOfLines={1}>
                          {a.name} {extra ? "+" : "-"}{formatRupiah(a.amount)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: spacing.xs,
                  gap: spacing.xs,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: color.surfaceAlt,
                    borderRadius: radius.pill,
                    padding: 4,
                  }}
                >
                  <Pressable
                    onPress={() => updateLineQty(line.lineId, Math.max(1, line.qty - 1))}
                    hitSlop={8}
                    accessibilityLabel="Kurangi jumlah"
                    style={({ pressed }) => ({
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: pressed ? color.border : color.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Icon name="minus" color={color.textPrimary} size={15} />
                  </Pressable>
                  <Pressable
                    onPress={() => setQtyLine(line)}
                    hitSlop={6}
                    accessibilityLabel="Ubah jumlah"
                    style={{ minWidth: 36, minHeight: 34, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "700", textAlign: "center" }}>
                      {line.qty}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateLineQty(line.lineId, line.qty + 1)}
                    hitSlop={8}
                    accessibilityLabel="Tambah jumlah"
                    style={({ pressed }) => ({
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: pressed ? "#DB6C93" : color.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Icon name="plus" color={color.textOnPrimary} size={15} />
                  </Pressable>
                </View>
                <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
                  {line.lineDiscount > 0 && (
                    <Text style={{ color: color.textMuted, fontSize: 11, textDecorationLine: "line-through" }} numberOfLines={1}>
                      {formatRupiah(line.item.price * line.qty)}
                    </Text>
                  )}
                  <Text
                    style={{ color: color.primaryDeep, fontSize: 15, fontWeight: "700" }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatRupiah(line.lineTotal)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      />

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: color.border,
          paddingTop: isCompactHeight ? spacing.xs : spacing.sm,
          gap: spacing.xxs,
        }}
      >
        {selectedMember ? (
          <View
            style={{
              backgroundColor: color.primarySoft,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: color.borderStrong,
              padding: spacing.xs,
              marginBottom: spacing.xxs,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                <Icon name="award" color={color.primaryDeep} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: color.textPrimary, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                    {selectedMember.name} ({selectedMember.memberCode})
                  </Text>
                  <Text style={{ color: color.textSecondary, fontSize: 11 }} numberOfLines={1}>
                    Saldo: {selectedMember.points} poin
                    {pointCalc && pointCalc.pointsEarned > 0 ? ` • Dapat +${pointCalc.pointsEarned}p` : ""}
                    {pointCalc && pointCalc.pointsRedeemed > 0 ? ` • Tukar -${pointCalc.pointsRedeemed}p` : ""}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setMemberPickerOpen(true)}
                hitSlop={6}
                style={({ pressed }) => ({
                  minHeight: 34,
                  backgroundColor: pressed ? color.surfaceAlt : color.surface,
                  borderRadius: radius.pill,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: color.border,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: color.primaryDeep, fontSize: 12, fontWeight: "700" }}>Ganti</Text>
              </Pressable>
            </View>

            {memberEligibleForFree && firstServiceLine && (
              <Pressable
                onPress={() =>
                  setRedeemFreeLine(redeemFreeLineId ? null : firstServiceLine.lineId)
                }
                style={{
                  minHeight: 36,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: redeemFreeLineId ? color.accent : color.surface,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.xs,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: redeemFreeLineId ? color.accent : color.borderStrong,
                }}
              >
                <Text
                  style={{
                    color: redeemFreeLineId ? color.accentOn : color.textPrimary,
                    fontSize: 11,
                    fontWeight: "700",
                    flex: 1,
                  }}
                >
                  {redeemFreeLineId
                    ? `🎁 Gratis 1x Treatment aktif (-${FREE_TREATMENT_POINTS} poin)`
                    : `🎁 Gratis 1x Treatment tersedia! Ketuk untuk pakai (-${FREE_TREATMENT_POINTS} poin)`}
                </Text>
                <Text
                  style={{
                    color: redeemFreeLineId ? color.accentOn : color.primaryDeep,
                    fontSize: 11,
                    fontWeight: "800",
                    marginLeft: spacing.xs,
                  }}
                >
                  {redeemFreeLineId ? "Batalkan" : "Pakai"}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xxs }}>
            <TextInput
              value={customerName ?? ""}
              onChangeText={(v) => setCustomerName(v.length ? v : null)}
              placeholder="Nama pelanggan (opsional)"
              placeholderTextColor={color.textMuted}
              style={{
                flex: 1,
                minHeight: 44,
                backgroundColor: color.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: color.border,
                color: color.textPrimary,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                fontSize: 14,
              }}
            />
            <Pressable
              onPress={() => setMemberPickerOpen(true)}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: pressed ? color.primary : color.primarySoft,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: color.borderStrong,
                paddingHorizontal: spacing.sm,
                justifyContent: "center",
              })}
            >
              <Icon name="award" color={color.primaryDeep} size={16} />
              <Text style={{ color: color.primaryDeep, fontSize: 12, fontWeight: "700" }}>Member</Text>
            </Pressable>
          </View>
        )}

        {!isCompactHeight && (
          <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 16, fontWeight: "600", marginBottom: 2 }}>
            Ringkasan
          </Text>
        )}
        <Row label="Subtotal" value={formatRupiah(totals.subtotal)} />
        {totals.discountTotal > 0 && <Row label="Diskon / promo" value={`-${formatRupiah(totals.discountTotal)}`} />}
        {totals.extraTotal > 0 && <Row label="Biaya tambahan" value={formatRupiah(totals.extraTotal)} />}
        <Row label="Total" value={formatRupiah(totals.grandTotal)} emphasis />

        <Button
          label="Bayar"
          size={isCompactHeight ? "md" : "lg"}
          fullWidth
          disabled={lines.length === 0}
          onPress={onCheckout}
          style={{ marginTop: isCompactHeight ? spacing.xs : spacing.sm }}
        />
      </View>

      <MemberPickerModal
        visible={memberPickerOpen}
        selectedMemberId={memberId}
        onClose={() => setMemberPickerOpen(false)}
        onSelect={(member) => setMember(member)}
      />

      <QtyInputModal
        visible={qtyLine !== null}
        title={qtyLine?.item.name ?? ""}
        subtitle="Ketik jumlah yang dipesan"
        initial={qtyLine?.qty ?? 1}
        onClose={() => setQtyLine(null)}
        onConfirm={(qty) => {
          if (qtyLine) updateLineQty(qtyLine.lineId, qty);
          setQtyLine(null);
        }}
      />
    </View>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: emphasis ? 4 : 0 }}>
      <Text style={{ color: emphasis ? color.textPrimary : color.textSecondary, fontSize: emphasis ? 16 : 13, fontWeight: emphasis ? "700" : "400" }}>
        {label}
      </Text>
      <Text style={{ color: emphasis ? color.primaryDeep : color.textPrimary, fontSize: emphasis ? 18 : 13, fontWeight: emphasis ? "700" : "500" }}>
        {value}
      </Text>
    </View>
  );
}
