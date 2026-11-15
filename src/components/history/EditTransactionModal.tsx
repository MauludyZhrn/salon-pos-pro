import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { Chip } from "@/components/common/Chip";
import { Icon } from "@/components/common/Icon";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, font, radius, spacing } from "@/constants/theme";
import { useStylists } from "@/hooks/useStylists";
import { updateTransaction } from "@/services/transactionRepo";
import { formatRupiah } from "@/utils/money";
import { METHOD_LABEL } from "@/utils/receiptText";
import { computeCartTotals, rebuildCartLine } from "@/utils/transaction";
import type { AdjustmentRule, CartLine, PaymentLeg, PaymentMethod, Transaction } from "@/types";

interface EditTransactionModalProps {
  visible: boolean;
  tx: Transaction | null;
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
}

interface EditLine {
  line: CartLine;
  qty: string;
  stylistId: string | null;
  removed: boolean;
  discount: string;
  extra: string;
  discountTouched: boolean;
  extraTouched: boolean;
}

const SIMPLE_METHODS: PaymentMethod[] = ["cash", "qris", "edc"];
const digits = (v: string) => v.replace(/\D/g, "");

function toEditLine(line: CartLine): EditLine {
  return {
    line,
    qty: String(line.qty),
    stylistId: line.stylistId,
    removed: false,
    discount: String(line.lineDiscount),
    extra: String(line.lineExtra),
    discountTouched: false,
    extraTouched: false,
  };
}

/** Hitung ulang satu baris dari isian form. Promo lama mengikuti jumlah baru; diskon / tambahan yang diketik jadi nominal tetap. */
function effectiveLine(e: EditLine): CartLine {
  const qty = Math.max(1, Number(digits(e.qty)) || 1);
  let rules: AdjustmentRule[] = e.line.adjustments.map(({ amount: _a, ...rule }) => rule);
  if (e.discountTouched) {
    rules = rules.filter((r) => r.kind === "additional");
    const v = Number(digits(e.discount)) || 0;
    if (v > 0) rules.push({ promoId: "manual", name: "Diskon", kind: "discount", valueType: "flat", value: v });
  }
  if (e.extraTouched) {
    rules = rules.filter((r) => r.kind !== "additional");
    const v = Number(digits(e.extra)) || 0;
    if (v > 0) rules.push({ promoId: "manual", name: "Biaya tambahan", kind: "additional", valueType: "flat", value: v });
  }
  return rebuildCartLine(e.line, { qty, stylistId: e.stylistId, rules });
}

/** Koreksi transaksi yang sudah tercatat: nama, metode bayar, jumlah, stylist, diskon, biaya tambahan. */
export function EditTransactionModal({ visible, tx, onClose, onSaved }: EditTransactionModalProps) {
  const { sheetMaxBodyHeight } = useResponsiveLayout();
  const stylists = useStylists();
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [rows, setRows] = useState<EditLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !tx) return;
    setCustomer(tx.customerName ?? "");
    setMethod(tx.paymentMethod);
    setRows(tx.lines.map(toEditLine));
  }, [visible, tx]);

  const effective = useMemo(() => rows.map((r) => ({ row: r, line: effectiveLine(r) })), [rows]);
  const activeLines = useMemo(() => effective.filter((e) => !e.row.removed).map((e) => e.line), [effective]);
  const totals = useMemo(() => computeCartTotals(activeLines), [activeLines]);

  if (!tx) return null;
  const original = tx;

  const methods: PaymentMethod[] = SIMPLE_METHODS.includes(original.paymentMethod) ? SIMPLE_METHODS : [...SIMPLE_METHODS, original.paymentMethod];
  const delta = totals.grandTotal - original.grandTotal;

  function patch(lineId: string, change: Partial<EditLine>) {
    setRows((prev) => prev.map((r) => (r.line.lineId === lineId ? { ...r, ...change } : r)));
  }

  function bumpQty(r: EditLine, d: number) {
    const cur = Number(digits(r.qty)) || 1;
    patch(r.line.lineId, { qty: String(Math.min(999, Math.max(1, cur + d))) });
  }

  function buildBreakdown(): PaymentLeg[] | null {
    const sameTotal = totals.grandTotal === original.grandTotal;
    if (method === original.paymentMethod && sameTotal) return original.paymentBreakdown;
    if (method === "cash" || method === "qris" || method === "edc") return [{ method, amount: totals.grandTotal }];
    return null; // split / metode lama dengan total yang berubah
  }

  async function doSave() {
    const breakdown = buildBreakdown();
    if (!breakdown) {
      return Alert.alert("Pilih metode bayar", `Total berubah, jadi metode "${METHOD_LABEL[method]}" tidak bisa dipertahankan. Pilih Tunai, QRIS, atau Kartu.`);
    }
    setSaving(true);
    try {
      const saved = await updateTransaction(original, {
        customerName: customer.trim() ? customer.trim() : null,
        paymentMethod: method,
        paymentBreakdown: breakdown,
        lines: activeLines,
      });
      onSaved(saved);
    } catch (e) {
      Alert.alert("Gagal menyimpan", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (activeLines.length === 0) return Alert.alert("Minimal satu item", "Batalkan penghapusan salah satu item.");
    Alert.alert("Simpan perubahan?", "Total, komisi, stok, dan laporan keuangan untuk transaksi ini ikut dihitung ulang.", [
      { text: "Batal", style: "cancel" },
      { text: "Simpan", onPress: doSave },
    ]);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600" }}>Edit transaksi</Text>
        <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm }}>{original.receiptNo}</Text>

        <ScrollView style={{ maxHeight: sheetMaxBodyHeight }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Label>Nama pelanggan</Label>
          <TextInput value={customer} onChangeText={setCustomer} placeholder="Opsional" placeholderTextColor={color.textMuted} style={inputStyle} />

          <Label>Metode bayar</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {methods.map((m) => (
              <Chip key={m} label={METHOD_LABEL[m]} active={method === m} onPress={() => setMethod(m)} />
            ))}
          </View>

          <Label>Item</Label>
          <View style={{ gap: spacing.xs }}>
            {effective.map(({ row, line }) => {
              const gross = row.line.item.price * (Number(digits(row.qty)) || 1);
              return (
                <View
                  key={row.line.lineId}
                  style={{
                    borderWidth: 1,
                    borderColor: color.border,
                    borderRadius: radius.lg,
                    padding: spacing.sm,
                    backgroundColor: row.removed ? color.surfaceAlt : color.surface,
                    opacity: row.removed ? 0.6 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.xs }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "700", textDecorationLine: row.removed ? "line-through" : "none" }} numberOfLines={2}>
                        {row.line.item.name}
                      </Text>
                      <Text style={{ color: color.textMuted, fontSize: 12 }}>{formatRupiah(row.line.item.price)} / unit</Text>
                    </View>
                    <Pressable onPress={() => patch(row.line.lineId, { removed: !row.removed })} hitSlop={10}>
                      <Text style={{ color: row.removed ? color.primaryDeep : color.danger, fontSize: 12, fontWeight: "700" }}>
                        {row.removed ? "Batalkan hapus" : "Hapus item"}
                      </Text>
                    </Pressable>
                  </View>

                  {!row.removed && (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
                        <Text style={{ color: color.textSecondary, fontSize: 12, width: 52 }}>Jumlah</Text>
                        <Pressable onPress={() => bumpQty(row, -1)} hitSlop={6} style={stepStyle}>
                          <Icon name="minus" color={color.textPrimary} size={14} />
                        </Pressable>
                        <TextInput
                          value={row.qty}
                          onChangeText={(v) => patch(row.line.lineId, { qty: digits(v).slice(0, 3) })}
                          keyboardType="number-pad"
                          selectTextOnFocus
                          style={[inputStyle, { width: 64, textAlign: "center", paddingVertical: 6 }]}
                        />
                        <Pressable onPress={() => bumpQty(row, 1)} hitSlop={6} style={[stepStyle, { backgroundColor: color.primary, borderColor: color.primary }]}>
                          <Icon name="plus" color={color.textOnPrimary} size={14} />
                        </Pressable>
                      </View>

                      {row.line.item.type === "service" && stylists.length > 0 && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.xs }}>
                          {stylists.map((st) => (
                            <Chip
                              key={st.id}
                              label={st.name}
                              active={row.stylistId === st.id}
                              onPress={() => patch(row.line.lineId, { stylistId: row.stylistId === st.id ? null : st.id })}
                            />
                          ))}
                        </View>
                      )}

                      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
                        <View style={{ flex: 1 }}>
                          <Text style={smallLabel}>Diskon (Rp)</Text>
                          <TextInput
                            value={row.discountTouched ? row.discount : String(line.lineDiscount)}
                            onChangeText={(v) => patch(row.line.lineId, { discount: digits(v), discountTouched: true })}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            style={[inputStyle, { paddingVertical: 6 }]}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={smallLabel}>Biaya tambahan (Rp)</Text>
                          <TextInput
                            value={row.extraTouched ? row.extra : String(line.lineExtra)}
                            onChangeText={(v) => patch(row.line.lineId, { extra: digits(v), extraTouched: true })}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            style={[inputStyle, { paddingVertical: 6 }]}
                          />
                        </View>
                      </View>
                      {row.discountTouched && (Number(digits(row.discount)) || 0) > gross && (
                        <Text style={{ color: color.danger, fontSize: 11, marginTop: 2 }}>Diskon dibatasi sampai {formatRupiah(gross)}.</Text>
                      )}

                      <Text style={{ color: color.primaryDeep, fontSize: 14, fontWeight: "700", textAlign: "right", marginTop: spacing.xs }}>
                        {formatRupiah(line.lineTotal)}
                      </Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: spacing.md, gap: 2 }}>
            <SumRow label="Subtotal" value={formatRupiah(totals.subtotal)} />
            {totals.discountTotal > 0 && <SumRow label="Diskon / promo" value={`-${formatRupiah(totals.discountTotal)}`} />}
            {totals.extraTotal > 0 && <SumRow label="Biaya tambahan" value={formatRupiah(totals.extraTotal)} />}
            <SumRow label="Total" value={formatRupiah(totals.grandTotal)} emphasis />
            {delta !== 0 && (
              <Text style={{ color: color.textMuted, fontSize: 12, textAlign: "right" }}>
                Sebelumnya {formatRupiah(original.grandTotal)} ({delta > 0 ? "+" : "-"}{formatRupiah(Math.abs(delta))})
              </Text>
            )}
          </View>
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <Button label="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Simpan perubahan" loading={saving} disabled={activeLines.length === 0} onPress={handleSave} style={{ flex: 2 }} />
        </View>
      </View>
    </BottomSheet>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ color: color.textSecondary, fontSize: 13, fontWeight: "600", marginTop: spacing.sm, marginBottom: spacing.xxs }}>{children}</Text>;
}

function SumRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: emphasis ? color.textPrimary : color.textSecondary, fontSize: emphasis ? 16 : 13, fontWeight: emphasis ? "700" : "400" }}>{label}</Text>
      <Text style={{ color: emphasis ? color.primaryDeep : color.textPrimary, fontSize: emphasis ? 18 : 13, fontWeight: emphasis ? "700" : "500" }}>{value}</Text>
    </View>
  );
}

const smallLabel = { color: color.textSecondary, fontSize: 11, marginBottom: 2 } as const;

const stepStyle = {
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: color.surfaceAlt,
  borderWidth: 1,
  borderColor: color.border,
  alignItems: "center",
  justifyContent: "center",
} as const;

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
