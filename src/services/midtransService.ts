/**
 * Midtrans gateway integration. The RN app NEVER holds the Server Key —
 * it calls your own backend (or an Apps Script doPost endpoint) which
 * creates the Snap/Core API transaction server-side and returns a token
 * or QR string. This file is the client-side contract + webhook-status
 * poller; swap `CHARGE_ENDPOINT` for your deployed backend route.
 *
 * Security note: Midtrans Server Key must live in a backend secret store
 * (Apps Script Script Properties, or a small serverless function), never
 * bundled into the mobile app.
 */

import type { PaymentLeg, Transaction } from "@/types";
import type { Rupiah } from "@/utils/money";

const CHARGE_ENDPOINT = "https://your-backend.example.com/midtrans/charge";
const STATUS_ENDPOINT = "https://your-backend.example.com/midtrans/status";
// Must match APP_SHARED_KEY in backend-midtrans/.env — move to Settings/secure storage in production.
const APP_SHARED_KEY = "replace-with-a-long-random-secret";

export type MidtransChannel = "qris" | "credit_card" | "bank_transfer";

export interface MidtransChargeRequest {
  orderId: string;
  grossAmount: Rupiah;
  channel: MidtransChannel;
  customerName?: string | null;
}

export interface MidtransChargeResponse {
  orderId: string;
  transactionId: string;
  status: "pending" | "settlement" | "deny" | "expire" | "cancel";
  /** QRIS payload or deeplink to render as QR code for channel === 'qris'. */
  qrString?: string;
  /** VA number for channel === 'bank_transfer'. */
  vaNumber?: string;
  /** 3DS redirect URL for channel === 'credit_card'. */
  redirectUrl?: string;
}

export async function createMidtransCharge(req: MidtransChargeRequest): Promise<MidtransChargeResponse> {
  const res = await fetch(CHARGE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": APP_SHARED_KEY },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Midtrans charge failed: HTTP ${res.status}`);
  return res.json();
}

export async function pollMidtransStatus(orderId: string): Promise<MidtransChargeResponse["status"]> {
  const res = await fetch(`${STATUS_ENDPOINT}?order_id=${encodeURIComponent(orderId)}`, {
    headers: { "X-App-Key": APP_SHARED_KEY },
  });
  if (!res.ok) throw new Error(`Midtrans status check failed: HTTP ${res.status}`);
  const json = await res.json();
  return json.status;
}

/**
 * Polls until a terminal status or timeout. Used by the Payment screen
 * while showing the QRIS code / VA number to the customer.
 */
export async function awaitMidtransSettlement(
  orderId: string,
  { intervalMs = 3000, timeoutMs = 5 * 60_000 } = {}
): Promise<MidtransChargeResponse["status"]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await pollMidtransStatus(orderId);
    if (status === "settlement" || status === "deny" || status === "expire" || status === "cancel") {
      return status;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return "expire";
}

export function midtransOrderIdFor(receiptNo: string): string {
  return `SALON-${receiptNo}`;
}

/** Builds the paymentBreakdown leg for a settled Midtrans charge, for posStore.checkout(). */
export function legFromMidtrans(method: Exclude<PaymentLeg["method"], "cash">, amount: Rupiah): PaymentLeg {
  return { method, amount };
}

export type { Transaction };
