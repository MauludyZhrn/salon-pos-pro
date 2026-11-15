import { useEffect, useState } from "react";
import { DEFAULT_RECEIPT, loadReceiptConfig, type ReceiptConfig } from "@/services/receiptConfig";

/** Current receipt settings. Pass a changing value (e.g. visibility) to reload after the user edits them. */
export function useReceiptConfig(reloadKey?: unknown): ReceiptConfig {
  const [cfg, setCfg] = useState<ReceiptConfig>(DEFAULT_RECEIPT);
  useEffect(() => {
    loadReceiptConfig().then(setCfg);
  }, [reloadKey]);
  return cfg;
}
