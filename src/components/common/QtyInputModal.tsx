import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Button } from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { color, font, radius, spacing } from "@/constants/theme";

interface QtyInputModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  initial: number;
  /** Teks tombol simpan, mis. "Tambah" atau "Simpan". */
  confirmLabel?: string;
  /** Batas bawah; 1 untuk jumlah pesanan. */
  min?: number;
  max?: number;
  onClose: () => void;
  onConfirm: (qty: number) => void;
}

const digits = (v: string) => v.replace(/\D/g, "");

/** Ketik jumlah langsung (atau pakai tombol - / +). Dipakai di keranjang dan di grid produk. */
export function QtyInputModal({ visible, title, subtitle, initial, confirmLabel = "Simpan", min = 1, max = 999, onClose, onConfirm }: QtyInputModalProps) {
  const [text, setText] = useState(String(initial));

  useEffect(() => {
    if (visible) setText(String(initial));
  }, [visible, initial]);

  const value = Number(digits(text)) || 0;
  const valid = value >= min && value <= max;

  function step(delta: number) {
    const next = Math.min(max, Math.max(min, (Number(digits(text)) || 0) + delta));
    setText(String(next));
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 20, fontWeight: "600" }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={{ color: color.textMuted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text> : null}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md, marginVertical: spacing.lg }}>
          <Pressable
            onPress={() => step(-1)}
            hitSlop={8}
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color.surfaceAlt, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="minus" color={color.textPrimary} size={22} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={(v) => setText(digits(v).slice(0, 3))}
            keyboardType="number-pad"
            selectTextOnFocus
            autoFocus
            maxLength={3}
            style={{
              minWidth: 110,
              textAlign: "center",
              fontSize: 34,
              fontWeight: "700",
              color: color.textPrimary,
              backgroundColor: color.surfaceAlt,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: valid ? color.border : color.danger,
              paddingVertical: spacing.xs,
            }}
          />
          <Pressable
            onPress={() => step(1)}
            hitSlop={8}
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="plus" color={color.textOnPrimary} size={22} />
          </Pressable>
        </View>
        {!valid && (
          <Text style={{ color: color.danger, fontSize: 12, textAlign: "center", marginTop: -spacing.xs, marginBottom: spacing.sm }}>
            Jumlah harus {min}–{max}
          </Text>
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button label="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label={confirmLabel} disabled={!valid} onPress={() => onConfirm(value)} style={{ flex: 2 }} />
        </View>
      </View>
    </BottomSheet>
  );
}
