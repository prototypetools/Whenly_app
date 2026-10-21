/**
 * Ekspor data pengguna: CSV (fitur Premium/Student) dan JSON (semua paket).
 * Tidak ada data pengguna lain yang ikut terekspor karena semua query
 * difilter dengan userId.
 */

import type { Payment, Subscription } from '@prisma/client';
import { categoryById, CategoryLike, usageLabel } from './categories';import {
  cycleLabel,
  isoOf,
  monthlyEquivalent,
  trialDaysLeft,
  yearlyEquivalent,
  type SubscriptionLike,
} from './subscriptions';

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

export const CSV_HEADERS = [
  'Nama',
  'Kategori',
  'Penyedia',
  'Harga per siklus (Rp)',
  'Siklus',
  'Estimasi bulanan (Rp)',
  'Estimasi tahunan (Rp)',
  'Tanggal mulai',
  'Renewal berikutnya',
  'Status',
  'Free trial',
  'Trial berakhir',
  'Sisa hari trial',
  'Harga setelah trial (Rp)',
  'Frekuensi pemakaian',
  'Nilai manfaat (1-5)',
  'Catatan',
  'Data demo',
];

export function buildSubscriptionCsv(
  subscriptions: Subscription[],
  categories: CategoryLike[],
): string {
  const rows: (string | number | null)[][] = [CSV_HEADERS];

  for (const sub of subscriptions) {
    const category = categoryById(categories, sub.category);
    rows.push([
      sub.name,
      category.name,
      sub.provider ?? '',
      sub.price,
      cycleLabel(sub.billingCycle, sub.customPeriodDays),
      Math.round(monthlyEquivalent(sub)),
      Math.round(yearlyEquivalent(sub)),
      isoOf(sub.startDate),
      isoOf(sub.nextRenewalDate),
      sub.status,
      sub.isFreeTrial ? 'Ya' : 'Tidak',
      sub.trialEndDate ? isoOf(sub.trialEndDate) : '',
      sub.isFreeTrial ? (trialDaysLeft(sub) ?? '') : '',
      sub.priceAfterTrial ?? '',
      usageLabel(sub.usageFrequency),
      sub.valueRating ?? '',
      sub.notes ?? '',
      sub.isDemo ? 'Ya' : 'Tidak',
    ]);
  }

  return toCsv(rows);
}

export const CSV_PAYMENT_HEADERS = ['Tanggal bayar', 'Langganan', 'Jumlah (Rp)', 'Siklus', 'Metode', 'Catatan', 'Data demo'];

export function buildPaymentCsv(payments: Payment[], subsById: Map<string, Subscription>): string {
  const rows: (string | number | null)[][] = [CSV_PAYMENT_HEADERS];
  for (const payment of payments) {
    rows.push([
      isoOf(payment.paidAt),
      payment.subscriptionId ? (subsById.get(payment.subscriptionId)?.name ?? 'Langganan dihapus') : 'Tanpa langganan',
      payment.amount,
      payment.cycle ?? '',
      payment.method,
      payment.note ?? '',
      payment.isDemo ? 'Ya' : 'Tidak',
    ]);
  }
  return toCsv(rows);
}

export interface ExportPayload {
  exportedAt: string;
  timezone: string;
  currency: string;
  app: string;
  account: {
    id: string;
    name: string;
    email: string;
    plan: string;
    planCycle: string;
    planExpiresAt: string | null;
    studentStatus: string;
    createdAt: string;
  };
  summary: {
    subscriptions: number;
    activeCount: number;
    monthlyTotal: number;
    yearlyTotal: number;
    paymentsCount: number;
  };
  subscriptions: unknown[];
  payments: unknown[];
  budget: unknown | null;
  reminderSettings: unknown | null;
}

export function buildSubscriptionExportRow(
  sub: Subscription,
  categories: CategoryLike[],
): Record<string, unknown> {
  const category = categoryById(categories, sub.category);
  return {
    id: sub.id,
    name: sub.name,
    category: { id: category.id, name: category.name },
    provider: sub.provider,
    price: sub.price,
    billingCycle: sub.billingCycle,
    customPeriodDays: sub.customPeriodDays,
    cycleLabel: cycleLabel(sub.billingCycle, sub.customPeriodDays),
    estimatedMonthly: Math.round(monthlyEquivalent(sub)),
    estimatedYearly: Math.round(yearlyEquivalent(sub)),
    startDate: isoOf(sub.startDate),
    nextRenewalDate: isoOf(sub.nextRenewalDate),
    status: sub.status,
    isFreeTrial: sub.isFreeTrial,
    trialStartDate: sub.trialStartDate ? isoOf(sub.trialStartDate) : null,
    trialEndDate: sub.trialEndDate ? isoOf(sub.trialEndDate) : null,
    firstChargeDate: sub.firstChargeDate ? isoOf(sub.firstChargeDate) : null,
    priceAfterTrial: sub.priceAfterTrial,
    reminderDaysBefore: sub.reminderDaysBefore,
    reminderPriority: sub.reminderPriority,
    usageFrequency: sub.usageFrequency,
    valueRating: sub.valueRating,
    benefitNotes: sub.benefitNotes,
    notes: sub.notes,
    lastPaidAt: sub.lastPaidAt ? isoOf(sub.lastPaidAt) : null,
    isDemo: sub.isDemo,
    createdAt: sub.createdAt.toISOString(),
  };
}

export function csvFilename(prefix: string, today: string): string {
  return `${prefix}-${today}.csv`;
}

export function jsonFilename(prefix: string, today: string): string {
  return `${prefix}-${today}.json`;
}

/** Nama berkas aman (tanpa karakter ilegal di Windows/Linux). */
export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '-');
}
