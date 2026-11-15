import type { CartLine, CatalogItem, Transaction } from "@/types";

/** Fixed sample sale for the receipt preview on the Printer & Struk screen. */
export function sampleTransaction(): Transaction {
  const service: CatalogItem = {
    id: "sample-svc",
    type: "service",
    name: "Potong Rambut Premium",
    category: "haircut",
    price: 85000,
    durationMinutes: 45,
    commissionBasis: "percent",
    commissionValue: 2500,
  };
  const retail: CatalogItem = {
    id: "sample-retail",
    type: "retail",
    name: "Hair Serum 100ml",
    category: "retail-haircare",
    price: 85000,
    commissionBasis: "percent",
    commissionValue: 1000,
  };
  const lines: CartLine[] = [
    { lineId: "l1", item: service, qty: 1, stylistId: null, lineDiscount: 0, lineExtra: 0, adjustments: [], lineTotal: 85000, commissionAmount: 0 },
    { lineId: "l2", item: retail, qty: 1, stylistId: null, lineDiscount: 0, lineExtra: 0, adjustments: [], lineTotal: 85000, commissionAmount: 0 },
  ];
  return {
    localId: "sample",
    receiptNo: "SAL-20261015-00001",
    outletId: "sample",
    cashierId: "sample",
    customerName: null,
    lines,
    subtotal: 170000,
    discountTotal: 0,
    extraTotal: 0,
    taxTotal: 0,
    grandTotal: 170000,
    paymentMethod: "cash",
    paymentBreakdown: [{ method: "cash", amount: 170000 }],
    status: "paid",
    midtransOrderId: null,
    createdAt: new Date().toISOString(),
    syncedAt: null,
  };
}
