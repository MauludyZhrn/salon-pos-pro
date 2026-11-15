import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native";
import { color, radius, spacing } from "@/constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const sizeMap: Record<Size, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, fontSize: 13 },
  md: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: 15 },
  lg: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontSize: 16 },
};

const variantMap: Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: color.primary, bgPressed: "#DB6C93", fg: color.textOnPrimary },
  secondary: { bg: color.surface, bgPressed: color.surfaceAlt, fg: color.textPrimary, border: color.borderStrong },
  ghost: { bg: "transparent", bgPressed: color.surfaceAlt, fg: color.textSecondary },
  danger: { bg: color.danger, bgPressed: "#9C2A3B", fg: color.dangerOn },
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading,
  fullWidth,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const sz = sizeMap[size];
  const v = variantMap[variant];

  return (
    <Pressable
      disabled={disabled || loading}
      hitSlop={8}
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? v.bgPressed : v.bg,
          borderColor: v.border,
          borderWidth: v.border ? 1 : 0,
          borderRadius: radius.lg,
          paddingVertical: sz.paddingVertical,
          paddingHorizontal: sz.paddingHorizontal,
          opacity: disabled ? 0.45 : 1,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: spacing.xs,
          width: fullWidth ? "100%" : undefined,
          alignSelf: "stretch",
          minHeight: 48,
        },
        typeof style === "function" ? undefined : style,
      ]}
      {...rest}
    >
      {loading && <ActivityIndicator size="small" color={v.fg} />}
      <Text style={{ color: v.fg, fontSize: sz.fontSize, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
