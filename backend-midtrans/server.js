/**
 * Minimal Midtrans backend for Salon POS Pro.
 * Holds the Server Key — never ship it inside the RN app.
 * Matches the contract src/services/midtransService.ts expects:
 *   POST /midtrans/charge  { orderId, grossAmount, channel, customerName } -> MidtransChargeResponse
 *   GET  /midtrans/status?order_id=... -> { status }
 *   POST /midtrans/notification  (Midtrans webhook, configure in Midtrans dashboard)
 *
 * Run: npm install && cp .env.example .env (fill real keys) && npm start
 */

require("dotenv").config();
const express = require("express");
const midtransClient = require("midtrans-client");

const app = express();
app.use(express.json());

const APP_SHARED_KEY = process.env.APP_SHARED_KEY;

const core = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

function requireAppKey(req, res, next) {
  if (req.header("X-App-Key") !== APP_SHARED_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// In-memory status cache; swap for a real DB/table keyed by orderId in production.
const statusCache = new Map();

app.post("/midtrans/charge", requireAppKey, async (req, res) => {
  const { orderId, grossAmount, channel, customerName } = req.body;
  if (!orderId || !grossAmount || !channel) {
    return res.status(400).json({ error: "orderId, grossAmount, channel wajib diisi" });
  }

  try {
    const base = {
      payment_type: channelToMidtransType(channel),
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      customer_details: customerName ? { first_name: customerName } : undefined,
    };

    let payload = base;
    if (channel === "qris") {
      payload = { ...base, qris: { acquirer: "gopay" } };
    } else if (channel === "bank_transfer") {
      payload = { ...base, bank_transfer: { bank: "bca" } };
    } else if (channel === "credit_card") {
      // Credit card normally goes through Snap (hosted page) for 3DS; Core API
      // charge here assumes a card token from the client's Snap.js flow.
      payload = { ...base, credit_card: { secure: true, token_id: req.body.cardToken } };
    }

    const chargeResponse = await core.charge(payload);
    statusCache.set(orderId, chargeResponse.transaction_status);

    res.json({
      orderId,
      transactionId: chargeResponse.transaction_id,
      status: normalizeStatus(chargeResponse.transaction_status),
      qrString: chargeResponse.actions?.find((a) => a.name === "generate-qr-code")?.url ?? chargeResponse.qr_string,
      vaNumber: chargeResponse.va_numbers?.[0]?.va_number,
      redirectUrl: chargeResponse.redirect_url,
    });
  } catch (err) {
    console.error("Midtrans charge error:", err.message);
    res.status(502).json({ error: "Midtrans charge failed", detail: err.message });
  }
});

app.get("/midtrans/status", requireAppKey, async (req, res) => {
  const orderId = req.query.order_id;
  if (!orderId) return res.status(400).json({ error: "order_id wajib diisi" });

  try {
    const statusResponse = await core.transaction.status(orderId);
    statusCache.set(orderId, statusResponse.transaction_status);
    res.json({ status: normalizeStatus(statusResponse.transaction_status) });
  } catch (err) {
    // Not found yet (still pending creation) — report pending rather than error.
    res.json({ status: statusCache.get(orderId) ?? "pending" });
  }
});

// Configure this URL in Midtrans Dashboard > Settings > Configuration > Notification URL.
app.post("/midtrans/notification", async (req, res) => {
  try {
    const statusResponse = await core.transaction.notification(req.body);
    statusCache.set(statusResponse.order_id, statusResponse.transaction_status);
    console.log(`Webhook: ${statusResponse.order_id} -> ${statusResponse.transaction_status}`);
    res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(400).send("invalid notification");
  }
});

function channelToMidtransType(channel) {
  if (channel === "qris") return "qris";
  if (channel === "bank_transfer") return "bank_transfer";
  if (channel === "credit_card") return "credit_card";
  throw new Error(`Unknown channel: ${channel}`);
}

function normalizeStatus(midtransStatus) {
  if (midtransStatus === "settlement" || midtransStatus === "capture") return "settlement";
  if (midtransStatus === "pending") return "pending";
  if (midtransStatus === "deny") return "deny";
  if (midtransStatus === "expire") return "expire";
  if (midtransStatus === "cancel") return "cancel";
  return "pending";
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Midtrans backend listening on :${PORT}`));
