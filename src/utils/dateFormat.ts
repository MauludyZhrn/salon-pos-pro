import { addDaysToDateString, isValidDateString, localDateString } from "./promotions";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"] as const;
const FULL_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;
const SHORT_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

export const CALENDAR_WEEKDAYS = SHORT_DAYS;

/** Parse YYYY-MM-DD ke tanggal lokal jam 00:00:00. */
export function parseLocalDate(yyyyMmDd: string): Date | null {
  if (!isValidDateString(yyyyMmDd)) return null;
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Konversi timestamp ISO/string ke YYYY-MM-DD menurut jam lokal HP. */
export function isoToLocalDateString(iso: string): string | null {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return localDateString(dt);
}

/** Format YYYY-MM-DD -> "22 Nov 2026" (atau "22 Nov" bila `withYear = false`). */
export function formatShortDateId(yyyyMmDd: string, withYear = true): string {
  const dt = parseLocalDate(yyyyMmDd);
  if (!dt) return yyyyMmDd;
  const day = dt.getDate();
  const mon = SHORT_MONTHS[dt.getMonth()];
  return withYear ? `${day} ${mon} ${dt.getFullYear()}` : `${day} ${mon}`;
}

/** Format YYYY-MM-DD -> "Min, 22 Nov 2026". */
export function formatWeekdayDateId(yyyyMmDd: string): string {
  const dt = parseLocalDate(yyyyMmDd);
  if (!dt) return yyyyMmDd;
  return `${SHORT_DAYS[dt.getDay()]}, ${formatShortDateId(yyyyMmDd, true)}`;
}

/** Format YYYY-MM-DD -> "November 2026". */
export function formatMonthYearId(year: number, monthIndex0: number): string {
  const safeMonth = ((monthIndex0 % 12) + 12) % 12;
  return `${FULL_MONTHS[safeMonth]} ${year}`;
}

/** Label rentang tanggal inklusif untuk tampilan filter riwayat. */
export function formatDateRangeLabel(fromDate: string | null, toDate: string | null): string {
  if (!fromDate && !toDate) return "Semua tanggal";
  if (fromDate && toDate) {
    if (fromDate === toDate) return formatWeekdayDateId(fromDate);
    const sameYear = fromDate.slice(0, 4) === toDate.slice(0, 4);
    return `${formatShortDateId(fromDate, !sameYear)} – ${formatShortDateId(toDate, true)}`;
  }
  if (fromDate) return `Mulai ${formatShortDateId(fromDate, true)}`;
  return `Sampai ${formatShortDateId(toDate!, true)}`;
}

/** Jumlah hari inklusif antara dua tanggal YYYY-MM-DD (tahan perubahan DST). */
export function countInclusiveDays(fromDate: string, toDate: string): number {
  const a = parseLocalDate(fromDate);
  const b = parseLocalDate(toDate);
  if (!a || !b) return 0;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((utcB - utcA) / 86_400_000) + 1);
}

/** Awal dan akhir bulan (YYYY-MM-DD) untuk offset bulan relatif terhadap `now` (0 = bulan ini, -1 = bulan lalu). */
export function monthRange(monthOffset = 0, now: Date = new Date()): { fromDate: string; toDate: string } {
  const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const todayStr = localDateString(now);
  const toStr = localDateString(last);
  return {
    fromDate: localDateString(first),
    toDate: monthOffset === 0 && toStr > todayStr ? todayStr : toStr,
  };
}

/** Daftar sel grid kalender (null untuk slot kosong sebelum tanggal 1) pada bulan tertentu. */
export function buildMonthGridCells(year: number, monthIndex0: number): (string | null)[] {
  const first = new Date(year, monthIndex0, 1);
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const leadingBlanks = first.getDay();
  const cells: (string | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  const firstStr = localDateString(first);
  for (let d = 0; d < daysInMonth; d++) {
    cells.push(addDaysToDateString(firstStr, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
