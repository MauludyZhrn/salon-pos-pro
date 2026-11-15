import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, Switch } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { Chip } from "@/components/common/Chip";
import { color, font, radius, spacing } from "@/constants/theme";
import { useCatalog } from "@/hooks/useCatalog";
import { usePromoStore } from "@/store/promoStore";
import { percentToBps } from "@/utils/money";
import { addDaysToDateString, isValidDateString, localDateString } from "@/utils/promotions";
import type { PromoKind, PromoScope, PromoValueType, Promotion } from "@/types";

interface PromotionFormModalProps {
  visible: boolean;
  /** null = buat baru */
  promo: Promotion | null;
  onClose: () => void;
}

const KINDS: { key: PromoKind; label: string; hint: string }[] = [
  { key: "discount", label: "Diskon", hint: "Potongan harga biasa." },
  { key: "promo", label: "Promo", hint: "Potongan untuk periode tertentu, ditandai PROMO di kasir." },
  { key: "additional", label: "Biaya tambahan", hint: "Menambah harga (mis. biaya bahan, panjang rambut)." },
];

const SCOPES: { key: PromoScope; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "service", label: "Semua layanan" },
  { key: "retail", label: "Semua produk" },
  { key: "items", label: "Pilih item" },
];

const digits = (v: string) => v.replace(/\D/g, "");
const decimal = (v: string) => v.replace(",", ".").replace(/[^0-9.]/g, "");

/** Tambah / ubah / hapus satu diskon, promo, atau biaya tambahan. */
export function PromotionFormModal({ visible, promo, onClose }: PromotionFormModalProps) {
  const save = usePromoStore((s) => s.save);
  const remove = usePromoStore((s) => s.remove);
  const { items } = useCatalog();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<PromoKind>("promo");
  const [valueType, setValueType] = useState<Exclude<PromoValueType, "flat">>("percent");
  const [valueText, setValueText] = useState("");
  const [scope, setScope] = useState<PromoScope>("all");
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (promo) {
      setName(promo.name);
      setKind(promo.kind);
      setValueType(promo.valueType);
      setValueText(promo.valueType === "percent" ? String(promo.value / 100) : String(promo.value));
      setScope(promo.scope);
      setItemIds(promo.itemIds);
      setStartDate(promo.startDate ?? "");
      setEndDate(promo.endDate ?? "");
      setActive(promo.active);
    } else {
      setName("");
      setKind("promo");
      setValueType("percent");
      setValueText("");
      setScope("all");
      setItemIds([]);
      setStartDate(localDateString());
      setEndDate("");
      setActive(true);
    }
  }, [visible, promo]);

  const kindHint = useMemo(() => KINDS.find((k) => k.key === kind)?.hint ?? "", [kind]);
  const sortedItems = useMemo(() => [...items].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)), [items]);

  function toggleItem(id: string) {
    setItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("Nama wajib diisi", "Contoh: Promo Gajian");

    let value: number;
    if (valueType === "percent") {
      const pct = Number(valueText);
      if (!(pct > 0) || pct > 100) return Alert.alert("Persen tidak valid", "Isi angka lebih dari 0 sampai 100.");
      value = percentToBps(pct);
    } else {
      value = Number(valueText);
      if (!Number.isInteger(value) || value <= 0) return Alert.alert("Nominal tidak valid", "Isi nominal Rupiah lebih dari 0.");
    }

    if (scope === "items" && itemIds.length === 0) return Alert.alert("Pilih item", "Centang minimal satu layanan atau produk.");

    const start = startDate.trim();
    const end = endDate.trim();
    if (start && !isValidDateString(start)) return Alert.alert("Tanggal mulai tidak valid", "Pakai format tahun-bulan-tanggal, mis. 2026-10-25.");
    if (end && !isValidDateString(end)) return Alert.alert("Tanggal selesai tidak valid", "Pakai format tahun-bulan-tanggal, mis. 2026-10-31.");
    if (start && end && end < start) return Alert.alert("Periode terbalik", "Tanggal selesai harus sama atau setelah tanggal mulai.");

    setSaving(true);
    try {
      await save(
        {
          name: trimmed,
          kind,
          valueType,
          value,
          scope,
          itemIds: scope === "items" ? itemIds : [],
          startDate: start || null,
          endDate: end || null,
          active,
        },
        promo?.id
      );
      onClose();
    } catch (e) {
      Alert.alert("Gagal menyimpan", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!promo) return;
    Alert.alert("Hapus?", `"${promo.name}" akan dihapus. Transaksi yang sudah tercatat tidak berubah.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          await remove(promo.id);
          onClose();
        },
      },
    ]);
  }

  const baseDate = isValidDateString(startDate.trim()) ? startDate.trim() : localDateString();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600", marginBottom: spacing.sm }}>
          {promo ? "Ubah" : "Tambah"} promo
        </Text>

        <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Label>Nama</Label>
          <TextInput value={name} onChangeText={setName} placeholder="mis. Promo Gajian" placeholderTextColor={color.textMuted} maxLength={40} style={inputStyle} />

          <Label>Jenis</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {KINDS.map((k) => (
              <Chip key={k.key} label={k.label} active={kind === k.key} onPress={() => setKind(k.key)} />
            ))}
          </View>
          <Text style={hintStyle}>{kindHint}</Text>

          <Label>Nilai</Label>
          <View style={{ flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs }}>
            <Chip label="Persen (%)" active={valueType === "percent"} onPress={() => setValueType("percent")} />
            <Chip label="Nominal (Rp per unit)" active={valueType === "fixed"} onPress={() => setValueType("fixed")} />
          </View>
          <TextInput
            value={valueText}
            onChangeText={(v) => setValueText(valueType === "percent" ? decimal(v) : digits(v))}
            keyboardType={valueType === "percent" ? "decimal-pad" : "number-pad"}
            placeholder={valueType === "percent" ? "mis. 10" : "mis. 5000"}
            placeholderTextColor={color.textMuted}
            style={inputStyle}
          />

          <Label>Berlaku untuk</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {SCOPES.map((sc) => (
              <Chip key={sc.key} label={sc.label} active={scope === sc.key} onPress={() => setScope(sc.key)} />
            ))}
          </View>

          {scope === "items" && (
            <View style={{ marginTop: spacing.xs, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, overflow: "hidden" }}>
              <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled>
                {sortedItems.length === 0 && <Text style={[hintStyle, { padding: spacing.sm }]}>Belum ada layanan atau produk.</Text>}
                {sortedItems.map((it, i) => {
                  const checked = itemIds.includes(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleItem(it.id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 10,
                        backgroundColor: checked ? color.primarySoft : color.surface,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: color.border,
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          borderWidth: 1.5,
                          borderColor: checked ? color.primaryDeep : color.borderStrong,
                          backgroundColor: checked ? color.primaryDeep : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {checked && <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>✓</Text>}
                      </View>
                      <Text style={{ flex: 1, color: color.textPrimary, fontSize: 14 }} numberOfLines={1}>
                        {it.name}
                      </Text>
                      <Text style={{ color: color.textMuted, fontSize: 11 }}>{it.type === "service" ? "Layanan" : "Produk"}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Label>Periode (opsional)</Label>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={hintStyle}>Mulai</Text>
              <TextInput value={startDate} onChangeText={setStartDate} placeholder="2026-10-25" placeholderTextColor={color.textMuted} keyboardType="numbers-and-punctuation" maxLength={10} style={inputStyle} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hintStyle}>Selesai</Text>
              <TextInput value={endDate} onChangeText={setEndDate} placeholder="Tanpa batas" placeholderTextColor={color.textMuted} keyboardType="numbers-and-punctuation" maxLength={10} style={inputStyle} />
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>
            <Chip label="Mulai hari ini" onPress={() => setStartDate(localDateString())} />
            <Chip label="Selesai +7 hari" onPress={() => setEndDate(addDaysToDateString(baseDate, 7))} />
            <Chip label="Selesai +30 hari" onPress={() => setEndDate(addDaysToDateString(baseDate, 30))} />
            <Chip label="Tanpa batas" onPress={() => setEndDate("")} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
            <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "600" }}>Aktif</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: color.primary, false: color.border }} thumbColor="#FFFFFF" />
          </View>
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <Button label="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Simpan" loading={saving} onPress={handleSave} style={{ flex: 2 }} />
        </View>
        {promo && <Button label="Hapus" variant="danger" onPress={confirmDelete} style={{ marginTop: spacing.xs }} />}
      </View>
    </BottomSheet>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ color: color.textSecondary, fontSize: 13, fontWeight: "600", marginTop: spacing.sm, marginBottom: spacing.xxs }}>{children}</Text>;
}

const hintStyle = { color: color.textMuted, fontSize: 11, marginTop: 4, marginBottom: 2 } as const;

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

