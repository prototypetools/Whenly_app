/**
 * ============================================================
 * Analitik pengeluaran — SEMUA angka dihitung dari data pengguna.
 * ============================================================
 * Sumber data:
 *  - `Subscription` → proyeksi & estimasi (bulanan/tahunan)
 *  - `Payment`      → pengeluaran yang benar-benar sudah dibayar (riwayat)
 *
 * Tidak ada angka dekoratif: bila pengguna belum punya data, hasilnya nol
 * dan UI menampilkan empty state.
 */

import {
  addDaysISO,
  daysBetweenISO,
  endOfMonthISO,
  lastNMonthKeys,
  monthKey,
  monthLabel,
  nextNMonthKeys,
  startOfMonthISO,
  todayISO,
} from './dates';
import { categoryById, CategoryLike, isLowUsage, SYSTEM_CATEGORIES } from './categories';
import { roundRupiah, safePercent } from './money';
import {
  isBillableNow,
  isoOf,
  monthlyEquivalent,
  monthlyEquivalentAfterTrial,
  occurrencesInWindow,
  SubscriptionLike,
  TrialItem,
  trialItems,
  upcomingRenewals,
  RenewalItem,
  ValueFlag,
  valueFlags,
  yearlyEquivalent,
} from './subscriptions';

export interface CategoryBreakdownRow {
  categoryId: string;
  name: string;
  emoji: string;
  color: string;
  monthly: number;
  yearly: number;
  count: number;
  percent: number;
  items: { id: string; name: string; monthly: number }[];
}

export interface MonthPoint {
  month: string;
  label: string;
  amount: number;
  count: number;
}

export interface TrendPoint extends MonthPoint {
  /** Pengeluaran yang sudah benar-benar dibayar pada bulan itu (dari tabel Payment). */
  actual: number;
  /** Proyeksi tagihan yang dijadwalkan pada bulan itu. */
  projected: number;
}

export interface AnalyticsSummary {
  today: string;
  totalSubscriptions: number;
  activeCount: number;
  pausedCount: number;
  canceledCount: number;
  trialRunningCount: number;
  billableCount: number;

  monthlyTotal: number;
  yearlyTotal: number;
  averageMonthlyPerActive: number;
  weeklyTotal: number;
  dailyTotal: number;

  trialPendingMonthly: number;
  trialPendingYearly: number;

  categoryBreakdown: CategoryBreakdownRow[];
  topServices: { id: string; name: string; monthly: number; categoryId: string }[];

  next12Months: MonthPoint[];
  last12Months: TrendPoint[];
  paidHistory: MonthPoint[];
  paidTotal12Months: number;
  averagePaidPerMonth: number;

  upcoming: RenewalItem[];
  dueToday: RenewalItem[];
  dueIn3: RenewalItem[];
  dueIn7: RenewalItem[];
  dueIn30: RenewalItem[];
  overdue: RenewalItem[];

  trials: TrialItem[];
  trialsEndingSoon: TrialItem[];

  valueFlags: ValueFlag[];

  monthlyVsYearly: { label: string; monthly: number; yearly: number }[];
}

export interface PaymentLike {
  id: string;
  subscriptionId: string | null;
  amount: number;
  paidAt: Date | string;
  cycle?: string | null;
}

export interface AnalyticsInput {
  subscriptions: SubscriptionLike[];
  payments: PaymentLike[];
  categories?: CategoryLike[];
  today?: string;
}

export function buildAnalytics({ subscriptions, payments, categories = [], today }: AnalyticsInput): AnalyticsSummary {
  const todayKey = today ?? todayISO();
  const categoryList = [...SYSTEM_CATEGORIES, ...categories];

  const billable = subscriptions.filter((s) => isBillableNow(s, todayKey));
  const activeAll = subscriptions.filter((s) => s.status === 'active');
  const trials = trialItems(subscriptions, todayKey);
  const runningTrials = trials.filter((t) => t.status !== 'ended');

  const monthlyTotal = billable.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  const yearlyTotal = billable.reduce((sum, s) => sum + yearlyEquivalent(s), 0);

  const trialPendingMonthly = runningTrials.reduce(
    (sum, t) => sum + monthlyEquivalentAfterTrial(t.subscription),
    0,
  );

  // ---- Breakdown kategori (hanya biaya berjalan) ----
  const byCategory = new Map<string, CategoryBreakdownRow>();
  for (const sub of billable) {
    const cat = categoryById(categoryList, sub.category);
    const monthly = monthlyEquivalent(sub);
    const row =
      byCategory.get(cat.id) ??
      ({
        categoryId: cat.id,
        name: cat.name,
        emoji: cat.emoji,
        color: cat.color,
        monthly: 0,
        yearly: 0,
        count: 0,
        percent: 0,
        items: [],
      } satisfies CategoryBreakdownRow);
    row.monthly += monthly;
    row.yearly += yearlyEquivalent(sub);
    row.count += 1;
    row.items.push({ id: sub.id, name: sub.name, monthly });
    byCategory.set(cat.id, row);
  }

  const categoryBreakdown = [...byCategory.values()]
    .map((row) => ({
      ...row,
      monthly: roundRupiah(row.monthly),
      yearly: roundRupiah(row.yearly),
      percent: safePercent(row.monthly, monthlyTotal, 1),
      items: row.items.sort((a, b) => b.monthly - a.monthly),
    }))
    .sort((a, b) => b.monthly - a.monthly);

  const topServices = billable
    .map((s) => ({
      id: s.id,
      name: s.name,
      monthly: roundRupiah(monthlyEquivalent(s)),
      categoryId: s.category,
    }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 6);

  // ---- Proyeksi 12 bulan ke depan (dari jadwal nyata tiap subscription) ----
  const forwardKeys = nextNMonthKeys(12, todayKey);
  const forward: MonthPoint[] = forwardKeys.map((key) => {
    const from = key === monthKey(todayKey) ? todayKey : startOfMonthISO(`${key}-01`);
    const to = endOfMonthISO(`${key}-01`);
    let amount = 0;
    let count = 0;
    for (const sub of subscriptions) {
      if (sub.status === 'canceled' || sub.status === 'expired') continue;
      const occ = occurrencesInWindow(sub, from, to, { includeTrialPeriod: true });
      for (const o of occ) {
        amount += o.amount;
        count += 1;
      }
    }
    return { month: key, label: monthLabel(key), amount: roundRupiah(amount), count };
  });

  // ---- Riwayat pembayaran (12 bulan terakhir, dari tabel Payment) ----
  const historyKeys = lastNMonthKeys(12, todayKey);
  const paidByMonth = new Map<string, { amount: number; count: number }>();
  for (const key of historyKeys) paidByMonth.set(key, { amount: 0, count: 0 });
  for (const payment of payments) {
    const key = monthKey(isoOf(payment.paidAt));
    const bucket = paidByMonth.get(key);
    if (bucket) {
      bucket.amount += payment.amount;
      bucket.count += 1;
    }
  }
  const paidHistory: MonthPoint[] = historyKeys.map((key) => ({
    month: key,
    label: monthLabel(key),
    amount: roundRupiah(paidByMonth.get(key)?.amount ?? 0),
    count: paidByMonth.get(key)?.count ?? 0,
  }));
  const paidTotal12Months = paidHistory.reduce((sum, m) => sum + m.amount, 0);
  const monthsWithPayments = paidHistory.filter((m) => m.amount > 0).length;

  // ---- Trend gabungan (proyeksi 12 bulan + realisasi pembayaran) ----
  const projectedByKey = new Map(forward.map((m) => [m.month, m]));
  const paidByKey = new Map(paidHistory.map((m) => [m.month, m]));
  const trendKeys = [...new Set([...historyKeys.slice(6), ...forwardKeys.slice(0, 6)])].sort();
  const last12Months: TrendPoint[] = trendKeys.map((key) => ({
    month: key,
    label: monthLabel(key),
    amount: (projectedByKey.get(key)?.amount ?? 0) || (paidByKey.get(key)?.amount ?? 0),
    count: projectedByKey.get(key)?.count ?? paidByKey.get(key)?.count ?? 0,
    actual: paidByKey.get(key)?.amount ?? 0,
    projected: projectedByKey.get(key)?.amount ?? 0,
  }));

  // ---- Renewal & pengingat ----
  const upcoming = upcomingRenewals(subscriptions, { withinDays: 400, today: todayKey });
  const within = (maxDays: number) => upcoming.filter((r) => r.daysLeft >= 0 && r.daysLeft <= maxDays);

  // ---- Value checker ----
  const flags = valueFlags(subscriptions);

  return {
    today: todayKey,
    totalSubscriptions: subscriptions.length,
    activeCount: activeAll.length,
    pausedCount: subscriptions.filter((s) => s.status === 'paused').length,
    canceledCount: subscriptions.filter((s) => s.status === 'canceled').length,
    trialRunningCount: runningTrials.length,
    billableCount: billable.length,

    monthlyTotal: roundRupiah(monthlyTotal),
    yearlyTotal: roundRupiah(yearlyTotal),
    averageMonthlyPerActive: billable.length ? roundRupiah(monthlyTotal / billable.length) : 0,
    weeklyTotal: roundRupiah(monthlyTotal / (52 / 12)),
    dailyTotal: roundRupiah(monthlyTotal / 30.436875),

    trialPendingMonthly: roundRupiah(trialPendingMonthly),
    trialPendingYearly: roundRupiah(trialPendingMonthly * 12),

    categoryBreakdown,
    topServices,

    next12Months: forward,
    last12Months,
    paidHistory,
    paidTotal12Months,
    averagePaidPerMonth: monthsWithPayments ? roundRupiah(paidTotal12Months / monthsWithPayments) : 0,

    upcoming,
    dueToday: upcoming.filter((r) => r.daysLeft === 0),
    dueIn3: within(3),
    dueIn7: within(7),
    dueIn30: within(30),
    overdue: upcoming.filter((r) => r.daysLeft < 0),

    trials,
    trialsEndingSoon: runningTrials.filter((t) => t.daysLeft <= 3),

    valueFlags: flags,

    monthlyVsYearly: billable
      .map((sub) => ({
        label: sub.name,
        monthly: roundRupiah(monthlyEquivalent(sub)),
        yearly: roundRupiah(yearlyEquivalent(sub)),
      }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 8),
  };
}

/** Tagihan pada rentang tanggal tertentu, dipakai untuk kalender renewal. */
export function chargesInRange(
  subscriptions: SubscriptionLike[],
  fromISO: string,
  toISO: string,
  options: { includeTrialPeriod?: boolean } = {},
) {
  const items: { date: string; subscriptionId: string; name: string; amount: number; categoryId: string }[] = [];
  for (const sub of subscriptions) {
    if (sub.status === 'canceled' || sub.status === 'expired') continue;
    for (const occ of occurrencesInWindow(sub, fromISO, toISO, options)) {
      items.push({
        date: occ.date,
        subscriptionId: sub.id,
        name: sub.name,
        amount: occ.amount,
        categoryId: sub.category,
      });
    }
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Ringkasan singkat untuk widget dashboard. */
export function recurringSplit(subscriptions: SubscriptionLike[], today = todayISO()) {
  const billable = subscriptions.filter((s) => isBillableNow(s, today));
  const split = { weekly: 0, monthly: 0, yearly: 0, custom: 0 };
  for (const sub of billable) {
    const monthly = monthlyEquivalent(sub);
    if (sub.billingCycle === 'weekly') split.weekly += monthly;
    else if (sub.billingCycle === 'yearly') split.yearly += monthly;
    else if (sub.billingCycle === 'custom') split.custom += monthly;
    else split.monthly += monthly;
  }
  return {
    weekly: roundRupiah(split.weekly),
    monthly: roundRupiah(split.monthly),
    yearly: roundRupiah(split.yearly),
    custom: roundRupiah(split.custom),
  };
}

/** Daftar hari pada sebuah bulan untuk kalender (termasuk padding minggu). */
export function calendarDays(monthKeyValue: string): { date: string; inMonth: boolean }[] {
  const first = `${monthKeyValue}-01`;
  const total = daysInMonth(monthKeyValue);
  const startWeekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Senin = 0
  const cells: { date: string; inMonth: boolean }[] = [];

  for (let i = startWeekday; i > 0; i -= 1) {
    cells.push({ date: addDaysISO(first, -i), inMonth: false });
  }
  for (let day = 1; day <= total; day += 1) {
    cells.push({ date: `${monthKeyValue}-${String(day).padStart(2, '0')}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: addDaysISO(cells[cells.length - 1].date, 1), inMonth: false });
  }
  return cells;
}

function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function daysUntil(dateISO: string, today = todayISO()): number {
  return daysBetweenISO(today, dateISO);
}

export function isLowUsageSub(sub: SubscriptionLike): boolean {
  return isLowUsage(sub.usageFrequency);
}
