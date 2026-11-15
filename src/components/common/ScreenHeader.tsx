import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/common/Icon";
import { color, font, spacing } from "@/constants/theme";

interface ScreenHeaderProps {
  title: string;
  right?: ReactNode;
  showBack?: boolean;
}

/** Back chevron left, centered serif title, optional action right. Used by every pushed screen. */
export function ScreenHeader({ title, right, showBack = true }: ScreenHeaderProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: spacing.md }}>
      <View style={{ width: 48, alignItems: "flex-start" }}>
        {showBack && (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more"))}
            hitSlop={10}
            accessibilityLabel="Kembali"
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: color.surface, borderWidth: 1, borderColor: color.border }}
          >
            <Icon name="chevronLeft" color={color.textPrimary} size={20} />
          </Pressable>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={{ flex: 1, textAlign: "center", fontFamily: font.display, fontSize: 20, fontWeight: "600", color: color.textPrimary }}
      >
        {title}
      </Text>
      <View style={{ width: 48, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
