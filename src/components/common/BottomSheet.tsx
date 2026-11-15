import type { ReactNode } from "react";
import { Modal, View, Pressable, KeyboardAvoidingView } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { color, spacing } from "@/constants/theme";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Bottom sheet that keeps its buttons above the Android navigation bar.
 * A SafeAreaProvider inside the Modal gives correct insets even though a
 * Modal renders in its own window.
 */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaProvider>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: color.scrim, justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Tutup" />
          <Sheet>{children}</Sheet>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: color.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.lg + insets.bottom,
        maxHeight: "92%",
      }}
    >
      <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: color.border, marginBottom: spacing.md }} />
      {children}
    </View>
  );
}
