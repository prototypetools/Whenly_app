/**
 * ============================================================
 * Validasi input (zod) — dijalankan di SERVER untuk setiap request.
 * ============================================================
 * Semua tanggal masuk sebagai 'YYYY-MM-DD' lalu diubah ke Date UTC-midnight
 * agar konsisten dengan perhitungan kalender di lib/dates.ts.
 */

import { z } from 'zod';
import { isValidISODate, parseISODate } from './dates';
import { slugifyCategory } from './categories';

const isoDate = z
  .string()
  .trim()
  .refine((v) => isValidISODate(v), { message: 'Tanggal harus berformat YYYY-MM-DD dan valid.' })
  .transform((v) => parseISODate(v));

const optionalIsoDate = z
  .union([z.string().trim().refine((v) => v === '' || isValidISODate(v), { message: 'Tanggal tidak valid.' }), z.null()])
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : parseISODate(v)));

const optionalText = (max = 500) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined || v === '' ? null : v));

const rupiah = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (typeof v === 'number') return Math.max(0, Math.round(v));
    return Math.max(0, Math.round(Number(String(v).replace(/[^\d]/g, '')) || 0));
  })
  .refine((v) => Number.isFinite(v) && v >= 0, { message: 'Harga tidak valid.' })
  .refine((v) => v <= 1_000_000_000, { message: 'Harga terlalu besar.' });

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Email wajib diisi.')
  .max(160, 'Email terlalu panjang.')
  .email('Format email tidak valid.');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(60, 'Nama maksimal 60 karakter.'),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter.')
    .max(72, 'Password maksimal 72 karakter.')
    .regex(/[a-zA-Z]/, 'Password harus mengandung huruf.')
    .regex(/\d/, 'Password harus mengandung angka.'),
  timezone: z.string().trim().max(60).optional().default('Asia/Jakarta'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password wajib diisi.').max(72),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(60),
  timezone: z.string().trim().min(3).max(60),
  locale: z.enum(['id-ID', 'en-US']),
  avatarColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus berformat HEX, mis. #6d28d9.'),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi.'),
  newPassword: z
    .string()
    .min(8, 'Password baru minimal 8 karakter.')
    .max(72)
    .regex(/[a-zA-Z]/, 'Password baru harus mengandung huruf.')
    .regex(/\d/, 'Password baru harus mengandung angka.'),
});

// ------------------------------------------------------------------
// Subscription
// ------------------------------------------------------------------

export const BILLING_CYCLES = ['weekly', 'monthly', 'yearly', 'custom'] as const;
export const SUB_STATUSES = ['active', 'paused', 'canceled', 'expired'] as const;
export const REMINDER_PRIORITIES = ['low', 'normal', 'high'] as const;
export const USAGE_VALUES = ['daily', 'weekly', 'monthly', 'rarely', 'never'] as const;

export const subscriptionCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'Nama layanan minimal 2 karakter.').max(80, 'Nama maksimal 80 karakter.'),
    category: z.string().trim().min(1, 'Kategori wajib dipilih.').max(40),
    provider: optionalText(80),
    price: rupiah,
    billingCycle: z.enum(BILLING_CYCLES, { errorMap: () => ({ message: 'Siklus pembayaran tidak dikenal.' }) }),
    customPeriodDays: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Math.round(Number(v));
        return Number.isFinite(n) ? n : null;
      }),
    startDate: isoDate,
    nextRenewalDate: isoDate,
    status: z.enum(SUB_STATUSES).optional().default('active'),
    isFreeTrial: z.boolean().optional().default(false),
    trialStartDate: optionalIsoDate,
    trialEndDate: optionalIsoDate,
    firstChargeDate: optionalIsoDate,
    priceAfterTrial: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d]/g, ''));
        return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
      }),
    reminderDaysBefore: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v) => (v === undefined || v === '' ? 3 : Math.min(60, Math.max(0, Math.round(Number(v))))))
      .refine((v) => Number.isFinite(v), { message: 'Hari pengingat tidak valid.' }),
    reminderPriority: z.enum(REMINDER_PRIORITIES).optional().default('normal'),
    usageFrequency: z
      .union([z.enum(USAGE_VALUES), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v === null || v === undefined ? null : v)),
    valueRating: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Math.round(Number(v));
        return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null;
      }),
    benefitNotes: optionalText(600),
    notes: optionalText(600),
  })
  .superRefine((value, ctx) => {
    if (value.billingCycle === 'custom' && (!value.customPeriodDays || value.customPeriodDays < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customPeriodDays'],
        message: 'Untuk siklus kustom, isi jumlah hari periode (minimal 1).',
      });
    }
    if (value.isFreeTrial && !value.trialEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trialEndDate'],
        message: 'Tanggal berakhir wajib diisi untuk free trial.',
      });
    }
    if (
      value.isFreeTrial &&
      value.trialEndDate &&
      value.trialStartDate &&
      value.trialStartDate.getTime() > value.trialEndDate.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['trialEndDate'],
        message: 'Tanggal berakhir trial harus setelah tanggal mulai trial.',
      });
    }
    if (value.nextRenewalDate.getTime() < value.startDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nextRenewalDate'],
        message: 'Tanggal renewal berikutnya tidak boleh sebelum tanggal mulai. Gunakan "Perpanjang" bila ingin melewati siklus.',
      });
    }
  });

export const subscriptionUpdateSchema = subscriptionCreateSchema.innerType().partial();

export const markPaidSchema = z.object({
  subscriptionId: z.string().trim().min(1),
  paidAt: optionalIsoDate,
  note: optionalText(300),
  /** Bila true, tanggal renewal otomatis maju satu siklus. */
  advance: z.boolean().optional().default(true),
});

export const extendSchema = z.object({
  subscriptionId: z.string().trim().min(1),
  steps: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => Math.min(12, Math.max(1, Math.round(Number(v ?? 1)) || 1))),
});

// ------------------------------------------------------------------
// Budget & reminder
// ------------------------------------------------------------------

export const budgetSchema = z.object({
  monthlyLimit: rupiah,
  warnAtPercent: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? 80 : Math.min(100, Math.max(1, Math.round(Number(v))))))
    .refine((v) => Number.isFinite(v), { message: 'Ambang peringatan tidak valid.' }),
  notes: optionalText(400),
});

export const reminderSettingsSchema = z.object({
  defaultDaysBefore: z
    .union([z.number(), z.string()])
    .transform((v) => Math.min(60, Math.max(0, Math.round(Number(v)))))
    .refine((v) => Number.isFinite(v), { message: 'Jumlah hari tidak valid.' }),
  inAppEnabled: z.boolean().optional().default(true),
  emailEnabled: z.boolean().optional().default(false),
});

// ------------------------------------------------------------------
// Kategori kustom
// ------------------------------------------------------------------

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter.').max(30, 'Nama kategori maksimal 30 karakter.'),
  emoji: z
    .string()
    .trim()
    .min(1)
    .max(4)
    .optional()
    .default('📦'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus berformat HEX.')
    .optional()
    .default('#64748b'),
});

export const categoryDeleteSchema = z.object({
  id: z.string().trim().min(1),
});

export function categoryIdFromName(name: string): string {
  const slug = slugifyCategory(name);
  return slug ? `custom-${slug}` : `custom-${Date.now()}`;
}

// ------------------------------------------------------------------
// Paket & billing
// ------------------------------------------------------------------

export const planSelectSchema = z.object({
  planId: z.enum(['free', 'premium', 'student']),
});

export const checkoutSchema = z.object({
  planId: z.enum(['premium', 'student']),
  cycle: z.enum(['monthly', 'yearly']),
});

export const confirmCheckoutSchema = z.object({
  checkoutId: z.string().trim().min(1, 'ID checkout wajib diisi.'),
});

// ------------------------------------------------------------------
// Verifikasi pelajar
// ------------------------------------------------------------------

export const studentVerificationSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(80),
  institution: z.string().trim().min(3, 'Nama kampus/sekolah minimal 3 karakter.').max(120),
  studentNumber: z.string().trim().min(3, 'NIM/NIS minimal 3 karakter.').max(40),
  studentEmail: z
    .union([z.string().trim().email('Format email kampus tidak valid.'), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : v)),
  note: optionalText(400),
});

export const studentReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNote: optionalText(300),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type StudentVerificationInput = z.infer<typeof studentVerificationSchema>;
