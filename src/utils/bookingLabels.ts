import type { BookingStatus } from "@/types";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  booked: "Dipesan",
  confirmed: "Dikonfirmasi",
  checked_in: "Sudah hadir",
  in_progress: "Dikerjakan",
  completed: "Selesai",
  no_show: "Tidak hadir",
  cancelled: "Dibatalkan",
};
