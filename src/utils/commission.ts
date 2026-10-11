import { applyBps, addMoney, type Rupiah, assertRupiah } from "./money";

export type CommissionBasis = "percent" | "fixed" | "none";

export interface CommissionInput {
  /** Line total (after line-level discount) the commission is computed against. */
  lineTotal: Rupiah;
  basis: CommissionBasis;
  /** bps if basis === 'percent' (e.g. 3000 = 30%); Rupiah if basis === 'fixed'; ignored if 'none'. */
  value: number;
  qty: number;
}

/**
 * Computes stylist commission for a single transaction line.
 * - percent: bps of lineTotal, rounded half-up.
 * - fixed: flat Rupiah PER UNIT sold (qty multiplier), not per line.
 * - none: 0.
 */
export function calcLineCommission(input: CommissionInput): Rupiah {
  const { lineTotal, basis, value, qty } = input;
  assertRupiah(lineTotal, "lineTotal");

  switch (basis) {
    case "none":
      return 0;
    case "percent":
      return applyBps(lineTotal, value);
    case "fixed": {
      assertRupiah(value, "fixed commission value");
      if (!Number.isInteger(qty) || qty < 0) throw new Error(`qty must be non-negative integer, got ${qty}`);
      return value * qty;
    }
    default: {
      const exhaustive: never = basis;
      throw new Error(`Unknown commission basis: ${exhaustive}`);
    }
  }
}

export interface StylistCommissionSummary {
  stylistId: string;
  totalCommission: Rupiah;
  lineCount: number;
}

/** Aggregates per-line commissions into a per-stylist summary for a shift/day close. */
export function summarizeCommissionsByStylist(
  lines: { stylistId: string | null; commissionAmount: Rupiah }[]
): StylistCommissionSummary[] {
  const map = new Map<string, { total: Rupiah; count: number }>();
  for (const line of lines) {
    if (!line.stylistId) continue;
    const existing = map.get(line.stylistId) ?? { total: 0, count: 0 };
    map.set(line.stylistId, {
      total: addMoney(existing.total, line.commissionAmount),
      count: existing.count + 1,
    });
  }
  return Array.from(map.entries()).map(([stylistId, v]) => ({
    stylistId,
    totalCommission: v.total,
    lineCount: v.count,
  }));
}
