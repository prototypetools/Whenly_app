/**
 * ============================================================
 * Inti perhitungan subscription
 * ============================================================
 * Normalisasi biaya (sesuai aturan yang diminta):
 *  - monthly   → tetap
 *  - yearly    → estimasi bulanan = harga tahunan ÷ 12
 *  - weekly    → estimasi tahunan = 52 × harga mingguan, bulanan = ×52÷12
 *  - custom    → estimasi tahunan = harga × (365,2425 / jumlah hari), bulanan = ÷12
 *
 * Semua fungsi di sini MURNI (tanpa I/O) sehingga dapat dipakai di server
 * maupun klien, dan mudah diuji.
 */

import {
  addDaysISO,
  addMonthsClamped,
  daysFromToday,
  daysBetweenISO,
  todayISO,
  parseISODate,
} from './dates';

export type Cycle = 'weekly' | 'monthly' | 'yearly' | 'custom';
export type SubStatus = 'active' | 'paused' | 'canceled' | 'expired';
export type ReminderPriority = 'low' | 'normal' | 'high';

export interface SubscriptionLike {
  id: string;
  name: string;
  category: string;
  provider?: string | null;
  price: number;
  billingCycle: string;
  customPeriodDays?: number | null;
  startDate: Date | string;
  nextRenewalDate: Date | string;
  status: string;
  isFreeTrial: boolean;
  trialStartDate?: Date | string | null;
  trialEndDate?: Date | string | null;
  firstChargeDate?: Date | string | null;
  priceAfterTrial?: number | null;
  reminderDaysBefore: number;
  reminderPriority: string;
  lastPaidAt?: Date | string | null;
  paidThisCycle: boolean;
  usageFrequency?: string | null;
  valueRating?: number | null;
  benefitNotes?: string | null;
  notes?: string | null;
  isDemo?: boolean;
}

const DAYS_PER_YEAR = 365.2425; // rata-rata panjang tahun Gregorian (kabisat dihitung rata-rata)

export function normalizePeriodDays(cycle: string, customPeriodDays?: number | null): number {
  switch (cycle) {
    case 'weekly':
      return 7;
    case 'monthly':
      return 30.436875;
    case 'yearly':
      return DAYS_PER_YEAR;
    case 'custom':
      return Math.max(1, Number(customPeriodDays) || 30);
    default:
      return 30.436875;
  }
}

/** Estimasi biaya per TAHUN (Rupiah, tidak dibulatkan). */
export function yearlyEquivalent(sub: Pick<SubscriptionLike, 'price' | 'billingCycle' | 'customPeriodDays'>): number {
  const price = Math.max(0, Number(sub.price) || 0);
  const days = normalizePeriodDays(sub.billingCycle, sub.customPeriodDays);
  return (price * DAYS_PER_YEAR) / days;
}

/** Estimasi biaya per BULAN (Rupiah, tidak dibulatkan). */
export function monthlyEquivalent(sub: Pick<SubscriptionLike, 'price' | 'billingCycle' | 'customPeriodDays'>): number {
  return yearlyEquivalent(sub) / 12;
}

/** Harga efektif setelah trial (bila ada) untuk estimasi biaya mendatang. */
export function effectivePrice(sub: SubscriptionLike): number {
  if (sub.isFreeTrial && sub.priceAfterTrial != null && sub.priceAfterTrial > 0) return sub.priceAfterTrial;
  return Math.max(0, Number(sub.price) || 0);
}

export function monthlyEquivalentAfterTrial(sub: SubscriptionLike): number {
  return yearlyEquivalent({ price: effectivePrice(sub), billingCycle: sub.billingCycle, customPeriodDays: sub.customPeriodDays });
}

/** Tanggal (ISO) dari sebuah field bertipe Date|string. */
export function isoOf(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

/** Apakah masa uji coba masih berjalan pada tanggal tertentu. */
export function isTrialActive(sub: SubscriptionLike, today = todayISO()): boolean {
  if (!sub.isFreeTrial || !sub.trialEndDate) return false;
  return daysBetweenISO(today, isoOf(sub.trialEndDate)) >= 0;
}

/** Subscription dihitung ke pengeluaran berjalan bila aktif dan bukan trial. */
export function isBillableNow(sub: SubscriptionLike, today = todayISO()): boolean {
  if (sub.status !== 'active') return false;
  return !isTrialActive(sub, today);
}

/** Sisa hari masa uji coba (0 = berakhir hari ini, negatif = sudah lewat). */
export function trialDaysLeft(sub: SubscriptionLike, today = todayISO()): number | null {
  if (!sub.trialEndDate) return null;
  return daysBetweenISO(today, isoOf(sub.trialEndDate));
}

/**
 * Estimasi tanggal tagihan pertama.
 * - Bila trial: sehari setelah trial berakhir, kecuali `firstChargeDate` sudah diisi.
 * - Bila bukan trial: tanggal renewal berikutnya.
 */
export function estimatedFirstCharge(sub: SubscriptionLike): string | null {
  if (sub.isFreeTrial) {
    if (sub.firstChargeDate) return isoOf(sub.firstChargeDate);
    if (sub.trialEndDate) return addDaysISO(isoOf(sub.trialEndDate), 1);
    return null;
  }
  return isoOf(sub.nextRenewalDate) || null;
}

/** Satu langkah siklus ke depan (dipakai saat "tandai sudah dibayar"). */
export function advanceCycle(iso: string, cycle: string, customPeriodDays?: number | null): string {
  switch (cycle) {
    case 'weekly':
      return addDaysISO(iso, 7);
    case 'yearly':
      return addMonthsClamped(iso, 12);
    case 'custom':
      return addDaysISO(iso, Math.max(1, Number(customPeriodDays) || 30));
    case 'monthly':
    default:
      return addMonthsClamped(iso, 1);
  }
}

/** Occurrence ke-k dari sebuah jadwal (k = 0 adalah tanggal mulai). */
export function occurrenceAt(
  startISO: string,
  cycle: string,
  customPeriodDays: number | null | undefined,
  k: number,
): string {
  switch (cycle) {
    case 'weekly':
      return addDaysISO(startISO, 7 * k);
    case 'yearly':
      return addMonthsClamped(startISO, 12 * k);
    case 'custom':
      return addDaysISO(startISO, Math.max(1, Number(customPeriodDays) || 30) * k);
    case 'monthly':
    default:
      return addMonthsClamped(startISO, k);
  }
}

export interface Occurrence {
  date: string;
  amount: number;
  /** true bila ini adalah tagihan pertama setelah masa uji coba. */
  isFirstCharge?: boolean;
}

/**
 * Daftar tagihan dalam rentang tanggal [fromISO, toISO].
 * Anchor jadwal adalah `startDate` supaya penambahan bulan tidak "melenceng"
 * (mis. selalu tanggal 31 → otomatis menyesuaikan akhir bulan).
 */
export function occurrencesInWindow(
  sub: SubscriptionLike,
  fromISO: string,
  toISO: string,
  options: { includeTrialPeriod?: boolean } = {},
): Occurrence[] {
  const start = isoOf(sub.startDate);
  if (!start || sub.status === 'canceled' || sub.status === 'expired') return [];
  if (daysBetweenISO(fromISO, toISO) < 0) return [];

  const periodDays = normalizePeriodDays(sub.billingCycle, sub.customPeriodDays);
  const estimated = Math.floor(daysBetweenISO(start, fromISO) / periodDays) - 2;
  let k = Math.max(-10_000, Math.min(10_000, Number.isFinite(estimated) ? estimated : 0));

  const results: Occurrence[] = [];
  const trialEnd = sub.trialEndDate ? isoOf(sub.trialEndDate) : null;

  for (let i = 0; i < 1200; i += 1) {
    const date = occurrenceAt(start, sub.billingCycle, sub.customPeriodDays, k);
    if (daysBetweenISO(toISO, date) > 0) break; // sudah melewati akhir jendela
    if (daysBetweenISO(fromISO, date) >= 0) {
      const stillInTrial =
        options.includeTrialPeriod === false && sub.isFreeTrial && trialEnd
          ? daysBetweenISO(date, trialEnd) >= 0
          : false;
      if (!stillInTrial) {
        results.push({
          date,
          amount: effectivePrice(sub),
          isFirstCharge: !!sub.firstChargeDate && isoOf(sub.firstChargeDate) === date,
        });
      }
    }
    k += 1;
  }

  return results;
}

/** Tagihan berikutnya (mengabaikan masa trial bila masih berjalan). */
export function nextCharge(sub: SubscriptionLike, today = todayISO()): Occurrence | null {
  const windowEnd = addDaysISO(today, 800);
  const list = occurrencesInWindow(sub, today, windowEnd, { includeTrialPeriod: false });
  return list[0] ?? null;
}

export interface RenewalItem {
  subscription: SubscriptionLike;
  date: string;
  daysLeft: number;
  amount: number;
  /** true bila tagihan ini masih dalam masa trial (belum ditagih). */
  inTrial: boolean;
  paid: boolean;
  priority: ReminderPriority;
  isFirstCharge: boolean;
}

export function renewalItem(sub: SubscriptionLike, date: string, today = todayISO()): RenewalItem {
  const daysLeft = daysBetweenISO(today, date);
  return {
    subscription: sub,
    date,
    daysLeft,
    amount: effectivePrice(sub),
    inTrial: isTrialActive(sub, today),
    paid: sub.paidThisCycle && isoOf(sub.nextRenewalDate) === date,
    priority: (sub.reminderPriority as ReminderPriority) ?? 'normal',
    isFirstCharge: !!sub.firstChargeDate && isoOf(sub.firstChargeDate) === date,
  };
}

export const PRIORITY_WEIGHT: Record<ReminderPriority, number> = { high: 0, normal: 1, low: 2 };

/** Daftar renewal berikutnya untuk semua subscription (satu per subscription). */
export function upcomingRenewals(
  subs: SubscriptionLike[],
  options: { withinDays?: number; today?: string } = {},
): RenewalItem[] {
  const today = options.today ?? todayISO();
  const limit = options.withinDays ?? 60;

  return subs
    .filter((s) => s.status === 'active' || s.status === 'paused')
    .map((sub) => {
      const next = nextCharge(sub, today);
      if (!next) return null;
      if (daysBetweenISO(today, next.date) > limit) return null;
      return renewalItem(sub, next.date, today);
    })
    .filter((x): x is RenewalItem => x !== null)
    .sort((a, b) => {
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    });
}

export interface TrialItem {
  subscription: SubscriptionLike;
  startDate: string | null;
  endDate: string;
  daysLeft: number;
  firstChargeDate: string | null;
  firstChargeDaysLeft: number | null;
  priceAfterTrial: number;
  status: 'running' | 'ending-today' | 'ended';
}

export function trialItems(subs: SubscriptionLike[], today = todayISO()): TrialItem[] {
  return subs
    .filter((s) => s.isFreeTrial && s.trialEndDate)
    .map((sub) => {
      const endDate = isoOf(sub.trialEndDate);
      const daysLeft = daysBetweenISO(today, endDate);
      const firstCharge = estimatedFirstCharge(sub);
      return {
        subscription: sub,
        startDate: sub.trialStartDate ? isoOf(sub.trialStartDate) : null,
        endDate,
        daysLeft,
        firstChargeDate: firstCharge,
        firstChargeDaysLeft: firstCharge ? daysBetweenISO(today, firstCharge) : null,
        priceAfterTrial: effectivePrice(sub),
        status: daysLeft < 0 ? 'ended' : daysLeft === 0 ? 'ending-today' : 'running',
      } satisfies TrialItem;
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Label siklus untuk ditampilkan. */
export function cycleLabel(cycle: string, customPeriodDays?: number | null): string {
  switch (cycle) {
    case 'weekly':
      return 'Mingguan';
    case 'yearly':
      return 'Tahunan';
    case 'custom':
      return `Kustom · ${Math.max(1, Number(customPeriodDays) || 30)} hari`;
    case 'monthly':
    default:
      return 'Bulanan';
  }
}

export function cycleShortLabel(cycle: string, customPeriodDays?: number | null): string {
  switch (cycle) {
    case 'weekly':
      return '/minggu';
    case 'yearly':
      return '/tahun';
    case 'custom':
      return `/${Math.max(1, Number(customPeriodDays) || 30)} hari`;
    case 'monthly':
    default:
      return '/bulan';
  }
}

export const USAGE_LOW_THRESHOLD_MONTHLY = 25_000;

export interface ValueFlag {
  subscription: SubscriptionLike;
  monthlyCost: number;
  reason: string;
  severity: 'high' | 'medium';
}

/**
 * Value Checker: menandai subscription yang tampak kurang bermanfaat.
 * Hanya berupa SARAN TINJAUAN — tidak pernah membatalkan/menghapus otomatis.
 */
export function valueFlags(subs: SubscriptionLike[]): ValueFlag[] {
  const flags: ValueFlag[] = [];
  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    const monthlyCost = monthlyEquivalent(sub);
    const reasons: string[] = [];

    if (sub.usageFrequency === 'never') reasons.push('ditandai tidak pernah dipakai');
    if (sub.usageFrequency === 'rarely') reasons.push('jarang dipakai');
    if (sub.valueRating !== null && sub.valueRating !== undefined && sub.valueRating <= 2) {
      reasons.push(`nilai manfaat rendah (${sub.valueRating}/5)`);
    }
    if (!reasons.length) continue;

    const severity: 'high' | 'medium' =
      sub.usageFrequency === 'never' || monthlyCost >= 100_000 ? 'high' : 'medium';

    flags.push({
      subscription: sub,
      monthlyCost,
      reason: reasons.join(', '),
      severity,
    });
  }
  return flags.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

/** Kunci unik untuk React list. */
export function subKey(sub: { id: string }): string {
  return sub.id;
}

export function parsedDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return parseISODate(iso);
}

/** Berapa hari sejak subscription dimulai. */
export function daysSinceStart(sub: SubscriptionLike, today = todayISO()): number | null {
  const start = isoOf(sub.startDate);
  if (!start) return null;
  return daysBetweenISO(start, today);
}

export { daysFromToday };
