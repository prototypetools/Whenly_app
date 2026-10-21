'use client';

export type DemoUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // plain for demo
  timezone: string;
  locale: string;
  avatarColor: string;
  planId: string;
  planCycle: string;
  planStartedAt: string;
  planExpiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  paymentStatus: string;
  studentStatus: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DemoSubscription = {
  id: string;
  userId: string;
  name: string;
  category: string;
  provider?: string | null;
  price: number;
  billingCycle: string;
  customPeriodDays?: number | null;
  startDate: string;
  nextRenewalDate: string;
  status: string;
  isFreeTrial: boolean;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  firstChargeDate?: string | null;
  priceAfterTrial?: number | null;
  reminderDaysBefore: number;
  reminderPriority: string;
  lastPaidAt?: string | null;
  paidThisCycle: boolean;
  usageFrequency?: string | null;
  valueRating?: number | null;
  benefitNotes?: string | null;
  notes?: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DemoSession = {
  id: string; // token hash style but just token for demo
  userId: string;
  expiresAt: string;
  userAgent?: string | null;
  ip?: string | null;
  createdAt: string;
};

type DemoData = {
  users: DemoUser[];
  subscriptions: DemoSubscription[];
  sessions: DemoSession[];
  categories: any[];
  payments: any[];
  budget: any | null;
  reminderSetting: any | null;
  memberships: any[];
  billingEvents: any[];
  studentVerifications: any[];
};

const KEY = 'whenly_demo_v1';

function now() {
  return new Date().toISOString();
}

function uid(prefix = 'demo') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function defaultData(): DemoData {
  const created = now();
  const users: DemoUser[] = [
    {
      id: 'demo_premium',
      email: 'demo@subscriptly.id',
      name: 'Rani Prasetya',
      passwordHash: 'demo12345',
      timezone: 'Asia/Jakarta',
      locale: 'id-ID',
      avatarColor: '#6d28d9',
      planId: 'premium',
      planCycle: 'monthly',
      planStartedAt: created,
      planExpiresAt: null,
      cancelAtPeriodEnd: false,
      paymentStatus: 'paid',
      studentStatus: 'none',
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: 'demo_free',
      email: 'gratis@subscriptly.id',
      name: 'Bima Nugraha',
      passwordHash: 'demo12345',
      timezone: 'Asia/Jakarta',
      locale: 'id-ID',
      avatarColor: '#2563eb',
      planId: 'free',
      planCycle: 'monthly',
      planStartedAt: created,
      planExpiresAt: null,
      cancelAtPeriodEnd: false,
      paymentStatus: 'none',
      studentStatus: 'none',
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: 'demo_student',
      email: 'pelajar@subscriptly.id',
      name: 'Sinta Maharani',
      passwordHash: 'demo12345',
      timezone: 'Asia/Jakarta',
      locale: 'id-ID',
      avatarColor: '#059669',
      planId: 'free',
      planCycle: 'monthly',
      planStartedAt: created,
      planExpiresAt: null,
      cancelAtPeriodEnd: false,
      paymentStatus: 'none',
      studentStatus: 'pending',
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    },
  ];

  const base = new Date();
  const addDays = (d: number) => new Date(base.getTime() + d * 86400000).toISOString();
  const subs: DemoSubscription[] = [
    {
      id: uid('sub'),
      userId: 'demo_premium',
      name: 'Netflix Basic',
      category: 'hiburan',
      provider: 'Netflix',
      price: 120000,
      billingCycle: 'monthly',
      startDate: addDays(-25),
      nextRenewalDate: addDays(5),
      status: 'active',
      isFreeTrial: false,
      reminderDaysBefore: 3,
      reminderPriority: 'normal',
      paidThisCycle: false,
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: uid('sub'),
      userId: 'demo_premium',
      name: 'Spotify Individual',
      category: 'hiburan',
      provider: 'Spotify',
      price: 54900,
      billingCycle: 'monthly',
      startDate: addDays(-18),
      nextRenewalDate: addDays(12),
      status: 'active',
      isFreeTrial: false,
      reminderDaysBefore: 3,
      reminderPriority: 'normal',
      paidThisCycle: false,
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: uid('sub'),
      userId: 'demo_premium',
      name: 'Canva Pro',
      category: 'produktivititas',
      provider: 'Canva',
      price: 95000,
      billingCycle: 'monthly',
      startDate: addDays(-10),
      nextRenewalDate: addDays(20),
      status: 'active',
      isFreeTrial: false,
      reminderDaysBefore: 3,
      reminderPriority: 'normal',
      paidThisCycle: false,
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: uid('sub'),
      userId: 'demo_free',
      name: 'Netflix Basic',
      category: 'hiburan',
      provider: 'Netflix',
      price: 120000,
      billingCycle: 'monthly',
      startDate: addDays(-20),
      nextRenewalDate: addDays(10),
      status: 'active',
      isFreeTrial: false,
      reminderDaysBefore: 3,
      reminderPriority: 'normal',
      paidThisCycle: false,
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: uid('sub'),
      userId: 'demo_free',
      name: 'Spotify Individual',
      category: 'hiburan',
      provider: 'Spotify',
      price: 54900,
      billingCycle: 'monthly',
      startDate: addDays(-15),
      nextRenewalDate: addDays(15),
      status: 'active',
      isFreeTrial: false,
      reminderDaysBefore: 3,
      reminderPriority: 'normal',
      paidThisCycle: false,
      isDemo: true,
      createdAt: created,
      updatedAt: created,
    },
  ];

  return {
    users,
    subscriptions: subs,
    sessions: [],
    categories: [],
    payments: [],
    budget: null,
    reminderSetting: null,
    memberships: [],
    billingEvents: [],
    studentVerifications: [],
  };
}

export function loadDemo(): DemoData {
  if (typeof window === 'undefined') return defaultData();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const d = defaultData();
      localStorage.setItem(KEY, JSON.stringify(d));
      return d;
    }
    return JSON.parse(raw) as DemoData;
  } catch {
    const d = defaultData();
    localStorage.setItem(KEY, JSON.stringify(d));
    return d;
  }
}

export function saveDemo(d: DemoData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(d));
}

export function findUserByEmail(email: string) {
  const d = loadDemo();
  return d.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function createSessionDemo(userId: string) {
  const d = loadDemo();
  const token = uid('tok');
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  d.sessions.push({ id: token, userId, expiresAt, createdAt: now() });
  saveDemo(d);
  return { token, expiresAt };
}

export function getSessionUser(token: string | undefined) {
  if (!token) return null;
  const d = loadDemo();
  const s = d.sessions.find((x) => x.id === token);
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() < Date.now()) return null;
  return d.users.find((u) => u.id === s.userId) || null;
}

export function clearSessionDemo(token: string | undefined) {
  if (!token) return;
  const d = loadDemo();
  d.sessions = d.sessions.filter((x) => x.id !== token);
  saveDemo(d);
}
