/**
 * ============================================================
 * Data demo (SERVER) — pengganti database saat NEXT_PUBLIC_DEMO_MODE=true
 * ============================================================
 * Modul ini aman dipakai dari Server Component & API route (tanpa
 * `'use client'`). Semua data disimpan di memori proses server, jadi
 * TIDAK butuh Prisma/DATABASE_URL sama sekali.
 *
 * Bentuk objeknya sengaja meniru model Prisma (User, Subscription,
 * Payment, Budget, ReminderSetting, Category, StudentVerification,
 * Membership, BillingEvent) supaya halaman server yang sudah ada dapat
 * memakai data ini tanpa diubah.
 *
 * Catatan: pada lingkungan serverless (Vercel), memori bisa di-reset
 * antar-invocation. Untuk mode demo itu dapat diterima — data demo akan
 * kembali ke kondisi awal. Untuk produksi nyata, pakai database asli.
 */

export const DEMO_SESSION_COOKIE = 'Whenly_session';
export const DEMO_ACCOUNTS_SERVER = [
  { id: 'demo_premium', email: 'demo@subscriptly.id', password: 'demo12345', name: 'Rani Prasetya', planId: 'premium', studentStatus: 'none' },
  { id: 'demo_free', email: 'gratis@subscriptly.id', password: 'demo12345', name: 'Bima Nugraha', planId: 'free', studentStatus: 'none' },
  { id: 'demo_student', email: 'pelajar@subscriptly.id', password: 'demo12345', name: 'Sinta Maharani', planId: 'free', studentStatus: 'pending' },
] as const;

export type DemoUserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  timezone: string;
  locale: string;
  avatarColor: string;
  planId: string;
  planCycle: string;
  planStartedAt: Date;
  planExpiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  paymentStatus: string;
  studentStatus: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoSubscriptionRow = {
  id: string;
  userId: string;
  name: string;
  category: string;
  provider: string | null;
  price: number;
  billingCycle: string;
  customPeriodDays: number | null;
  startDate: Date;
  nextRenewalDate: Date;
  status: string;
  isFreeTrial: boolean;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  firstChargeDate: Date | null;
  priceAfterTrial: number | null;
  reminderDaysBefore: number;
  reminderPriority: string;
  lastPaidAt: Date | null;
  paidThisCycle: boolean;
  usageFrequency: string | null;
  valueRating: number | null;
  benefitNotes: string | null;
  notes: string | null;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoPaymentRow = {
  id: string;
  userId: string;
  subscriptionId: string | null;
  amount: number;
  paidAt: Date;
  cycle: string | null;
  method: string;
  note: string | null;
  isDemo: boolean;
  createdAt: Date;
};

export type DemoCategoryRow = {
  id: string;
  userId: string | null;
  name: string;
  emoji: string;
  color: string;
  isSystem: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type DemoBudgetRow = {
  id: string;
  userId: string;
  monthlyLimit: number;
  warnAtPercent: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoReminderRow = {
  id: string;
  userId: string;
  defaultDaysBefore: number;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  emailVerified: boolean;
  updatedAt: Date;
};

export type DemoStudentVerificationRow = {
  id: string;
  userId: string;
  fullName: string;
  institution: string;
  studentNumber: string;
  studentEmail: string | null;
  note: string | null;
  status: string;
  reviewedAt: Date | null;
  reviewNote: string | null;
  method: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoVerificationRow = DemoStudentVerificationRow;

export type DemoMembershipRow = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  cycle: string;
  pricePaid: number;
  paymentStatus: string;
  startedAt: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoBillingEventRow = {
  id: string;
  userId: string;
  type: string;
  planId: string | null;
  cycle: string | null;
  amount: number;
  status: string;
  provider: string;
  providerRef: string | null;
  note: string | null;
  createdAt: Date;
};

type Store = {
  users: DemoUserRow[];
  subscriptions: DemoSubscriptionRow[];
  payments: DemoPaymentRow[];
  categories: DemoCategoryRow[];
  budgets: DemoBudgetRow[];
  reminders: DemoReminderRow[];
  studentVerifications: DemoStudentVerificationRow[];
  memberships: DemoMembershipRow[];
  billingEvents: DemoBillingEventRow[];
};

const DAY = 86400000;

function seed(): Store {
  const created = new Date();
  const at = (d: number) => new Date(created.getTime() + d * DAY);

  const users: DemoUserRow[] = DEMO_ACCOUNTS_SERVER.map((a, i) => ({
    id: a.id,
    email: a.email,
    name: a.name,
    passwordHash: a.password,
    timezone: 'Asia/Jakarta',
    locale: 'id-ID',
    avatarColor: ['#6d28d9', '#2563eb', '#059669'][i] ?? '#6d28d9',
    planId: a.planId,
    planCycle: 'monthly',
    planStartedAt: created,
    planExpiresAt: a.planId === 'premium' ? at(24) : null,
    cancelAtPeriodEnd: false,
    paymentStatus: a.planId === 'premium' ? 'paid' : 'none',
    studentStatus: a.studentStatus,
    isDemo: true,
    createdAt: created,
    updatedAt: created,
  }));

  const sub = (
    userId: string,
    name: string,
    category: string,
    price: number,
    startOffset: number,
    renewOffset: number,
    extra: Partial<DemoSubscriptionRow> = {},
  ): DemoSubscriptionRow => ({
    id: `demo_sub_${Math.random().toString(36).slice(2, 10)}`,
    userId,
    name,
    category,
    provider: name.split(' ')[0],
    price,
    billingCycle: 'monthly',
    customPeriodDays: null,
    startDate: at(startOffset),
    nextRenewalDate: at(renewOffset),
    status: 'active',
    isFreeTrial: false,
    trialStartDate: null,
    trialEndDate: null,
    firstChargeDate: null,
    priceAfterTrial: null,
    reminderDaysBefore: 3,
    reminderPriority: 'normal',
    lastPaidAt: null,
    paidThisCycle: false,
    usageFrequency: null,
    valueRating: null,
    benefitNotes: null,
    notes: null,
    isDemo: true,
    createdAt: created,
    updatedAt: created,
    ...extra,
  });

  const subscriptions: DemoSubscriptionRow[] = [
    sub('demo_premium', 'Netflix Basic', 'hiburan', 120000, -25, 5, { paidThisCycle: false, usageFrequency: 'weekly', valueRating: 5 }),
    sub('demo_premium', 'Spotify Individual', 'hiburan', 54900, -18, 12, { usageFrequency: 'daily', valueRating: 5 }),
    sub('demo_premium', 'Canva Pro', 'produktivitas', 95000, -10, 20, { usageFrequency: 'monthly', valueRating: 4 }),
    sub('demo_premium', 'iCloud+ 50GB', 'cloud', 15000, -5, 25, { usageFrequency: 'daily', valueRating: 4 }),
    sub('demo_premium', 'Kelas Bahasa Inggris', 'pendidikan', 250000, -3, 2, {
      isFreeTrial: true,
      trialStartDate: at(-3),
      trialEndDate: at(2),
      firstChargeDate: at(2),
      priceAfterTrial: 250000,
      status: 'active',
    }),
    sub('demo_free', 'Netflix Basic', 'hiburan', 120000, -20, 10),
    sub('demo_free', 'Spotify Individual', 'hiburan', 54900, -15, 15),
    sub('demo_student', 'Spotify Pelajar', 'hiburan', 29900, -8, 22, { usageFrequency: 'daily' }),
  ];

  const payments: DemoPaymentRow[] = [];
  for (let m = 0; m < 6; m += 1) {
    const paidAt = at(-m * 30);
    payments.push({
      id: `demo_pay_${m}_a`,
      userId: 'demo_premium',
      subscriptionId: null,
      amount: 120000,
      paidAt,
      cycle: 'monthly',
      method: 'manual',
      note: 'Netflix Basic',
      isDemo: true,
      createdAt: paidAt,
    });
    payments.push({
      id: `demo_pay_${m}_b`,
      userId: 'demo_premium',
      subscriptionId: null,
      amount: 54900,
      paidAt,
      cycle: 'monthly',
      method: 'manual',
      note: 'Spotify Individual',
      isDemo: true,
      createdAt: paidAt,
    });
  }
  payments.push({
    id: 'demo_pay_free_1',
    userId: 'demo_free',
    subscriptionId: null,
    amount: 120000,
    paidAt: at(-20),
    cycle: 'monthly',
    method: 'manual',
    note: 'Netflix Basic',
    isDemo: true,
    createdAt: at(-20),
  });

  const budgets: DemoBudgetRow[] = [
    {
      id: 'demo_budget_premium',
      userId: 'demo_premium',
      monthlyLimit: 400000,
      warnAtPercent: 80,
      notes: 'Batas bulanan langganan.',
      createdAt: created,
      updatedAt: created,
    },
  ];

  const reminders: DemoReminderRow[] = users.map((u) => ({
    id: `demo_rem_${u.id}`,
    userId: u.id,
    defaultDaysBefore: 3,
    inAppEnabled: true,
    emailEnabled: false,
    emailVerified: false,
    updatedAt: created,
  }));

  const studentVerifications: DemoStudentVerificationRow[] =
    users
      .filter((u) => u.studentStatus !== 'none')
      .map((u) => ({
        id: 'demo_verif_student',
        userId: u.id,
        fullName: u.name,
        institution: 'Universitas Indonesia',
        studentNumber: '2106700000',
        studentEmail: u.email,
        note: 'Mahasiswa aktif semester 6.',
        status: u.studentStatus,
        reviewedAt: null,
        reviewNote: null,
        method: 'demo',
        createdAt: created,
        updatedAt: created,
      }));

  return { users, subscriptions, payments, categories: [], budgets, reminders, studentVerifications, memberships: [], billingEvents: [] };
}

// Simpan di globalThis supaya tidak di-reset saat hot reload dev.
const g = globalThis as unknown as { __whenlyDemoStore?: Store };
export const demoStore: Store = g.__whenlyDemoStore ?? (g.__whenlyDemoStore = seed());

export function demoResetStore(): void {
  g.__whenlyDemoStore = seed();
}

export function findDemoUserByEmail(email: string): DemoUserRow | null {
  return demoStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function findDemoUserById(id: string): DemoUserRow | null {
  return demoStore.users.find((u) => u.id === id) ?? null;
}

/** Token demo berbentuk `tok_<userId>` supaya stateless (tanpa tabel sesi). */
export function demoTokenFor(userId: string): string {
  return `tok_${userId}`;
}

export function demoUserFromToken(token: string | undefined): DemoUserRow | null {
  if (!token || !token.startsWith('tok_')) return null;
  return findDemoUserById(token.slice(4));
}
