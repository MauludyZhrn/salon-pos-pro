/**
 * Precision money utilities.
 *
 * Rule: ALL monetary values in this app are integers denominated in whole
 * Rupiah (IDR has no sub-unit in everyday use). Never store or compute
 * money as `number` with decimals — floating point cannot represent
 * base-10 fractions exactly (0.1 + 0.2 !== 0.3), which compounds into
 * real accounting drift over thousands of transactions.
 *
 * For percentage math (discounts, tax, commission) we work in basis
 * points (1/100 of a percent, i.e. 10000 bps = 100%) using BigInt
 * intermediates, then round to the nearest Rupiah with banker's-safe
 * round-half-up (standard for retail receipts).
 */

export type Rupiah = number; // integer, no decimals, always >= 0 unless explicitly signed

const BPS_SCALE = 10_000n; // 100.00% == 10000 bps

/** Throws if value is not a safe non-negative integer. Call at every boundary (input, DB read). */
export function assertRupiah(value: number, label = "amount"): asserts value is Rupiah {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer Rupiah value, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds safe integer range: ${value}`);
  }
}

export function addMoney(...values: Rupiah[]): Rupiah {
  let total = 0n;
  for (const v of values) {
    assertRupiah(v);
    total += BigInt(v);
  }
  return Number(total);
}

export function subtractMoney(a: Rupiah, b: Rupiah): Rupiah {
  assertRupiah(a);
  assertRupiah(b);
  return Number(BigInt(a) - BigInt(b));
}

export function multiplyMoneyByQty(unitPrice: Rupiah, qty: number): Rupiah {
  assertRupiah(unitPrice);
  if (!Number.isInteger(qty) || qty < 0) throw new Error(`qty must be a non-negative integer, got ${qty}`);
  return Number(BigInt(unitPrice) * BigInt(qty));
}

/** Round-half-up to nearest integer Rupiah, done on a BigInt-scaled numerator/denominator pair. */
function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const q = n / denominator;
  const r = n % denominator;
  const rounded = r * 2n >= denominator ? q + 1n : q;
  return negative ? -rounded : rounded;
}

/** amount * bps / 10000, rounded half-up to the nearest Rupiah. */
export function applyBps(amount: Rupiah, bps: number): Rupiah {
  assertRupiah(amount);
  if (!Number.isInteger(bps)) throw new Error(`bps must be an integer, got ${bps}`);
  const result = roundHalfUp(BigInt(amount) * BigInt(bps), BPS_SCALE);
  return Number(result);
}

/** Convert a human percent (e.g. 11 for 11%) to bps (11 -> 1100). Supports 2 decimal places (e.g. 11.5 -> 1150). */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export interface TaxResult {
  subtotal: Rupiah;
  discountTotal: Rupiah;
  taxableBase: Rupiah;
  taxTotal: Rupiah;
  grandTotal: Rupiah;
}

/**
 * Standard Indonesian retail tax calc: discount applied first, PPN
 * applied to the post-discount base. Tax rate in bps (PPN 11% -> 1100).
 */
export function calcTax(subtotal: Rupiah, discountTotal: Rupiah, taxRateBps: number): TaxResult {
  assertRupiah(subtotal);
  assertRupiah(discountTotal);
  if (discountTotal > subtotal) throw new Error("discountTotal cannot exceed subtotal");

  const taxableBase = subtractMoney(subtotal, discountTotal);
  const taxTotal = applyBps(taxableBase, taxRateBps);
  const grandTotal = addMoney(taxableBase, taxTotal);

  return { subtotal, discountTotal, taxableBase, taxTotal, grandTotal };
}

export interface SplitPaymentLeg {
  method: "cash" | "midtrans_qris" | "midtrans_cc" | "midtrans_va";
  amount: Rupiah;
}

/**
 * Validates a split payment breakdown sums exactly to grandTotal.
 * Does NOT auto-allocate — the cashier enters each leg explicitly on
 * screen; this is the integrity check run before a transaction is
 * allowed to settle.
 */
export function validateSplitPayment(legs: SplitPaymentLeg[], grandTotal: Rupiah): void {
  if (legs.length === 0) throw new Error("Split payment requires at least one leg");
  const sum = addMoney(...legs.map((l) => l.amount));
  if (sum !== grandTotal) {
    throw new Error(`Split payment legs sum to ${sum}, expected ${grandTotal}`);
  }
  for (const leg of legs) {
    if (leg.amount <= 0) throw new Error(`Split leg for ${leg.method} must be positive`);
  }
}

/** Format integer Rupiah for display: "Rp 125.000" */
export function formatRupiah(value: Rupiah): string {
  assertRupiah(value);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}Rp ${grouped}`;
}
