import { useState } from "react";
import { View, TextInput, Alert } from "react-native";
import { Button } from "@/components/common/Button";
import { color, radius, spacing } from "@/constants/theme";
import { cloudLogin } from "@/services/cloudSync";

/** Email + password of the outlet's cloud account (created once in Supabase > Authentication). */
export function CloudLoginForm({ onDone, label = "Masuk ke cloud" }: { onDone?: () => void; label?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return Alert.alert("Isi email dan password");
    setBusy(true);
    try {
      await cloudLogin(email, password);
      onDone?.();
    } catch (e) {
      Alert.alert("Gagal masuk cloud", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email akun outlet"
        placeholderTextColor={color.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
        style={input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={color.textMuted}
        autoCapitalize="none"
        secureTextEntry
        style={input}
      />
      <Button label={label} loading={busy} onPress={submit} />
    </View>
  );
}

const input = {
  backgroundColor: color.surfaceAlt,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: color.border,
  color: color.textPrimary,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  fontSize: 14,
} as const;
