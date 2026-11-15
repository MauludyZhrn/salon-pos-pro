import { Pressable, Text } from "react-native";
import { color, radius, spacing } from "@/constants/theme";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/** Pilihan kecil (satu baris) dengan target sentuh nyaman untuk kasir. */
export function Chip({ label, active, onPress, disabled }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 38,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: active ? color.primary : pressed ? color.surfaceAlt : color.surface,
        borderWidth: 1,
        borderColor: active ? color.primary : color.borderStrong,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: active ? color.textOnPrimary : color.textSecondary }}>{label}</Text>
    </Pressable>
  );
}
