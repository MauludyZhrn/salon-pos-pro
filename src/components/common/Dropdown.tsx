import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { color, radius, spacing } from "@/constants/theme";
import { Icon } from "@/components/common/Icon";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** Inline dropdown: the option list expands under the field, so it works inside a bottom sheet without a nested Modal. */
export function Dropdown<T extends string>({ value, options, onChange, disabled }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View>
      <Pressable
        onPress={() => !disabled && setOpen((o) => !o)}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: color.surfaceAlt,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: open ? color.primary : color.border,
          paddingHorizontal: spacing.sm,
          paddingVertical: 11,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Text style={{ color: color.textPrimary, fontSize: 14 }}>{current?.label ?? "Pilih"}</Text>
        <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}>
          <Icon name="chevronRight" color={color.textMuted} size={16} />
        </View>
      </Pressable>

      {open && (
        <View
          style={{
            marginTop: spacing.xxs,
            backgroundColor: color.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: color.border,
            overflow: "hidden",
          }}
        >
          {options.map((o, i) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 10,
                  backgroundColor: active ? color.primarySoft : color.surface,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: color.border,
                }}
              >
                <Text style={{ color: color.textPrimary, fontSize: 14, fontWeight: active ? "700" : "500" }}>{o.label}</Text>
                {o.hint && <Text style={{ color: color.textSecondary, fontSize: 11, marginTop: 1 }}>{o.hint}</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
