import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text, ActivityIndicator } from "react-native";
import { getDb } from "@/services/database";
import { seedIfEmpty } from "@/services/seed";
import { startSyncListener } from "@/services/syncQueue";
import { startCloudSync } from "@/services/cloudSync";
import { useAuthStore } from "@/store/authStore";
import { usePromoStore } from "@/store/promoStore";
import { useMemberStore } from "@/store/memberStore";
import { useCloud } from "@/services/cloudSync";
import { color } from "@/constants/theme";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const syncVersion = useCloud((c) => c.version);

  // Promo dan member dari HP lain ikut masuk saat sinkron cloud menarik data baru.
  useEffect(() => {
    if (ready) {
      usePromoStore.getState().load();
      useMemberStore.getState().load();
    }
  }, [ready, syncVersion]);

  useEffect(() => {
    (async () => {
      await getDb();
      await seedIfEmpty();
      await restoreSession();
      await usePromoStore.getState().load();
      await useMemberStore.getState().load();
      const unsubscribe = startSyncListener();
      startCloudSync();
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
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="membership" />
          <Stack.Screen name="finance" />
          <Stack.Screen name="services" />
          <Stack.Screen name="printer" />
          <Stack.Screen name="inventory" />
          <Stack.Screen name="employees" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="history" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
