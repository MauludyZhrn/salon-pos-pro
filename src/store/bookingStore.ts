import { create } from "zustand";
import { getDb, withTransaction } from "@/services/database";
import { enqueueSync } from "@/services/syncQueue";
import { newId } from "@/utils/id";
import type { Booking, BookingStatus } from "@/types";

interface BookingState {
  bookings: Booking[];
  loading: boolean;
  loadRange: (fromIso: string, toIso: string) => Promise<void>;
  createBooking: (input: Omit<Booking, "id" | "createdAt" | "status">) => Promise<Booking>;
  updateStatus: (id: string, status: BookingStatus) => Promise<void>;
  /** True if stylist has an overlapping, non-cancelled booking in the window. */
  hasConflict: (stylistId: string, startAt: string, endAt: string, excludeId?: string) => boolean;
}

function rowToBooking(row: any): Booking {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    stylistId: row.stylist_id,
    serviceIds: JSON.parse(row.service_ids_json),
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  loading: false,

  async loadRange(fromIso, toIso) {
    set({ loading: true });
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM bookings WHERE start_at >= ? AND start_at < ? ORDER BY start_at ASC",
      [fromIso, toIso]
    );
    set({ bookings: rows.map(rowToBooking), loading: false });
  },

  hasConflict(stylistId, startAt, endAt, excludeId) {
    return get().bookings.some((b) => {
      if (b.stylistId !== stylistId) return false;
      if (b.id === excludeId) return false;
      if (b.status === "cancelled" || b.status === "no_show") return false;
      return startAt < b.endAt && endAt > b.startAt; // interval overlap
    });
  },

  async createBooking(input) {
    if (get().hasConflict(input.stylistId, input.startAt, input.endAt)) {
      throw new Error("Stylist sudah memiliki booking pada slot waktu ini");
    }
    const booking: Booking = {
      ...input,
      id: newId(),
      status: "booked",
      createdAt: new Date().toISOString(),
    };
    await withTransaction(async (db) => {
      await db.runAsync(
        `INSERT INTO bookings (id, customer_name, customer_phone, stylist_id, service_ids_json,
          start_at, end_at, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          booking.id,
          booking.customerName,
          booking.customerPhone,
          booking.stylistId,
          JSON.stringify(booking.serviceIds),
          booking.startAt,
          booking.endAt,
          booking.status,
          booking.notes,
          booking.createdAt,
        ]
      );
    });
    enqueueSync("Bookings", booking.id, booking);
    set((state) => ({ bookings: [...state.bookings, booking].sort((a, b) => a.startAt.localeCompare(b.startAt)) }));
    return booking;
  },

  async updateStatus(id, status) {
    const db = await getDb();
    await db.runAsync("UPDATE bookings SET status = ? WHERE id = ?", [status, id]);
    set((state) => ({
      bookings: state.bookings.map((b) => (b.id === id ? { ...b, status } : b)),
    }));
    const row = await db.getFirstAsync<any>("SELECT * FROM bookings WHERE id = ?", [id]);
    if (row) enqueueSync("Bookings", id, rowToBooking(row));
  },
}));
