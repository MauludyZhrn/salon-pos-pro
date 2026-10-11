import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text, ActivityIndicator } from "react-native";
import { getDb } from "@/services/database";
import { seedIfEmpty } from "@/services/seed";
import { startSyncListener } from "@/services/syncQueue";
import { useAuthStore } from "@/store/authStore";
import { color } from "@/constants/theme";
import "../global.css";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    (async () => {
      await getDb();
      await seedIfEmpty();
      await restoreSession();
      const unsubscribe = startSyncListener();
      setReady(true);
      return unsubscribe;
    })();
  }, [restoreSession]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={color.primary} />
        <Text style={{ color: color.textMuted, marginTop: 12 }}>Menyiapkan database lokal...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
