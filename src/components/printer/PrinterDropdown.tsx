import { useEffect, useMemo, useState } from "react";
import { View, Text, Alert } from "react-native";
import { Dropdown } from "@/components/common/Dropdown";
import { Button } from "@/components/common/Button";
import { color, spacing } from "@/constants/theme";
import { scanPrinters, connectPrinter, type PairedPrinter } from "@/services/printerService";
import { loadSelectedPrinter, saveSelectedPrinter } from "@/services/printerPrefs";
import { ensureBluetoothPermission, askBluetoothDenied } from "@/services/bluetoothPermissions";

interface PrinterDropdownProps {
  /** Fires once with the saved printer on mount, and again after every change. */
  onChange?: (printer: PairedPrinter | null) => void;
}

/** Pick the thermal printer from a dropdown. Choice is saved on the device. */
export function PrinterDropdown({ onChange }: PrinterDropdownProps) {
  const [printers, setPrinters] = useState<PairedPrinter[]>([]);
  const [selected, setSelected] = useState<PairedPrinter | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await loadSelectedPrinter();
      setSelected(saved);
      onChange?.(saved);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => {
    const list = selected && !printers.some((p) => p.address === selected.address) ? [selected, ...printers] : printers;
    return list.map((p) => ({ value: p.address, label: p.name, hint: p.address }));
  }, [printers, selected]);

  async function scan() {
    setScanning(true);
    setStatus(null);
    try {
      if (!(await ensureBluetoothPermission())) return askBluetoothDenied();
      const found = await scanPrinters();
      setPrinters(found);
      if (found.length === 0) setStatus("Tidak ada printer. Nyalakan printer dan pasangkan dulu lewat Bluetooth HP.");
    } catch {
      Alert.alert("Bluetooth tidak tersedia", "Aktifkan Bluetooth lalu coba lagi.");
    } finally {
      setScanning(false);
    }
  }

  async function choose(address: string) {
    const p = printers.find((x) => x.address === address) ?? (selected?.address === address ? selected : null);
    if (!p) return;
    setConnecting(true);
    setStatus(null);
    try {
      if (!(await ensureBluetoothPermission())) return askBluetoothDenied();
      await connectPrinter(p.address);
      await saveSelectedPrinter(p);
      setSelected(p);
      onChange?.(p);
      setStatus(`Terhubung ke ${p.name}`);
    } catch {
      setStatus("Gagal terhubung. Nyalakan printer lalu coba lagi.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <View style={{ gap: spacing.xs }}>
      {options.length > 0 ? (
        <Dropdown<string>
          value={selected?.address ?? ""}
          options={options}
          onChange={choose}
          disabled={connecting}
        />
      ) : (
        <Text style={{ color: color.textMuted, fontSize: 12 }}>Belum ada printer. Ketuk "Cari printer".</Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Button label="Cari printer" size="sm" variant="secondary" loading={scanning} onPress={scan} />
        {selected && <Text style={{ color: color.textSecondary, fontSize: 12, flexShrink: 1 }}>Dipilih: {selected.name}</Text>}
      </View>
      {status && <Text style={{ color: color.textMuted, fontSize: 12 }}>{status}</Text>}
    </View>
  );
}
