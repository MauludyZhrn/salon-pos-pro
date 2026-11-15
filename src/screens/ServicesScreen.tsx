import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Card } from "@/components/common/Card";
import { ScreenHeader } from "@/components/common/ScreenHeader";
import { Icon } from "@/components/common/Icon";
import { Button } from "@/components/common/Button";
import { ServiceFormModal } from "@/components/catalog/ServiceFormModal";
import { color, spacing } from "@/constants/theme";
import { formatRupiah } from "@/utils/money";
import { useCatalog } from "@/hooks/useCatalog";
import type { CatalogItem } from "@/types";

const pretty = (c: string) => c.replace(/-/g, " ").replace(/^./, (m) => m.toUpperCase());

function commissionLabel(s: CatalogItem): string {
  if (s.commissionBasis === "percent") return `Komisi ${s.commissionValue / 100}%`;
  if (s.commissionBasis === "fixed") return `Komisi ${formatRupiah(s.commissionValue)}`;
  return "Tanpa komisi";
}

/** Manage the service menu: add, edit and delete what the Kasir sells. */
export function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const { items, reload } = useCatalog();
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const services = useMemo(
    () => items.filter((i) => i.type === "service").sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [items]
  );
  const categories = useMemo(() => Array.from(new Set(services.map((s) => s.category))), [services]);

  function openForm(service: CatalogItem | null) {
    setEditing(service);
    setFormOpen(true);
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenHeader
        title="Layanan"
        right={
          <Pressable
            onPress={() => openForm(null)}
            accessibilityLabel="Tambah layanan"
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.primary }}
          >
            <Icon name="plus" color={color.textOnPrimary} size={20} />
          </Pressable>
        }
      />
      <FlatList
        data={services}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md + insets.bottom, gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={{ color: color.textMuted, textAlign: "center", marginTop: spacing.lg }}>Belum ada layanan. Ketuk tombol + di kanan atas.</Text>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: color.textPrimary, fontSize: 15, fontWeight: "600" }}>{item.name}</Text>
                <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2 }}>
                  {pretty(item.category)} · {item.durationMinutes ?? 30} menit · {commissionLabel(item)}
                  {item.consumes?.length ? ` · ${item.consumes.length} bahan` : ""}
                </Text>
                <Text style={{ color: color.primaryDeep, fontSize: 14, fontWeight: "700", marginTop: 4 }}>{formatRupiah(item.price)}</Text>
              </View>
              <Button label="Edit" size="sm" variant="secondary" onPress={() => openForm(item)} />
            </View>
          </Card>
        )}
      />

      <ServiceFormModal visible={formOpen} service={editing} categories={categories} onClose={() => setFormOpen(false)} onSaved={reload} />
    </SafeAreaView>
  );
}
