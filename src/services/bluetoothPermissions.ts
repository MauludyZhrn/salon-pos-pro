import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";

/**
 * Android 12+ needs BLUETOOTH_SCAN and BLUETOOTH_CONNECT granted at runtime.
 * Declaring them in app.json is not enough. Android 11 and below needs location.
 */
export async function ensureBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (Number(Platform.Version) >= 31) {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export function askBluetoothDenied() {
  Alert.alert(
    "Izin Bluetooth ditolak",
    "Izinkan \"Perangkat sekitar\" (Nearby devices) untuk app ini, lalu coba lagi.",
    [
      { text: "Batal", style: "cancel" },
      { text: "Buka pengaturan", onPress: () => Linking.openSettings() },
    ]
  );
}
