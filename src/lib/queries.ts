/**
 * Query yang selalu ter-scope ke pengguna (isolasi data antar akun).
 * Setiap fungsi di sini WAJIB menerima userId dari sesi server.
 *
 * Mode demo: bila `NEXT_PUBLIC_DEMO_MODE=true`, fungsi di sini membaca
 * data dari penyimpanan demo di memori server (tanpa Prisma/DB sama
 * sekali). Bentuk objeknya identik dengan model Prisma, sehingga halaman
 * server yang sudah ada tidak perlu diubah.
 */

import { prisma } from './db';
import { ApiError } from './api';
import { isDemoBuild } from './demo/constants';
import { demoStore } from './demo/dataset';
import type { Subscription, Payment, Budget, ReminderSetting, Category, User } from '@prisma/client';

const demo = () => isDemoBuild();

export async function getUserSubscriptions(userId: string): Promise<Subscription[]> {
  if (demo()) {
    const rows = demoStore.subscriptions
      .filter((s) => s.userId === userId)
      .sort((a, b) =>
        a.status === b.status
          ? a.nextRenewalDate.getTime() - b.nextRenewalDate.getTime()
          : a.status.localeCompare(b.status),
      );
    return rows as unknown as Subscription[];
  }
  return prisma.subscription.findMany({
    where: { userId },
    orderBy: [{ status: 'asc' }, { nextRenewalDate: 'asc' }],
  });
}

export async function getSubscriptionForUser(userId: string, id: string): Promise<Subscription> {
  if (demo()) {
    const sub = demoStore.subscriptions.find((s) => s.id === id && s.userId === userId);
    if (!sub) {
      throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Langganan tidak ditemukan.');
    }
    return sub as unknown as Subscription;
  }
  const sub = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!sub) {
    // 404 (bukan 403) supaya keberadaan data pengguna lain tidak terungkap.
    throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Langganan tidak ditemukan.');
  }
  return sub;
}

export async function getUserPayments(userId: string): Promise<Payment[]> {
  if (demo()) {
    const rows = demoStore.payments
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
    return rows as unknown as Payment[];
  }
  return prisma.payment.findMany({ where: { userId }, orderBy: { paidAt: 'desc' } });
}

export async function getRecentPayments(userId: string, take = 100): Promise<Payment[]> {
  if (demo()) {
    const all = await getUserPayments(userId);
    return all.slice(0, take);
  }
  return prisma.payment.findMany({ where: { userId }, orderBy: { paidAt: 'desc' }, take });
}

export async function getUserCategories(userId: string): Promise<Category[]> {
  if (demo()) {
    const rows = demoStore.categories
      .filter((c) => c.userId === userId || c.isSystem)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'id'));
    return rows as unknown as Category[];
  }
  return prisma.category.findMany({
    where: { OR: [{ userId }, { isSystem: true }] },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getCustomCategories(userId: string): Promise<Category[]> {
  if (demo()) {
    const rows = demoStore.categories
      .filter((c) => c.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return rows as unknown as Category[];
  }
  return prisma.category.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } });
}

export async function getBudget(userId: string): Promise<Budget | null> {
  if (demo()) {
    const row = demoStore.budgets.find((b) => b.userId === userId) ?? null;
    return row as unknown as Budget | null;
  }
  return prisma.budget.findUnique({ where: { userId } });
}

/** Mengambil pengaturan pengingat, membuat default bila belum ada. */
export async function getReminderSettings(userId: string): Promise<ReminderSetting> {
  if (demo()) {
    let row = demoStore.reminders.find((r) => r.userId === userId);
    if (!row) {
      row = {
        id: `demo_rem_${userId}`,
        userId,
        defaultDaysBefore: 3,
        inAppEnabled: true,
        emailEnabled: false,
        emailVerified: false,
        updatedAt: new Date(),
      };
      demoStore.reminders.push(row);
    }
    return row as unknown as ReminderSetting;
  }
  const existing = await prisma.reminderSetting.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.reminderSetting.create({ data: { userId, defaultDaysBefore: 3, inAppEnabled: true } });
}

export async function getUserById(userId: string): Promise<User> {
  if (demo()) {
    const row = demoStore.users.find((u) => u.id === userId);
    if (!row) throw new ApiError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
    return row as unknown as User;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
  return user;
}

export async function getStudentVerification(userId: string) {
  if (demo()) {
    const row =
      demoStore.studentVerifications
        .filter((v) => v.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    return row;
  }
  return prisma.studentVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLatestStudentVerification(userId: string) {
  return getStudentVerification(userId);
}
