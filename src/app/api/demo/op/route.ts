import { ApiError, jsonError, jsonOk, readJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { getEntitlements } from '@/lib/plans';
import { isDemoBuild } from '@/lib/demo/constants';
import { demoStore, type DemoSubscriptionRow } from '@/lib/demo/dataset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ============================================================
 * Endpoint MUTASI mode demo
 * ============================================================
 * Saat `NEXT_PUBLIC_DEMO_MODE=true`, aplikasi tidak memakai database.
 * Semua tulis-menulis (langganan, budget, kategori, profil, dsb) diarahkan
 * ke endpoint ini, yang mengubah penyimpanan demo di memori server.
 *
 * Endpoint ini HANYA aktif pada build demo — pada produksi normal ia
 * menolak dengan 404 supaya tidak bisa dipakai untuk mem-bypass database.
 */

type Op =
  | { op: 'sub.create'; data: Record<string, unknown> }
  | { op: 'sub.update'; id: string; data: Record<string, unknown> }
  | { op: 'sub.delete'; id: string }
  | { op: 'sub.pay'; id: string; steps?: number }
  | { op: 'sub.extend'; id: string; steps?: number }
  | { op: 'budget.save'; monthlyLimit: number; warnAtPercent: number; notes?: string | null }
  | { op: 'category.create'; name: string; emoji: string; color: string }
  | { op: 'category.delete'; id: string }
  | { op: 'reminder.save'; defaultDaysBefore: number; inAppEnabled: boolean }
  | { op: 'profile.save'; name: string; timezone: string; avatarColor: string }
  | { op: 'student.submit'; fullName: string; institution: string; studentNumber: string; studentEmail?: string | null; note?: string | null }
  | { op: 'student.review'; id: string; decision: 'approved' | 'rejected'; reviewNote?: string | null }
  | { op: 'plan.select'; planId: string; cycle: string }
  | { op: 'plan.confirm'; planId: string; cycle: string }
  | { op: 'plan.cancelRenewal' }
  | { op: 'plan.resumeRenewal' }
  | { op: 'account.delete' };

const iso = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Tanggal (YYYY-MM-DD) dari sebuah Date. */
const isoOfDate = (d: Date): string => d.toISOString().slice(0, 10);

function toSubRow(userId: string, data: Record<string, unknown>): DemoSubscriptionRow {
  const created = new Date();
  return {
    id: `demo_sub_${Math.random().toString(36).slice(2, 10)}`,
    userId,
    name: String(data.name ?? 'Langganan'),
    category: String(data.category ?? 'lainnya'),
    provider: (data.provider as string) ?? null,
    price: Number(data.price ?? 0),
    billingCycle: String(data.billingCycle ?? 'monthly'),
    customPeriodDays: data.customPeriodDays == null ? null : Number(data.customPeriodDays),
    startDate: iso(data.startDate) ?? created,
    nextRenewalDate: iso(data.nextRenewalDate) ?? created,
    status: String(data.status ?? 'active'),
    isFreeTrial: Boolean(data.isFreeTrial),
    trialStartDate: iso(data.trialStartDate),
    trialEndDate: iso(data.trialEndDate),
    firstChargeDate: iso(data.firstChargeDate),
    priceAfterTrial: data.priceAfterTrial == null ? null : Number(data.priceAfterTrial),
    reminderDaysBefore: Number(data.reminderDaysBefore ?? 3),
    reminderPriority: String(data.reminderPriority ?? 'normal'),
    lastPaidAt: iso(data.lastPaidAt),
    paidThisCycle: Boolean(data.paidThisCycle),
    usageFrequency: (data.usageFrequency as string) ?? null,
    valueRating: data.valueRating == null ? null : Number(data.valueRating),
    benefitNotes: (data.benefitNotes as string) ?? null,
    notes: (data.notes as string) ?? null,
    isDemo: true,
    createdAt: created,
    updatedAt: created,
  };
}

function applySubPatch(row: DemoSubscriptionRow, data: Record<string, unknown>): void {
  const dateKeys: (keyof DemoSubscriptionRow)[] = ['startDate', 'nextRenewalDate', 'trialStartDate', 'trialEndDate', 'firstChargeDate', 'lastPaidAt'];
  for (const [key, value] of Object.entries(data)) {
    if (dateKeys.includes(key as keyof DemoSubscriptionRow)) {
      (row as unknown as Record<string, unknown>)[key] = iso(value);
    } else if (value !== undefined) {
      (row as unknown as Record<string, unknown>)[key] = value;
    }
  }
  row.isDemo = true;
  row.updatedAt = new Date();
}

export async function POST(request: Request) {
  try {
    if (!isDemoBuild()) {
      throw new ApiError(404, 'NOT_FOUND', 'Endpoint ini hanya tersedia pada mode demo.');
    }
    const user = await requireApiUser();
    const payload = (await readJson(request)) as Op;
    const op = payload?.op;

    switch (op) {
      case 'sub.create': {
        const row = toSubRow(user.id, payload.data);
        demoStore.subscriptions.push(row);
        const entitlements = await getEntitlements(user.id, user.planId);
        return jsonOk({ subscription: row, entitlements });
      }
      case 'sub.update': {
        const row = demoStore.subscriptions.find((s) => s.id === payload.id && s.userId === user.id);
        if (!row) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Langganan tidak ditemukan.');
        applySubPatch(row, payload.data);
        const entitlements = await getEntitlements(user.id, user.planId);
        return jsonOk({ subscription: row, entitlements });
      }
      case 'sub.delete': {
        const before = demoStore.subscriptions.length;
        demoStore.subscriptions = demoStore.subscriptions.filter((s) => !(s.id === payload.id && s.userId === user.id));
        if (demoStore.subscriptions.length === before) {
          throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Langganan tidak ditemukan.');
        }
        const entitlements = await getEntitlements(user.id, user.planId);
        return jsonOk({ deleted: true, id: payload.id, entitlements });
      }
      case 'sub.pay': {
        const row = demoStore.subscriptions.find((s) => s.id === payload.id && s.userId === user.id);
        if (!row) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Langganan tidak ditemukan.');
        const { addMonthsClamped } = await import('@/lib/dates');
        const base = isoOfDate(row.nextRenewalDate);
        const next = addMonthsClamped(base, Number(payload.steps ?? 1));
        row.paidThisCycle = true;
        row.lastPaidAt = new Date();
        row.nextRenewalDate = new Date(`${next}T00:00:00.000Z`);
        row.updatedAt = new Date();
        demoStore.payments.push({
          id: `demo_pay_${Math.random().toString(36).slice(2, 10)}`,
          userId: user.id,
          subscriptionId: row.id,
          amount: row.price,
          paidAt: new Date(),
          cycle: row.billingCycle,
          method: 'manual',
          note: row.name,
          isDemo: true,
          createdAt: new Date(),
        });
        const entitlements = await getEntitlements(user.id, user.planId);
        return jsonOk({ subscription: row, nextRenewal: next, entitlements });
      }
      case 'sub.extend': {
        const row = demoStore.subscriptions.find((s) => s.id === payload.id && s.userId === user.id);
        if (!row) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Langganan tidak ditemukan.');
        const { addMonthsClamped } = await import('@/lib/dates');
        const base = isoOfDate(row.nextRenewalDate);
        const next = addMonthsClamped(base, Number(payload.steps ?? 1));
        row.nextRenewalDate = new Date(`${next}T00:00:00.000Z`);
        row.updatedAt = new Date();
        return jsonOk({ subscription: row, nextRenewal: next });
      }
      case 'budget.save': {
        let row = demoStore.budgets.find((b) => b.userId === user.id);
        if (!row) {
          row = {
            id: `demo_budget_${Math.random().toString(36).slice(2, 10)}`,
            userId: user.id,
            monthlyLimit: payload.monthlyLimit,
            warnAtPercent: payload.warnAtPercent,
            notes: payload.notes ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          demoStore.budgets.push(row);
        } else {
          row.monthlyLimit = payload.monthlyLimit;
          row.warnAtPercent = payload.warnAtPercent;
          row.notes = payload.notes ?? null;
          row.updatedAt = new Date();
        }
        return jsonOk({ budget: row });
      }
      case 'category.create': {
        const id = `custom-${Math.random().toString(36).slice(2, 9)}`;
        const row = {
          id,
          userId: user.id,
          name: payload.name,
          emoji: payload.emoji,
          color: payload.color,
          isSystem: false,
          sortOrder: 200,
          createdAt: new Date(),
        };
        demoStore.categories.push(row);
        return jsonOk({ category: row });
      }
      case 'category.delete': {
        demoStore.categories = demoStore.categories.filter((c) => !(c.id === payload.id && c.userId === user.id));
        return jsonOk({ deleted: true, id: payload.id });
      }
      case 'reminder.save': {
        let row = demoStore.reminders.find((r) => r.userId === user.id);
        if (!row) {
          row = {
            id: `demo_rem_${user.id}`,
            userId: user.id,
            defaultDaysBefore: payload.defaultDaysBefore,
            inAppEnabled: payload.inAppEnabled,
            emailEnabled: false,
            emailVerified: false,
            updatedAt: new Date(),
          };
          demoStore.reminders.push(row);
        } else {
          row.defaultDaysBefore = payload.defaultDaysBefore;
          row.inAppEnabled = payload.inAppEnabled;
          row.updatedAt = new Date();
        }
        return jsonOk({ reminder: row });
      }
      case 'profile.save': {
        const row = demoStore.users.find((u) => u.id === user.id);
        if (!row) throw new ApiError(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
        row.name = payload.name;
        row.timezone = payload.timezone;
        row.avatarColor = payload.avatarColor;
        row.updatedAt = new Date();
        return jsonOk({ user: { id: row.id, name: row.name, timezone: row.timezone, avatarColor: row.avatarColor } });
      }
      case 'student.submit': {
        const row = {
          id: `demo_verif_${Math.random().toString(36).slice(2, 10)}`,
          userId: user.id,
          fullName: payload.fullName,
          institution: payload.institution,
          studentNumber: payload.studentNumber,
          studentEmail: payload.studentEmail ?? null,
          note: payload.note ?? null,
          status: 'pending',
          reviewedAt: null,
          reviewNote: null,
          method: 'demo',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        demoStore.studentVerifications.push(row);
        const userRow = demoStore.users.find((u) => u.id === user.id);
        if (userRow) {
          userRow.studentStatus = 'pending';
          userRow.updatedAt = new Date();
        }
        return jsonOk({ verification: row });
      }
      case 'student.review': {
        const row = demoStore.studentVerifications.find((v) => v.id === payload.id && v.userId === user.id);
        if (!row) throw new ApiError(404, 'VERIFICATION_NOT_FOUND', 'Pengajuan tidak ditemukan.');
        row.status = payload.decision;
        row.reviewNote = payload.reviewNote ?? null;
        row.reviewedAt = new Date();
        row.updatedAt = new Date();
        const userRow = demoStore.users.find((u) => u.id === user.id);
        if (userRow) {
          userRow.studentStatus = payload.decision;
          userRow.updatedAt = new Date();
        }
        return jsonOk({ verification: row });
      }
      case 'plan.select': {
        const { createCheckout, confirmCheckout } = await import('@/lib/billing');
        const checkout = await createCheckout(user.id, payload.planId, payload.cycle as 'monthly' | 'yearly');
        const activated = await confirmCheckout(user.id, checkout.checkoutId);
        return jsonOk({ checkout, activated });
      }
      case 'plan.confirm': {
        const { createCheckout, confirmCheckout } = await import('@/lib/billing');
        const checkout = await createCheckout(user.id, payload.planId, payload.cycle as 'monthly' | 'yearly');
        const activated = await confirmCheckout(user.id, checkout.checkoutId);
        return jsonOk({ checkout, activated });
      }
      case 'plan.cancelRenewal': {
        const { cancelRenewal } = await import('@/lib/billing');
        await cancelRenewal(user.id);
        return jsonOk({ cancelAtPeriodEnd: true });
      }
      case 'plan.resumeRenewal': {
        const { resumeRenewal } = await import('@/lib/billing');
        await resumeRenewal(user.id);
        return jsonOk({ cancelAtPeriodEnd: false });
      }
      case 'account.delete': {
        demoStore.subscriptions = demoStore.subscriptions.filter((s) => s.userId !== user.id);
        demoStore.payments = demoStore.payments.filter((p) => p.userId !== user.id);
        demoStore.budgets = demoStore.budgets.filter((b) => b.userId !== user.id);
        demoStore.categories = demoStore.categories.filter((c) => c.userId !== user.id);
        demoStore.studentVerifications = demoStore.studentVerifications.filter((v) => v.userId !== user.id);
        return jsonOk({ deleted: true });
      }
      default:
        throw new ApiError(400, 'UNKNOWN_DEMO_OP', 'Operasi demo tidak dikenal.');
    }
  } catch (error) {
    return jsonError(error);
  }
}
