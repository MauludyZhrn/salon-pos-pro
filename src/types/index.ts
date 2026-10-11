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

export interface CartLine {
  lineId: string;
  item: CatalogItem;
  qty: number;
  stylistId: string | null;
  lineDiscount: Rupiah;
  lineTotal: Rupiah; // (price * qty) - lineDiscount
  commissionAmount: Rupiah;
}

export type PaymentMethod = "cash" | "midtrans_qris" | "midtrans_cc" | "midtrans_va" | "split";

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
  taxTotal: Rupiah;
  grandTotal: Rupiah;
  paymentMethod: PaymentMethod;
  paymentBreakdown: PaymentLeg[];
  status: TransactionStatus;
  midtransOrderId: string | null;
  createdAt: string;
  syncedAt: string | null;
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
