import { AppShell, type ShellUser } from '@/components/layout/AppShell';
import { requireUser } from '@/lib/auth';
import { getEntitlements } from '@/lib/plans';
import { daysFromToday, formatDateID, toISODate, todayISO } from '@/lib/dates';
import { isoOf } from '@/lib/subscriptions';
import { isDemoBuild } from '@/lib/demo/constants';
import { getUserSubscriptions } from '@/lib/queries';
import { formatIDR } from '@/lib/money';
import { ReminderPopup, type ReminderPopupItem } from '@/components/notifications/ReminderPopup';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const entitlements = await getEntitlements(user.id, user.planId, {
    planExpiresAt: user.planExpiresAt,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    planCycle: user.planCycle,
  });

  const shellUser: ShellUser = {
    name: user.name,
    email: user.email,
    planId: entitlements.planId,
    planName: entitlements.planName,
    isDemo: user.isDemo,
    studentStatus: user.studentStatus,
    usedSlots: entitlements.usedSlots,
    maxActiveSubs: entitlements.maxActiveSubs,
    remainingSlots: entitlements.remainingSlots,
    cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
    planExpiresAt: user.planExpiresAt ? formatDateID(isoOf(user.planExpiresAt)) : null,
  };

  // Pengingat pop-up: tagihan yang jatuh tempo dalam ambang milik pengguna.
  const today = todayISO();
  const subscriptions = await getUserSubscriptions(user.id);
  const dueItems: ReminderPopupItem[] = [];

  for (const sub of subscriptions) {
    if (sub.status !== 'active' || sub.paidThisCycle) continue;

    const threshold = Math.min(Math.max(sub.reminderDaysBefore ?? 3, 0), 14);
    const renewalISO = toISODate(sub.nextRenewalDate);
    const renewalIn = daysFromToday(renewalISO, today);
    const trialISO = sub.isFreeTrial && sub.trialEndDate ? toISODate(sub.trialEndDate) : null;
    const trialIn = trialISO ? daysFromToday(trialISO, today) : -1;

    const useTrial =
      Boolean(trialISO) &&
      trialIn >= 0 &&
      trialIn <= threshold &&
      (renewalIn < 0 || trialIn <= renewalIn);

    const daysLeft = useTrial ? trialIn : renewalIn;
    const dateISO = useTrial ? (trialISO as string) : renewalISO;

    if (daysLeft < 0 || daysLeft > threshold) continue;

    const amount = sub.isFreeTrial && sub.priceAfterTrial ? sub.priceAfterTrial : sub.price;
    dueItems.push({
      id: sub.id,
      name: sub.name,
      amountLabel: formatIDR(amount),
      dateLabel: formatDateID(dateISO),
      daysLeft,
      isTrial: useTrial,
    });
  }

  dueItems.sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <AppShell user={shellUser} demoMode={isDemoBuild()}>
      {children}
      <ReminderPopup items={dueItems.slice(0, 3)} />
    </AppShell>
  );
}
