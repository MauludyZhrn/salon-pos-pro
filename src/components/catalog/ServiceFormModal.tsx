import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Dropdown } from "@/components/common/Dropdown";
import { Button } from "@/components/common/Button";
import { color, font, radius, spacing } from "@/constants/theme";
import { getDb } from "@/services/database";
import { useInventoryStore } from "@/store/inventoryStore";
import { newId } from "@/utils/id";
import type { CatalogItem } from "@/types";

interface ServiceFormModalProps {
  visible: boolean;
  /** null = create mode */
  service: CatalogItem | null;
  /** Categories already used by services, offered in the dropdown. */
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

type Basis = "percent" | "fixed" | "none";

const NEW_CATEGORY = "__new__";
const DEFAULT_CATEGORIES = ["haircut", "coloring", "spa"];

const digits = (v: string) => v.replace(/\D/g, "");
const decimal = (v: string) => v.replace(",", ".").replace(/[^0-9.]/g, "");
const pretty = (c: string) => c.replace(/-/g, " ").replace(/^./, (m) => m.toUpperCase());
const slug = (c: string) => c.trim().toLowerCase().replace(/\s+/g, "-");

/** Add or edit a service: name, category, price, duration, stylist commission and the materials it consumes. */
export function ServiceFormModal({ visible, service, categories, onClose, onSaved }: ServiceFormModalProps) {
  const items = useInventoryStore((s) => s.items);
  const loadInventory = useInventoryStore((s) => s.loadInventory);
  const materials = useMemo(() => items.filter((i) => i.category === "bahan_baku"), [items]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("haircut");
  const [newCategory, setNewCategory] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [basis, setBasis] = useState<Basis>("percent");
  const [commission, setCommission] = useState("");
  const [usage, setUsage] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const categoryOptions = useMemo(() => {
    const all = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories]));
    return [...all.map((c) => ({ value: c, label: pretty(c) })), { value: NEW_CATEGORY, label: "+ Kategori baru" }];
  }, [categories]);

  useEffect(() => {
    if (!visible) return;
    loadInventory();
    if (service) {
      setName(service.name);
      setCategory(service.category);
      setNewCategory("");
      setPrice(String(service.price));
      setDuration(String(service.durationMinutes ?? 30));
      setBasis(service.commissionBasis);
      setCommission(
        service.commissionBasis === "percent"
          ? String(service.commissionValue / 100)
          : service.commissionBasis === "fixed"
            ? String(service.commissionValue)
            : ""
      );
      const u: Record<string, string> = {};
      for (const c of service.consumes ?? []) u[c.inventoryItemId] = String(c.qtyPerUnit);
      setUsage(u);
      return;
    }
    setName("");
    setCategory("haircut");
    setNewCategory("");
    setPrice("");
    setDuration("30");
    setBasis("percent");
    setCommission("");
    setUsage({});
  }, [visible, service, loadInventory]);

  async function handleSave() {
    const finalCategory = category === NEW_CATEGORY ? slug(newCategory) : category;
    const priceNum = Number(digits(price)) || 0;
    if (!name.trim()) return Alert.alert("Nama layanan wajib diisi");
    if (!finalCategory) return Alert.alert("Kategori wajib diisi");
    if (priceNum <= 0) return Alert.alert("Harga wajib diisi");

    const commissionValue =
      basis === "percent" ? Math.round((Number(decimal(commission)) || 0) * 100) : basis === "fixed" ? Number(digits(commission)) || 0 : 0;
    if (basis === "percent" && commissionValue > 10000) return Alert.alert("Komisi persen maksimal 100");

    const consumes = Object.entries(usage)
      .map(([inventoryItemId, qty]) => ({ inventoryItemId, qtyPerUnit: Number(decimal(qty)) || 0 }))
      .filter((c) => c.qtyPerUnit > 0);

    setSaving(true);
    try {
      const db = await getDb();
      const params = [
        name.trim(),
        finalCategory,
        priceNum,
        Math.max(5, Number(digits(duration)) || 30),
        basis,
        commissionValue,
        consumes.length ? JSON.stringify(consumes) : null,
      ];
      if (service) {
        await db.runAsync(
          `UPDATE catalog_items SET name = ?, category = ?, price = ?, duration_minutes = ?, commission_basis = ?, commission_value = ?, consumes_json = ? WHERE id = ?`,
          [...params, service.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO catalog_items (name, category, price, duration_minutes, commission_basis, commission_value, consumes_json, id, type)
           VALUES (?,?,?,?,?,?,?,?, 'service')`,
          [...params, `svc-${newId()}`]
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      Alert.alert("Gagal menyimpan", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!service) return;
    Alert.alert(
      "Hapus layanan?",
      `${service.name} dihapus dari Kasir. Riwayat transaksi tidak berubah. Booking lama yang memakai layanan ini tetap tercatat.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            const db = await getDb();
            await db.runAsync("DELETE FROM catalog_items WHERE id = ? AND type = 'service'", [service.id]);
            onSaved();
            onClose();
          },
        },
      ]
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600", marginBottom: spacing.md }}>
          {service ? "Edit Layanan" : "Tambah Layanan"}
        </Text>

        <Text style={label}>Nama layanan</Text>
        <TextInput value={name} onChangeText={setName} placeholder="contoh: Hair Spa Premium" placeholderTextColor={color.textMuted} style={input} />

        <Text style={[label, { marginTop: spacing.sm }]}>Kategori</Text>
        <Dropdown<string> value={category} onChange={setCategory} options={categoryOptions} />
        {category === NEW_CATEGORY && (
          <TextInput
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder="Nama kategori baru"
            placeholderTextColor={color.textMuted}
            style={[input, { marginTop: spacing.xs }]}
          />
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flex: 1.4 }}>
            <Text style={label}>Harga (Rp)</Text>
            <TextInput value={price} onChangeText={(v) => setPrice(digits(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={color.textMuted} style={input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={label}>Durasi (menit)</Text>
            <TextInput value={duration} onChangeText={(v) => setDuration(digits(v))} keyboardType="numeric" placeholder="30" placeholderTextColor={color.textMuted} style={input} />
          </View>
        </View>

        <Text style={[label, { marginTop: spacing.sm }]}>Komisi stylist</Text>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          <Chip active={basis === "percent"} text="Persen (%)" onPress={() => setBasis("percent")} />
          <Chip active={basis === "fixed"} text="Nominal (Rp)" onPress={() => setBasis("fixed")} />
          <Chip active={basis === "none"} text="Tanpa komisi" onPress={() => setBasis("none")} />
        </View>
        {basis !== "none" && (
          <TextInput
            value={commission}
            onChangeText={(v) => setCommission(basis === "percent" ? decimal(v) : digits(v))}
            keyboardType="decimal-pad"
            placeholder={basis === "percent" ? "contoh: 25" : "contoh: 10000"}
            placeholderTextColor={color.textMuted}
            style={[input, { marginTop: spacing.xs }]}
          />
        )}

        {materials.length > 0 && (
          <>
            <Text style={[label, { marginTop: spacing.md }]}>Bahan terpakai per layanan (opsional)</Text>
            <Text style={{ color: color.textMuted, fontSize: 11, marginBottom: spacing.xs }}>
              Stok bahan berkurang otomatis tiap layanan terjual. Kosongkan kalau tidak dipakai.
            </Text>
            {materials.map((m) => (
              <View key={m.itemId} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
                <Text style={{ flex: 1, color: color.textPrimary, fontSize: 13 }} numberOfLines={1}>
                  {m.name}
                </Text>
                <TextInput
                  value={usage[m.itemId] ?? ""}
                  onChangeText={(v) => setUsage((u) => ({ ...u, [m.itemId]: decimal(v) }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={color.textMuted}
                  style={[input, { width: 80, textAlign: "right" }]}
                />
                <Text style={{ color: color.textMuted, fontSize: 12, width: 28 }}>{m.unit}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          <Button label="Batal" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Button label="Simpan" loading={saving} style={{ flex: 1 }} onPress={handleSave} />
        </View>
        {service && <Button label="Hapus layanan" variant="danger" fullWidth style={{ marginTop: spacing.sm }} onPress={confirmDelete} />}
      </ScrollView>
    </BottomSheet>
  );
}

function Chip({ active, text, onPress }: { active: boolean; text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: active ? color.primary : color.surfaceAlt,
        borderWidth: 1,
        borderColor: active ? color.primary : color.border,
      }}
    >
      <Text style={{ color: active ? color.textOnPrimary : color.textSecondary, fontSize: 12, fontWeight: "600" }}>{text}</Text>
    </Pressable>
  );
}

const label = { color: color.textSecondary, fontSize: 13, marginBottom: spacing.xxs } as const;

const input = {
  backgroundColor: color.surfaceAlt,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.border,
  color: color.textPrimary,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  fontSize: 14,
} as const;
