import { useEffect, useState } from "react";
import { View, Text, TextInput, Alert, ScrollView } from "react-native";
import { color, font, radius, spacing } from "@/constants/theme";
import { Button } from "@/components/common/Button";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Dropdown } from "@/components/common/Dropdown";
import { useInventoryStore } from "@/store/inventoryStore";
import type { InventoryItem } from "@/types";

interface ItemFormModalProps {
  visible: boolean;
  /** null = create mode */
  item?: InventoryItem | null;
  onClose: () => void;
}

type Kind = "retail" | "bahan_baku";

const digits = (v: string) => v.replace(/\D/g, "");
const decimal = (v: string) => v.replace(",", ".").replace(/[^0-9.]/g, "");

/** Add a product. Retail = sold at the register (also added to the POS catalog). Bahan baku = consumed by services. */
export function ItemFormModal({ visible, item = null, onClose }: ItemFormModalProps) {
  const addItem = useInventoryStore((s) => s.addItem);
  const updateItem = useInventoryStore((s) => s.updateItem);
  const deleteItem = useInventoryStore((s) => s.deleteItem);
  const editing = item !== null;
  const [kind, setKind] = useState<Kind>("retail");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");
  const [cost, setCost] = useState("");
  const [sell, setSell] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (item) {
      setKind(item.category);
      setName(item.name);
      setUnit(item.unit);
      setStock(String(item.stockQty));
      setThreshold(String(item.lowStockThreshold));
      setCost(String(item.costPrice));
      setSell(item.sellPrice != null ? String(item.sellPrice) : "");
      return;
    }
    setKind("retail");
    setName("");
    setUnit("pcs");
    setStock("");
    setThreshold("");
    setCost("");
    setSell("");
  }, [visible, item]);

  function pickKind(k: Kind) {
    setKind(k);
    setUnit((u) => (k === "retail" && (u === "ml" || u === "g") ? "pcs" : u));
  }

  async function handleSave() {
    if (!name.trim()) return Alert.alert("Nama produk wajib diisi");
    if (!unit.trim()) return Alert.alert("Satuan wajib diisi");
    const sellPrice = Number(digits(sell)) || 0;
    if (kind === "retail" && sellPrice <= 0) return Alert.alert("Harga jual wajib diisi untuk produk retail");

    setSaving(true);
    try {
      const shared = {
        name: name.trim(),
        unit: unit.trim(),
        lowStockThreshold: Number(decimal(threshold)) || 0,
        costPrice: Number(digits(cost)) || 0,
        sellPrice: kind === "retail" ? sellPrice : null,
      };
      if (item) {
        await updateItem(item.itemId, shared);
      } else {
        await addItem({ ...shared, category: kind, stockQty: Number(decimal(stock)) || 0 });
      }
      onClose();
    } catch (err) {
      Alert.alert("Gagal menyimpan", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 22, fontWeight: "600", marginBottom: spacing.md }}>
              {editing ? "Edit Produk" : "Tambah Produk"}
            </Text>

            <Text style={label}>Kategori produk</Text>
            <Dropdown<Kind>
              value={kind}
              onChange={pickKind}
              disabled={editing}
              options={[
                { value: "retail", label: "Retail", hint: "Dijual di Kasir" },
                { value: "bahan_baku", label: "Bahan baku", hint: "Dipakai layanan, tidak dijual langsung" },
              ]}
            />
            <Text style={{ color: color.textMuted, fontSize: 11, marginTop: spacing.xs }}>
              {kind === "retail"
                ? "Produk retail otomatis muncul di Kasir dan stoknya berkurang saat terjual."
                : "Bahan baku dipakai layanan (shampoo, cat rambut). Tidak muncul di Kasir."}
            </Text>

            <Text style={[label, { marginTop: spacing.sm }]}>Nama produk</Text>
            <TextInput value={name} onChangeText={setName} placeholder="contoh: Hair Tonic 100ml" placeholderTextColor={color.textMuted} style={input} />

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={label}>Satuan</Text>
                <TextInput value={unit} onChangeText={setUnit} placeholder="pcs / ml / g" placeholderTextColor={color.textMuted} autoCapitalize="none" style={input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={label}>{editing ? "Stok (ubah lewat Sesuaikan stok)" : "Stok awal"}</Text>
                <TextInput value={stock} editable={!editing} onChangeText={(v) => setStock(decimal(v))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={color.textMuted} style={[input, editing && { opacity: 0.55 }]} />
              </View>
            </View>

            <Text style={[label, { marginTop: spacing.sm }]}>Batas stok menipis</Text>
            <TextInput value={threshold} onChangeText={(v) => setThreshold(decimal(v))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={color.textMuted} style={input} />

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={label}>Harga beli (Rp)</Text>
                <TextInput value={cost} onChangeText={(v) => setCost(digits(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={color.textMuted} style={input} />
              </View>
              {kind === "retail" && (
                <View style={{ flex: 1 }}>
                  <Text style={label}>Harga jual (Rp)</Text>
                  <TextInput value={sell} onChangeText={(v) => setSell(digits(v))} keyboardType="numeric" placeholder="0" placeholderTextColor={color.textMuted} style={input} />
                </View>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <Button label="Batal" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
              <Button label="Simpan" loading={saving} style={{ flex: 1 }} onPress={handleSave} />
            </View>
            {item && (
              <Button
                label="Hapus produk"
                variant="ghost"
                fullWidth
                style={{ marginTop: spacing.sm }}
                onPress={() =>
                  Alert.alert(
                    "Hapus produk?",
                    `${item.name} dihapus dari inventaris${item.category === "retail" ? " dan dari Kasir" : ""}. Riwayat transaksi tidak berubah.`,
                    [
                      { text: "Batal", style: "cancel" },
                      {
                        text: "Hapus",
                        style: "destructive",
                        onPress: async () => {
                          await deleteItem(item.itemId);
                          onClose();
                        },
                      },
                    ]
                  )
                }
              />
            )}
          </ScrollView>
    </BottomSheet>
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
