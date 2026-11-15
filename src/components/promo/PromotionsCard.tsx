import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch } from "react-native";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { PromotionFormModal } from "@/components/promo/PromotionFormModal";
import { color, radius, spacing } from "@/constants/theme";
import { usePromoStore } from "@/store/promoStore";
import { describeValue, KIND_LABEL, promoStatus, type PromoStatus } from "@/utils/promotions";
import type { Promotion } from "@/types";

const SCOPE_LABEL = { all: "Semua item", service: "Semua layanan", retail: "Semua produk" } as const;

const STATUS: Record<PromoStatus, { label: string; bg: string; fg: string }> = {
  live: { label: "Berlaku", bg: "#DDEFE3", fg: "#2F6B4A" },
  upcoming: { label: "Belum mulai", bg: "#E5E9F5", fg: "#4A5A8C" },
  expired: { label: "Berakhir", bg: "#F1E4E4", fg: "#8C4A4A" },
  inactive: { label: "Nonaktif", bg: "#EEE7E4", fg: "#7A6A66" },
};

function period(p: Promotion): string {
  if (!p.startDate && !p.endDate) return "Tanpa batas waktu";
  if (p.startDate && p.endDate) return `${p.startDate} s/d ${p.endDate}`;
  return p.startDate ? `Mulai ${p.startDate}` : `Sampai ${p.endDate}`;
}

/** Pengaturan > Promo & Diskon. Yang berlaku otomatis dipasang ke keranjang dan ditandai di kasir. */
export function PromotionsCard() {
  const promos = usePromoStore((s) => s.promos);
  const load = usePromoStore((s) => s.load);
  const setActive = usePromoStore((s) => s.setActive);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(p: Promotion) {
    setEditing(p);
    setOpen(true);
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs }}>
        <Text style={{ color: color.textPrimary, fontWeight: "600" }}>Promo, diskon & biaya tambahan</Text>
        <Button label="+ Tambah" size="sm" onPress={openNew} style={{ alignSelf: "auto", minHeight: 40 }} />
      </View>
      <Text style={{ color: color.textMuted, fontSize: 12, marginBottom: spacing.sm }}>
        Yang aktif dan sedang dalam periodenya otomatis dipasang ke layanan atau produk di kasir, dengan tanda PROMO di kartu produk dan rincian di keranjang dan struk.
      </Text>

      {promos.length === 0 && <Text style={{ color: color.textMuted, fontSize: 13 }}>Belum ada. Ketuk "+ Tambah".</Text>}

      <View style={{ gap: spacing.xs }}>
        {promos.map((p) => {
          const st = STATUS[promoStatus(p)];
          const scope = p.scope === "items" ? `${p.itemIds.length} item dipilih` : SCOPE_LABEL[p.scope];
          const sign = p.kind === "additional" ? "+" : "-";
          return (
            <Pressable
              key={p.id}
              onPress={() => openEdit(p)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: color.border,
                backgroundColor: pressed ? color.surfaceAlt : color.surface,
              })}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View style={{ backgroundColor: st.bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: st.fg }}>{st.label}</Text>
                  </View>
                </View>
                <Text style={{ color: color.primaryDeep, fontSize: 13, fontWeight: "600", marginTop: 2 }}>
                  {KIND_LABEL[p.kind]} {sign}{describeValue(p.valueType, p.value)}
                </Text>
                <Text style={{ color: color.textMuted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                  {scope} · {period(p)}
                </Text>
              </View>
              <Switch
                value={p.active}
                onValueChange={(v) => setActive(p.id, v)}
                trackColor={{ true: color.primary, false: color.border }}
                thumbColor="#FFFFFF"
              />
            </Pressable>
          );
        })}
      </View>

      <PromotionFormModal visible={open} promo={editing} onClose={() => setOpen(false)} />
    </Card>
  );
}
