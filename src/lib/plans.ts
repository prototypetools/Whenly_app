/**
 * Kontrol akses paket — DITEGAKKAN DI SERVER.
 * Setiap API route yang membuat/mengubah data wajib memanggil fungsi di sini.
 * Menyembunyikan tombol di UI saja tidak cukup.
 */

import { prisma } from './db';
import { isDemoBuild } from './demo/constants';
import { demoStore } from './demo/dataset';
import {
  BillingCycle,
  FAIR_USE_SOFT_CAP,
  getPlan,
  getPlanLimits,
  PlanId,
  PlanLimits,
  planPrice,
} from '@/config/plans';
import { ApiError } from './api';

export type FeatureKey = keyof PlanLimits;

const FEATURE_LABEL: Record<FeatureKey, string> = {
  maxActiveSubs: 'jumlah subscription aktif',
  csvExport: 'ekspor laporan CSV',
  advancedAnalytics: 'analitik lanjutan',
  budgetPlanner: 'budget planner',
  customCategories: 'kategori kustom',
  spendingHistory: 'riwayat pengeluaran',
  advancedReminders: 'pengaturan pengingat lengkap',
};

export interface Entitlements {
  planId: PlanId;
  planName: string;
  limits: PlanLimits;
  maxActiveSubs: number;
  /** Jumlah subscription yang saat ini memakai slot kuota. */
  usedSlots: number;
  remainingSlots: number | null;
  atLimit: boolean;
  expiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  cycle: BillingCycle;
}

export function isUnlimited(max: number | null): boolean {
  return max === null;
}

/** Efektif maksimum slot (fair use) supaya sistem tetap terlindungi. */
export function effectiveMaxSlots(max: number | null): number {
  return max === null ? FAIR_USE_SOFT_CAP : max;
}

export function countQuotaSlots(status: string): boolean {
  // Slot terpakai untuk semua catatan yang belum dibatalkan/diakhiri,
  // supaya batas paket tidak bisa dilewati hanya dengan menonaktifkan status.
  return status !== 'canceled' && status !== 'expired';
}

export async function getEntitlements(userId: string, planId: string, extra?: {
  planExpiresAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  planCycle?: string;
}): Promise<Entitlements> {
  const plan = getPlan(planId);
  const limits = getPlanLimits(planId);

  const usedSlots = isDemoBuild()
    ? demoStore.subscriptions.filter(
        (s) => s.userId === userId && s.status !== 'canceled' && s.status !== 'expired',
      ).length
    : await prisma.subscription.count({
        where: { userId, status: { notIn: ['canceled', 'expired'] } },
      });

  const maxActiveSubs = effectiveMaxSlots(limits.maxActiveSubs);

  return {
    planId: plan.id,
    planName: plan.name,
    limits,
    maxActiveSubs,
    usedSlots,
    remainingSlots: isUnlimited(limits.maxActiveSubs)
      ? null
      : Math.max(0, maxActiveSubs - usedSlots),
    atLimit: usedSlots >= maxActiveSubs,
    expiresAt: extra?.planExpiresAt ?? null,
    cancelAtPeriodEnd: extra?.cancelAtPeriodEnd ?? false,
    cycle: (extra?.planCycle as BillingCycle) ?? 'monthly',
  };
}

/** Melempar 403 bila paket pengguna tidak punya fitur tersebut. */
export function assertFeature(planId: string, feature: FeatureKey): void {
  const limits = getPlanLimits(planId);
  const value = limits[feature];
  if (value === false || value === 0) {
    const plan = getPlan(planId);
    throw new ApiError(
      403,
      'PLAN_FEATURE_LOCKED',
      `Fitur ${FEATURE_LABEL[feature]} tidak tersedia pada paket ${plan.name}. Upgrade ke Premium atau Student Plan untuk membukanya.`,
      { feature, planId: plan.id },
    );
  }
}

/**
 * Melempar 403 bila kuota subscription habis.
 * Dipakai saat membuat subscription baru ATAU mengaktifkan kembali yang nonaktif.
 */
export async function assertCanConsumeSlot(userId: string, planId: string, options: { isNewRecord: boolean }): Promise<void> {
  const entitlements = await getEntitlements(userId, planId);
  if (!options.isNewRecord) return; // mengganti status record lama tidak menambah slot
  if (entitlements.usedSlots >= entitlements.maxActiveSubs) {
    const plan = getPlan(planId);
    throw new ApiError(
      403,
      'PLAN_LIMIT_REACHED',
      `Paket ${plan.name} hanya mencatat maksimal ${entitlements.maxActiveSubs} subscription aktif. Hapus/arsipkan salah satu atau upgrade paket untuk melanjutkan.`,
      {
        planId: plan.id,
        maxActiveSubs: entitlements.maxActiveSubs,
        usedSlots: entitlements.usedSlots,
      },
    );
  }
}

export function assertPlanSelectable(planId: string, user: { studentStatus: string }): void {
  const plan = getPlan(planId);
  if (plan.id === 'student' && user.studentStatus !== 'approved') {
    throw new ApiError(
      403,
      'STUDENT_NOT_VERIFIED',
      'Paket Student hanya bisa dipilih setelah verifikasi status pelajar/mahasiswa disetujui.',
      { studentStatus: user.studentStatus },
    );
  }
}

export function planPricing(planId: string, cycle: BillingCycle) {
  const plan = getPlan(planId);
  return {
    planId: plan.id,
    planName: plan.name,
    cycle,
    price: planPrice(planId, cycle),
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
  };
}
