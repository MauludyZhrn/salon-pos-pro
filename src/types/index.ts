import type { Rupiah } from "@/utils/money";

export type Role = "admin" | "kasir" | "stylist";

export interface Employee {
  id: string;
  name: string;
  role: Role;
  pinHash: string;
  defaultCommissionBasis: "percent" | "fixed";
  defaultCommissionValue: number; // bps if percent, Rupiah if fixed
  active: boolean;
}

export type ItemType = "service" | "retail";

export interface CatalogItem {
  id: string;
  type: ItemType;
  name: string;
  category: string; // haircut, coloring, spa, retail-haircare, ...
  price: Rupiah;
  durationMinutes?: number; // services only
  commissionBasis: "percent" | "fixed" | "none";
  commissionValue: number;
  /** Bill of materials consumed per unit sold, for auto-deduct. */
  consumes?: { inventoryItemId: string; qtyPerUnit: number }[];
}

/** discount = potongan, promo = potongan berperiode (ditandai di kasir), additional = biaya tambahan. */
export type PromoKind = "discount" | "promo" | "additional";
/** percent: bps dari harga x qty. fixed: Rupiah per unit. flat: Rupiah total untuk baris (koreksi manual). */
export type PromoValueType = "percent" | "fixed" | "flat";
export type PromoScope = "all" | "service" | "retail" | "items";

export interface Promotion {
  id: string;
  name: string;
  kind: PromoKind;
  valueType: Exclude<PromoValueType, "flat">;
  value: number; // bps if percent, Rupiah per unit if fixed
  scope: PromoScope;
  itemIds: string[]; // dipakai saat scope = "items"
  startDate: string | null; // yyyy-mm-dd, inklusif
  endDate: string | null; // yyyy-mm-dd, inklusif
  active: boolean;
  createdAt: string;
}

/** Salinan aturan yang dipakai di satu baris, disimpan di transaksi supaya struk lama tetap sama walau promo diubah. */
export interface AdjustmentRule {
  promoId: string; // "manual" untuk koreksi manual
  name: string;
  kind: PromoKind;
  valueType: PromoValueType;
  value: number;
}

export interface LineAdjustment extends AdjustmentRule {
  /** Hasil hitung untuk baris ini (selalu positif; tandanya ditentukan kind). */
  amount: Rupiah;
}

export interface CartLine {
  lineId: string;
  item: CatalogItem;
  qty: number;
  stylistId: string | null;
  lineDiscount: Rupiah;
  /** Biaya tambahan (kind = additional) untuk baris ini. */
  lineExtra: Rupiah;
  adjustments: LineAdjustment[];
  lineTotal: Rupiah; // (price * qty) - lineDiscount + lineExtra
  commissionAmount: Rupiah;
}

// "qris" = QRIS fisik/statis (konfirmasi manual). "edc" = mesin EDC BCA. midtrans_* = data lama.
export type PaymentMethod = "cash" | "qris" | "edc" | "midtrans_qris" | "midtrans_cc" | "midtrans_va" | "split";

export interface PaymentLeg {
  method: Exclude<PaymentMethod, "split">;
  amount: Rupiah;
}

export type TransactionStatus = "pending" | "paid" | "void" | "refunded";

export interface Transaction {
  localId: string;
  receiptNo: string;
  outletId: string;
  cashierId: string;
  customerName: string | null;
  lines: CartLine[];
  subtotal: Rupiah;
  discountTotal: Rupiah;
  /** Total biaya tambahan. grandTotal = subtotal - discountTotal + extraTotal + taxTotal. */
  extraTotal: Rupiah;
  taxTotal: Rupiah;
  grandTotal: Rupiah;
  paymentMethod: PaymentMethod;
  paymentBreakdown: PaymentLeg[];
  status: TransactionStatus;
  midtransOrderId: string | null;
  createdAt: string;
  syncedAt: string | null;
  /** Diisi saat transaksi dikoreksi lewat Riwayat Transaksi. */
  editedAt?: string | null;
  /** Member yang terhubung ke transaksi ini (opsional). */
  memberId?: string | null;
  /** Poin yang didapat dari transaksi ini (1x treatment = 10 poin). */
  pointsEarned?: number;
  /** Poin yang ditukar di transaksi ini (100 poin = 1x gratis treatment). */
  pointsRedeemed?: number;
}

export interface Member {
  id: string;
  memberCode: string;
  name: string;
  phone: string | null;
  /** Saldo poin saat ini. 1x treatment = 10 poin, 100 poin = 1x gratis treatment. */
  points: number;
  /** Total akumulasi berapa kali melakukan treatment. */
  totalTreatments: number;
  /** Total berapa kali gratis treatment sudah diklaim. */
  totalRedeemed: number;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MemberPointLogType = "earn" | "redeem" | "adjust";

export interface MemberPointLog {
  id: string;
  memberId: string;
  transactionLocalId: string | null;
  type: MemberPointLogType;
  /** Perubahan poin (+10, +20, -100, dll). */
  pointsDelta: number;
  treatmentsCount: number;
  note: string;
  createdAt: string;
}

export type InventoryCategory = "retail" | "bahan_baku";

export interface InventoryItem {
  itemId: string;
  name: string;
  category: InventoryCategory;
  unit: string;
  stockQty: number;
  lowStockThreshold: number;
  costPrice: Rupiah;
  sellPrice: Rupiah | null;
  updatedAt: string;
}

export type BookingStatus =
  | "booked"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled";

export interface Booking {
  id: string;
  customerName: string;
  customerPhone: string | null;
  stylistId: string;
  serviceIds: string[];
  startAt: string;
  endAt: string;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
}

export type JournalAccount =
  | "kas"
  | "piutang"
  | "pendapatan_jasa"
  | "pendapatan_retail"
  | "hpp_retail"
  | "hpp_bahan"
  | "beban_komisi"
  | "beban_operasional"
  | "hutang_komisi";

export interface JournalEntry {
  id: string;
  transactionLocalId: string | null;
  date: string; // yyyy-mm-dd
  account: JournalAccount;
  direction: "debit" | "kredit";
  amount: Rupiah;
  memo: string;
  createdAt: string;
}
