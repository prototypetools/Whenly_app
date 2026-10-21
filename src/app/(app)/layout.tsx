import { AppShell, type ShellUser } from '@/components/layout/AppShell';
import { requireUser } from '@/lib/auth';
import { getEntitlements } from '@/lib/plans';
import { formatDateID } from '@/lib/dates';
import { isoOf } from '@/lib/subscriptions';

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

  return <AppShell user={shellUser}>{children}</AppShell>;
}
