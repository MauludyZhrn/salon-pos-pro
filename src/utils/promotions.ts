import { applyBps, type Rupiah } from "./money";
import type { AdjustmentRule, CatalogItem, LineAdjustment, PromoKind, Promotion } from "@/types";

/** Aturan promo, murni logika (tanpa database / UI), supaya mudah diuji. */

export const KIND_LABEL: Record<PromoKind, string> = {
  discount: "Diskon",
  promo: "Promo",
  additional: "Biaya tambahan",
};

/** yyyy-mm-dd menurut jam lokal HP (bukan UTC), supaya tanggal promo cocok dengan hari kasir. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isValidDateString(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Promo berlaku bila aktif dan tanggal hari ini ada di dalam periode (batas kosong = tanpa batas). */
export function isPromoLive(p: Promotion, now: Date = new Date()): boolean {
  if (!p.active) return false;
  const today = localDateString(now);
  if (p.startDate && today < p.startDate) return false;
  if (p.endDate && today > p.endDate) return false;
  return true;
}

export type PromoStatus = "live" | "inactive" | "upcoming" | "expired";

export function promoStatus(p: Promotion, now: Date = new Date()): PromoStatus {
  if (!p.active) return "inactive";
  const today = localDateString(now);
  if (p.startDate && today < p.startDate) return "upcoming";
  if (p.endDate && today > p.endDate) return "expired";
  return "live";
}

/** Geser tanggal yyyy-mm-dd sebanyak n hari (jam lokal). */
export function addDaysToDateString(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return localDateString(new Date(y, m - 1, d + n));
}

export function promoAppliesTo(p: Promotion, item: Pick<CatalogItem, "id" | "type">): boolean {
  switch (p.scope) {
    case "all":
      return true;
    case "service":
      return item.type === "service";
    case "retail":
      return item.type === "retail";
    case "items":
      return p.itemIds.includes(item.id);
  }
}

/** Aturan yang sedang berlaku untuk satu item, siap disalin ke baris keranjang. */
export function rulesForItem(item: Pick<CatalogItem, "id" | "type">, promos: Promotion[], now: Date = new Date()): AdjustmentRule[] {
  return promos
    .filter((p) => isPromoLive(p, now) && promoAppliesTo(p, item))
    .map((p) => ({ promoId: p.id, name: p.name, kind: p.kind, valueType: p.valueType, value: p.value }));
}

function ruleAmount(rule: AdjustmentRule, gross: Rupiah, qty: number): Rupiah {
  switch (rule.valueType) {
    case "percent":
      return applyBps(gross, rule.value);
    case "fixed":
      return rule.value * qty;
    case "flat":
      return rule.value;
  }
}

export interface EvaluatedRules {
  adjustments: LineAdjustment[];
  discount: Rupiah;
  extra: Rupiah;
}

/**
 * Menghitung diskon dan biaya tambahan satu baris.
 * - percent: persen dari harga x qty. fixed: nominal per unit x qty. flat: nominal total baris.
 * - Potongan (discount + promo) ditumpuk tapi tidak boleh melebihi harga x qty.
 */
export function evaluateRules(unitPrice: Rupiah, qty: number, rules: AdjustmentRule[]): EvaluatedRules {
  const gross = unitPrice * qty;
  const adjustments: LineAdjustment[] = [];
  let discount = 0;
  let extra = 0;

  for (const rule of rules) {
    const raw = Math.max(0, ruleAmount(rule, gross, qty));
    if (rule.kind === "additional") {
      if (raw === 0) continue;
      extra += raw;
      adjustments.push({ ...rule, amount: raw });
    } else {
      const amount = Math.min(raw, gross - discount);
      if (amount <= 0) continue;
      discount += amount;
      adjustments.push({ ...rule, amount });
    }
  }
  return { adjustments, discount, extra };
}

/** Ringkasan singkat nilai aturan untuk label: "10%", "Rp 5.000/unit". */
export function describeValue(valueType: "percent" | "fixed" | "flat", value: number): string {
  if (valueType === "percent") {
    const pct = value / 100;
    return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%`;
  }
  const grouped = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return valueType === "fixed" ? `Rp ${grouped}/unit` : `Rp ${grouped}`;
}

/** Label pendek untuk lencana di kartu produk: "PROMO -10%", "DISKON -Rp 5.000", "+ BIAYA". */
export function badgeFor(rules: AdjustmentRule[], unitPrice: Rupiah): { text: string; tone: "discount" | "extra" } | null {
  if (rules.length === 0) return null;
  const ev = evaluateRules(unitPrice, 1, rules);
  const promo = ev.adjustments.find((a) => a.kind === "promo") ?? ev.adjustments.find((a) => a.kind === "discount");
  if (promo) {
    const label = promo.kind === "promo" ? "PROMO" : "DISKON";
    const val = promo.valueType === "percent" ? describeValue("percent", promo.value) : `Rp ${String(promo.amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
    return { text: `${label} -${val}`, tone: "discount" };
  }
  const add = ev.adjustments.find((a) => a.kind === "additional");
  if (add) return { text: `+ ${add.name}`, tone: "extra" };
  return null;
}
