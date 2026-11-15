import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/common/Icon";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, font } from "@/constants/theme";

interface ScreenHeaderProps {
  title: string;
  right?: ReactNode;
  showBack?: boolean;
}

/** Back chevron left, centered serif title, optional action right. Used by every pushed screen. */
export function ScreenHeader({ title, right, showBack = true }: ScreenHeaderProps) {
  const { isCompactHeight, pagePadding } = useResponsiveLayout();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: isCompactHeight ? 48 : 56,
        paddingHorizontal: pagePadding,
      }}
    >
      <View style={{ width: 48, alignItems: "flex-start" }}>
        {showBack && (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more"))}
            hitSlop={8}
            accessibilityLabel="Kembali"
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? color.surfaceAlt : color.surface,
              borderWidth: 1,
              borderColor: color.border,
            })}
          >
            <Icon name="chevronLeft" color={color.textPrimary} size={20} />
          </Pressable>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          textAlign: "center",
          fontFamily: font.display,
          fontSize: isCompactHeight ? 18 : 20,
          fontWeight: "600",
          color: color.textPrimary,
        }}
      >
        {title}
      </Text>
      <View style={{ width: 48, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
