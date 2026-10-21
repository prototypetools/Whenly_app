/**
 * ============================================================
 * Utilitas tanggal & waktu — timezone Asia/Jakarta
 * ============================================================
 * Prinsip:
 *  - Semua "tanggal kalender" direpresentasikan sebagai `Date` pada tengah
 *    malam UTC (UTC-midnight) dan diserialisasi sebagai string 'YYYY-MM-DD'.
 *    Dengan begitu penambahan bulan/tahun tidak terpengaruh DST.
 *  - Penambahan bulan memakai aturan CLAMP: 31 Jan + 1 bulan = 28/29 Feb
 *    (menghormati tahun kabisat), sehingga jatuh tempo tidak pernah "lompat".
 *  - Zona waktu pengguna default Asia/Jakarta (UTC+7).
 */

export const TZ = process.env.TIMEZONE || 'Asia/Jakarta';

const MS_PER_DAY = 86_400_000;

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Tanggal hari ini di Asia/Jakarta dalam format 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

/** Waktu sekarang menurut timezone Asia/Jakarta (untuk ditampilkan). */
export function nowLabelID(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseISODate(value);
  return toISODate(d) === value;
}

/** 'YYYY-MM-DD' -> Date pada UTC midnight. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Date -> 'YYYY-MM-DD' (memakai komponen UTC agar konsisten). */
export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/**
 * Menambahkan bulan dengan aturan clamp (aman untuk akhir bulan & kabisat).
 * 2024-01-31 + 1 bulan = 2024-02-29; 2026-01-31 + 1 bulan = 2026-02-28.
 */
export function addMonthsClamped(iso: string, months: number): string {
  const base = parseISODate(iso);
  const day = base.getUTCDate();
  const targetYear = base.getUTCFullYear();
  const targetMonth = base.getUTCMonth() + months;
  // Normalisasi bulan ke rentang tahun yang benar
  const normalized = new Date(Date.UTC(targetYear, targetMonth, 1));
  const y = normalized.getUTCFullYear();
  const m = normalized.getUTCMonth();
  const day_ = Math.min(day, lastDayOfMonth(y, m));
  return toISODate(new Date(Date.UTC(y, m, day_)));
}

export function addYearsClamped(iso: string, years: number): string {
  return addMonthsClamped(iso, years * 12);
}

export function addMonthsToKey(key: string, months: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Jarak hari kalender antara dua tanggal ISO (positif bila b > a). */
export function daysBetweenISO(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / MS_PER_DAY);
}

/** Jumlah hari sejak hari ini (negatif = sudah lewat). */
export function daysFromToday(iso: string, today = todayISO()): number {
  return daysBetweenISO(today, iso);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthKeyFromDate(date: Date): string {
  return toISODate(date).slice(0, 7);
}

export function startOfMonthISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonthISO(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const last = lastDayOfMonth(y, m - 1);
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/** Daftar month-key berurutan, n bulan mundur dari bulan `fromISO`. */
export function lastNMonthKeys(n: number, fromISO = todayISO()): string[] {
  const current = monthKey(fromISO);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) keys.push(addMonthsToKey(current, -i));
  return keys;
}

export function nextNMonthKeys(n: number, fromISO = todayISO()): string[] {
  const current = monthKey(fromISO);
  const keys: string[] = [];
  for (let i = 0; i < n; i += 1) keys.push(addMonthsToKey(current, i));
  return keys;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const MONTH_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** 'Okt 2026' */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

/** 'Oktober 2026' */
export function monthLabelLong(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_FULL[m - 1]} ${y}`;
}

/** 'Sen' — index 0 = Senin. */
export function weekdayShort(index: number): string {
  return DAY_LABELS[((index % 7) + 7) % 7];
}

export const WEEKDAY_LABELS = DAY_LABELS;

/** '19 Okt 2026' */
export function formatDateID(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** '19 Okt' */
export function formatDateShortID(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getUTCDate()} ${MONTH_LABELS[d.getUTCMonth()]}`;
}

/** Tanggal + jam dalam timezone Asia/Jakarta: '19 Okt 2026, 17.34' */
export function formatDateTimeID(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace('.', ':');
}

export function formatTimeID(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace('.', ':');
}

/** Label hitung mundur yang ramah dibaca. */
export function countdownLabel(days: number | null): string {
  if (days === null) return 'Tanggal belum diisi';
  if (days === 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  if (days === -1) return 'Kemarin';
  if (days < 0) return `Lewat ${Math.abs(days)} hari`;
  if (days < 30) return `${days} hari lagi`;
  const months = Math.round(days / 30);
  return months <= 1 ? '≈1 bulan lagi' : `≈${months} bulan lagi`;
}

export type Urgency = 'overdue' | 'today' | 'soon' | 'upcoming' | 'later';

export function urgencyOf(days: number): Urgency {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 3) return 'soon';
  if (days <= 7) return 'upcoming';
  return 'later';
}

/** Senin sebagai awal minggu. */
export function startOfWeekISO(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Senin
  return addDaysISO(iso, -dow);
}

export function daysInMonthKey(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return lastDayOfMonth(y, m - 1);
}

/** Factor bulanan dari sebuah siklus (untuk normalisasi biaya). */
export function cycleMonths(cycle: string, customPeriodDays: number | null | undefined): number {
  switch (cycle) {
    case 'weekly':
      return 12 / 52; // 1 minggu = 12/52 bulan
    case 'yearly':
      return 12;
    case 'custom':
      return (customPeriodDays ?? 30) / 30.436875; // rata-rata panjang bulan Gregorian
    case 'monthly':
    default:
      return 1;
  }
}
