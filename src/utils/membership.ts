import type { Rupiah } from "./money";
import type { AdjustmentRule, CartLine } from "@/types";

/**
 * Sistem Poin & Gratis Treatment Member:
 * - 1x treatment (layanan / service) = 10 poin
 * - 10x treatment = 100 poin = Gratis 1x treatment
 */
export const POINTS_PER_TREATMENT = 10;
export const TREATMENTS_PER_REWARD = 10;
export const FREE_TREATMENT_POINTS = POINTS_PER_TREATMENT * TREATMENTS_PER_REWARD; // 100 poin
export const MEMBER_FREE_PROMO_ID = "member-free-treatment";

/** Hitung total unit layanan (treatment) yang ada di keranjang. Produk retail tidak dihitung sebagai treatment. */
export function countCartTreatments(lines: CartLine[]): number {
  return lines
    .filter((l) => l.item.type === "service")
    .reduce((sum, l) => sum + l.qty, 0);
}

/**
 * Cek apakah member bisa menukar 1x Gratis Treatment (100 poin) pada keranjang saat ini.
 * Syarat:
 * 1. Ada minimal 1 layanan (service) di keranjang.
 * 2. Poin member saat ini + poin dari treatment berbayar lainnya di keranjang >= 100 poin.
 *    (Jika member sudah punya >= 100 poin, otomatis bisa langsung klaim pada 1 treatment.
 *     Jika member punya 90 poin dan memesan 2 treatment sekaligus, treatment ke-1 menggenapkan 100 poin
 *     dan treatment ke-2 bisa langsung gratis di transaksi yang sama.)
 */
export function canRedeemFreeTreatment(memberPoints: number, totalServiceQty: number): boolean {
  if (totalServiceQty < 1) return false;
  const paidServiceQtyIfRedeemed = Math.max(0, totalServiceQty - 1);
  return memberPoints + paidServiceQtyIfRedeemed * POINTS_PER_TREATMENT >= FREE_TREATMENT_POINTS;
}

export interface CheckoutMemberPoints {
  totalTreatmentsInCart: number;
  paidTreatmentsCount: number;
  pointsEarned: number;
  pointsRedeemed: number;
  netPointsDelta: number;
}

/**
 * Hitung perolehan dan penukaran poin untuk satu transaksi checkout:
 * - Setiap 1x treatment berbayar menghasilkan +10 poin.
 * - Jika menukar 1x Gratis Treatment pada salah satu baris layanan, 100 poin dipotong (-100)
 *   dan 1 unit treatment gratis tersebut tidak menambah poin baru.
 */
export function calcCheckoutMemberPoints(
  lines: CartLine[],
  redeemLineId: string | null,
  memberPoints: number
): CheckoutMemberPoints {
  const totalTreatmentsInCart = countCartTreatments(lines);
  const hasValidRedeemLine = Boolean(
    redeemLineId &&
      lines.some((l) => l.lineId === redeemLineId && l.item.type === "service") &&
      canRedeemFreeTreatment(memberPoints, totalTreatmentsInCart)
  );

  const paidTreatmentsCount = hasValidRedeemLine
    ? Math.max(0, totalTreatmentsInCart - 1)
    : totalTreatmentsInCart;
  const pointsEarned = paidTreatmentsCount * POINTS_PER_TREATMENT;
  const pointsRedeemed = hasValidRedeemLine ? FREE_TREATMENT_POINTS : 0;

  return {
    totalTreatmentsInCart,
    paidTreatmentsCount,
    pointsEarned,
    pointsRedeemed,
    netPointsDelta: pointsEarned - pointsRedeemed,
  };
}

/** Pasang atau lepas aturan potongan 1x Gratis Treatment Member (senilai 1 unit harga layanan) pada baris keranjang. */
export function withMemberFreeAdjustment(
  existingRules: AdjustmentRule[],
  unitPrice: Rupiah,
  redeemThisLine: boolean
): AdjustmentRule[] {
  const withoutMemberFree = existingRules.filter((r) => r.promoId !== MEMBER_FREE_PROMO_ID);
  if (!redeemThisLine) return withoutMemberFree;
  return [
    ...withoutMemberFree,
    {
      promoId: MEMBER_FREE_PROMO_ID,
      name: "Gratis 1x Treatment (100 Poin)",
      kind: "promo",
      valueType: "flat",
      value: unitPrice,
    },
  ];
}

export interface StampProgress {
  /** Jumlah stamp pada kartu siklus 10 treatment saat ini (0..10). */
  filledStamps: number;
  /** Poin pada siklus saat ini (0..100). */
  cyclePoints: number;
  /** Berapa kali gratis treatment yang siap diklaim sekarang (kelipatan 100 poin). */
  availableRewards: number;
  /** Berapa kali treatment lagi untuk mencapai gratis berikutnya. */
  treatmentsToNextReward: number;
}

/** Informasi visual untuk kartu 10-stamp member. */
export function getStampProgress(points: number): StampProgress {
  const safePoints = Math.max(0, Math.floor(points));
  const availableRewards = Math.floor(safePoints / FREE_TREATMENT_POINTS);
  const remainder = safePoints % FREE_TREATMENT_POINTS;

  // Jika poin sudah >= 100 dan pas kelipatan 100, tampilkan 10/10 stamp penuh (siap klaim!).
  if (availableRewards > 0 && remainder === 0) {
    return {
      filledStamps: TREATMENTS_PER_REWARD,
      cyclePoints: FREE_TREATMENT_POINTS,
      availableRewards,
      treatmentsToNextReward: 0,
    };
  }

  const filledStamps = Math.min(TREATMENTS_PER_REWARD, Math.floor(remainder / POINTS_PER_TREATMENT));
  return {
    filledStamps,
    cyclePoints: remainder,
    availableRewards,
    treatmentsToNextReward: Math.max(0, TREATMENTS_PER_REWARD - filledStamps),
  };
}
