import { Pressable, Text } from "react-native";
import { color, radius, spacing } from "@/constants/theme";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/** Pilihan kecil (satu baris). Beda dengan Button yang tingginya minimal 48. */
export function Chip({ label, active, onPress, disabled }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: active ? color.primary : color.surface,
        borderWidth: 1,
        borderColor: active ? color.primary : color.borderStrong,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: active ? color.textOnPrimary : color.textSecondary }}>{label}</Text>
    </Pressable>
  );
}
