import type { ReactNode } from "react";
import { Modal, View, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { color, spacing } from "@/constants/theme";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Bottom sheet that keeps its buttons above the Android navigation bar and
 * scales cleanly across small phones, landscape phones, and tablets.
 * A SafeAreaProvider inside the Modal gives correct insets even though a
 * Modal renders in its own window.
 */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      supportedOrientations={["portrait", "landscape", "landscape-left", "landscape-right"]}
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: color.scrim, justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Tutup" />
          <Sheet>{children}</Sheet>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height, isSmallPhone, isCompactHeight, sheetMaxWidth } = useResponsiveLayout();
  const maxSheetHeight = Math.max(240, height - Math.max(insets.top, 12) - 8);
  const horizontalPad = isSmallPhone ? spacing.md : spacing.lg;

  return (
    <View
      style={{
        width: "100%",
        maxWidth: sheetMaxWidth,
        alignSelf: "center",
        backgroundColor: color.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: horizontalPad + Math.max(insets.left, insets.right) * 0.5,
        paddingTop: spacing.sm,
        paddingBottom: (isCompactHeight ? spacing.sm : spacing.md) + Math.max(insets.bottom, spacing.xs),
        maxHeight: maxSheetHeight,
      }}
    >
      <View
        style={{
          alignSelf: "center",
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: color.border,
          marginBottom: isCompactHeight ? spacing.xs : spacing.md,
        }}
      />
      {children}
    </View>
  );
}
