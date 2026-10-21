import { jsonError } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { getBudget, getCustomCategories, getReminderSettings, getUserPayments, getUserSubscriptions } from '@/lib/queries';
import { buildSubscriptionExportRow, jsonFilename, type ExportPayload } from '@/lib/export';
import { resolveCategories } from '@/lib/categories';
import { buildAnalytics } from '@/lib/analytics';
import { getPlan } from '@/config/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/export/json
 * Ekspor seluruh data akun (portabilitas data) — tersedia untuk SEMUA paket,
 * karena pengguna berhak mengunduh datanya sendiri.
 */
export async function GET() {
  try {
    const user = await requireApiUser();

    const [subscriptions, payments, customCategories, budget, reminder] = await Promise.all([
      getUserSubscriptions(user.id),
      getUserPayments(user.id),
      getCustomCategories(user.id),
      getBudget(user.id),
      getReminderSettings(user.id),
    ]);

    const categories = resolveCategories(
      customCategories.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        isSystem: c.isSystem,
        sortOrder: c.sortOrder,
      })),
    );

    const analytics = buildAnalytics({ subscriptions, payments, categories: customCategories });

    const payload: ExportPayload = {
      exportedAt: new Date().toISOString(),
      timezone: user.timezone,
      currency: 'IDR',
      app: 'Whenly',
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: getPlan(user.planId).name,
        planCycle: user.planCycle,
        planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString().slice(0, 10) : null,
        studentStatus: user.studentStatus,
        createdAt: user.createdAt.toISOString(),
      },
      summary: {
        subscriptions: subscriptions.length,
        activeCount: analytics.activeCount,
        monthlyTotal: analytics.monthlyTotal,
        yearlyTotal: analytics.yearlyTotal,
        paymentsCount: payments.length,
      },
      subscriptions: subscriptions.map((sub) => buildSubscriptionExportRow(sub, categories)),
      payments: payments.map((payment) => ({
        id: payment.id,
        subscriptionId: payment.subscriptionId,
        amount: payment.amount,
        paidAt: payment.paidAt.toISOString().slice(0, 10),
        cycle: payment.cycle,
        method: payment.method,
        note: payment.note,
        isDemo: payment.isDemo,
      })),
      budget: budget
        ? {
            monthlyLimit: budget.monthlyLimit,
            warnAtPercent: budget.warnAtPercent,
            notes: budget.notes,
            updatedAt: budget.updatedAt.toISOString(),
          }
        : null,
      reminderSettings: {
        defaultDaysBefore: reminder.defaultDaysBefore,
        inAppEnabled: reminder.inAppEnabled,
        emailEnabled: reminder.emailEnabled,
        emailAvailable: false,
        note: 'Email belum tersedia (belum ada layanan notifikasi yang terintegrasi).',
      },
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${jsonFilename('Whenly-data', payload.exportedAt.slice(0, 10))}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
