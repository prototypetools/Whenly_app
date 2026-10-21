import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getCustomCategories, getReminderSettings, getUserSubscriptions } from '@/lib/queries';
import { getEntitlements } from '@/lib/plans';
import { PageHeader } from '@/components/ui/primitives';
import { SubscriptionsClient, type EntitlementInfo, type SubscriptionRow } from '@/components/subscriptions/SubscriptionsClient';

export const metadata: Metadata = { title: 'Langganan Saya' };
export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: { new?: string; edit?: string; filter?: string };
}) {
  const user = await requireUser();

  const [subscriptions, customCategories, reminder] = await Promise.all([
    getUserSubscriptions(user.id),
    getCustomCategories(user.id),
    getReminderSettings(user.id),
  ]);

  const entitlements = await getEntitlements(user.id, user.planId, {
    planExpiresAt: user.planExpiresAt,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    planCycle: user.planCycle,
  });

  const entitlementsInfo: EntitlementInfo = {
    planId: entitlements.planId,
    planName: entitlements.planName,
    usedSlots: entitlements.usedSlots,
    maxActiveSubs: entitlements.maxActiveSubs,
    remainingSlots: entitlements.remainingSlots,
    atLimit: entitlements.atLimit,
    csvExport: entitlements.limits.csvExport,
    customCategories: entitlements.limits.customCategories,
  };

  // Hanya kirim field yang dibutuhkan tabel (memperkecil payload RSC).
  const rows: SubscriptionRow[] = subscriptions.map((sub) => ({
    id: sub.id,
    name: sub.name,
    category: sub.category,
    provider: sub.provider,
    price: sub.price,
    billingCycle: sub.billingCycle,
    customPeriodDays: sub.customPeriodDays,
    startDate: sub.startDate,
    nextRenewalDate: sub.nextRenewalDate,
    status: sub.status,
    isFreeTrial: sub.isFreeTrial,
    trialStartDate: sub.trialStartDate,
    trialEndDate: sub.trialEndDate,
    firstChargeDate: sub.firstChargeDate,
    priceAfterTrial: sub.priceAfterTrial,
    reminderDaysBefore: sub.reminderDaysBefore,
    reminderPriority: sub.reminderPriority,
    usageFrequency: sub.usageFrequency,
    valueRating: sub.valueRating,
    benefitNotes: sub.benefitNotes,
    notes: sub.notes,
    paidThisCycle: sub.paidThisCycle,
    isDemo: sub.isDemo,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Langganan Saya"
        subtitle="Semua langganan yang kamu catat, lengkap dengan estimasi biaya bulanan dan tahunan. Estimasi dihitung dari siklus pembayaran masing-masing layanan."
      />

      <SubscriptionsClient
        subscriptions={rows}
        customCategories={customCategories.map((category) => ({
          id: category.id,
          name: category.name,
          emoji: category.emoji,
          color: category.color,
          isSystem: category.isSystem,
          sortOrder: category.sortOrder,
        }))}
        entitlements={entitlementsInfo}
        defaultReminderDays={reminder.defaultDaysBefore}
        initialCreate={searchParams.new === '1'}
        initialEditId={searchParams.edit ?? null}
      />
    </div>
  );
}
