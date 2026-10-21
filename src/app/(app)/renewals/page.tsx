import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getCustomCategories, getReminderSettings, getUserPayments, getUserSubscriptions } from '@/lib/queries';
import { buildAnalytics } from '@/lib/analytics';
import { getEntitlements } from '@/lib/plans';
import { getPlanLimits } from '@/config/plans';
import { categoryById, resolveCategories } from '@/lib/categories';
import { addMonthsClamped, countdownLabel, formatDateID, monthKeyFromDate, todayISO } from '@/lib/dates';
import { cycleLabel, isoOf, occurrencesInWindow, renewalItem } from '@/lib/subscriptions';
import { formatIDR } from '@/lib/money';
import { Badge, Card, CardHeader, EmptyState, InfoBanner, PageHeader, StatCard } from '@/components/ui/primitives';
import { MarkPaidButton } from '@/components/subscriptions/SubscriptionActions';
import { RenewalCalendar, type CalendarCharge } from '@/components/renewals/RenewalCalendar';
import { ReminderSettingsForm } from '@/components/forms/ReminderSettingsForm';

export const metadata: Metadata = { title: 'Renewal & Reminder' };
export const dynamic = 'force-dynamic';

const PRIORITY_META: Record<string, { label: string; tone: 'red' | 'amber' | 'slate' }> = {
  high: { label: 'Prioritas tinggi', tone: 'red' },
  normal: { label: 'Prioritas normal', tone: 'amber' },
  low: { label: 'Prioritas rendah', tone: 'slate' },
};

export default async function RenewalsPage() {
  const user = await requireUser();
  const today = todayISO();

  const [subscriptions, payments, customCategories, reminder] = await Promise.all([
    getUserSubscriptions(user.id),
    getUserPayments(user.id),
    getCustomCategories(user.id),
    getReminderSettings(user.id),
  ]);

  const entitlements = await getEntitlements(user.id, user.planId, {
    planExpiresAt: user.planExpiresAt,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    planCycle: user.planCycle,
  });
  const limits = getPlanLimits(user.planId);
  const analytics = buildAnalytics({ subscriptions, payments, categories: customCategories });
  const resolved = resolveCategories(customCategories);

  // ---- Data kalender: jadwal tagihan 3 bulan ke depan ----
  const calendarCharges: CalendarCharge[] = [];
  const rangeStart = today;
  const rangeEnd = addMonthsClamped(today, 3);

  for (const sub of subscriptions) {
    if (sub.status === 'canceled' || sub.status === 'expired') continue;
    const category = categoryById(resolved, sub.category);
    for (const occurrence of occurrencesInWindow(sub, rangeStart, rangeEnd)) {
      const item = renewalItem(sub, occurrence.date, today);
      calendarCharges.push({
        date: occurrence.date,
        subscriptionId: sub.id,
        name: sub.name,
        amount: occurrence.amount,
        categoryId: sub.category,
        emoji: category.emoji,
        priority: item.priority,
        paid: item.paid,
        isTrial: item.inTrial,
      });
    }
  }

  const buckets = [
    { key: 'overdue', title: 'Lewat jatuh tempo', tone: 'danger' as const, items: analytics.overdue },
    { key: 'today', title: 'Jatuh tempo hari ini', tone: 'warn' as const, items: analytics.dueToday },
    { key: 'd3', title: 'Dalam 3 hari', tone: 'warn' as const, items: analytics.dueIn3 },
    { key: 'd7', title: 'Dalam 7 hari', tone: 'info' as const, items: analytics.dueIn7 },
    { key: 'd30', title: 'Dalam 30 hari', tone: 'info' as const, items: analytics.dueIn30 },
  ];

  const upcoming30Total = analytics.dueIn30.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renewal & Reminder"
        subtitle="Lihat kapan uangmu akan terpotong, tandai pembayaran yang sudah dilakukan, dan atur seberapa awal kamu ingin diingatkan."
        actions={
          <Link href="/subscriptions?new=1" className="btn-secondary">
            + Tambah langganan
          </Link>
        }
      />

      <InfoBanner tone="warn" title="Pengingat hanya berjalan di dalam aplikasi">
        Whenly <strong>tidak</strong> mengirim email, WhatsApp, atau push notification karena belum ada layanan
        notifikasi dan scheduler yang terintegrasi pada prototype ini. Agar janji ini tidak palsu, opsi email sengaja
        dinonaktifkan (bukan disimulasikan) — silakan periksa dashboard secara berkala atau atur sendiri pengingat di
        kalender ponselmu.
      </InfoBanner>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tagihan 30 hari ke depan"
          value={formatIDR(upcoming30Total)}
          hint={`${analytics.dueIn30.length} tagihan terjadwal`}
          emoji="🗓"
          tone="violet"
        />
        <StatCard
          label="Jatuh tempo hari ini"
          value={String(analytics.dueToday.length)}
          hint={analytics.dueToday.length ? analytics.dueToday.map((i) => i.subscription.name).join(', ') : 'Tidak ada'}
          emoji="⏰"
          tone={analytics.dueToday.length ? 'amber' : 'green'}
        />
        <StatCard
          label="Lewat jatuh tempo"
          value={String(analytics.overdue.length)}
          hint={analytics.overdue.length ? `Total ${formatIDR(analytics.overdue.reduce((s, i) => s + i.amount, 0))}` : 'Semua tertib'}
          emoji="🚨"
          tone={analytics.overdue.length ? 'red' : 'green'}
        />
        <StatCard
          label="Trial berakhir ≤7 hari"
          value={String(analytics.trialsEndingSoon.length)}
          hint={
            analytics.trialsEndingSoon.length
              ? analytics.trialsEndingSoon.map((t) => t.subscription.name).join(', ')
              : 'Tidak ada trial yang segera berakhir'
          }
          emoji="⏳"
          tone={analytics.trialsEndingSoon.length ? 'amber' : 'green'}
        />
      </div>

      <RenewalCalendar charges={calendarCharges} initialMonth={monthKeyFromDate(new Date())} />

      <div className="grid gap-5 lg:grid-cols-2">
        {buckets.map((bucket) => (
          <Card key={bucket.key}>
            <CardHeader
              title={bucket.title}
              subtitle={`${bucket.items.length} tagihan${bucket.items.length ? ` · total ${formatIDR(bucket.items.reduce((sum, item) => sum + item.amount, 0))}` : ''}`}
              action={
                bucket.items.length ? (
                  <Link href={`/subscriptions?filter=${bucket.key}`} className="btn-ghost btn-sm">
                    Kelola
                  </Link>
                ) : undefined
              }
            />
            {bucket.items.length ? (
              <ul className="divide-y divide-brand-line">
                {bucket.items.map((item) => {
                  const category = categoryById(resolved, item.subscription.category);
                  const priority = PRIORITY_META[item.priority] ?? PRIORITY_META.normal;
                  return (
                    <li key={`${item.subscription.id}-${item.date}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span aria-hidden>{category.emoji}</span>
                          <span className="font-semibold text-brand-ink">{item.subscription.name}</span>
                          <Badge tone={priority.tone}>{priority.label}</Badge>
                          {item.inTrial ? <Badge tone="blue">Masih trial</Badge> : null}
                          {item.isFirstCharge ? <Badge tone="violet">Tagihan pertama</Badge> : null}
                          {item.paid ? <Badge tone="green">Lunas</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-brand-muted">
                          {formatDateID(item.date)} · {countdownLabel(item.daysLeft)} ·{' '}
                          {cycleLabel(item.subscription.billingCycle, item.subscription.customPeriodDays)} · reminder H-
                          {item.subscription.reminderDaysBefore}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tnum font-semibold text-brand-ink">{formatIDR(item.amount)}</span>
                        {!item.paid && !item.inTrial ? (
                          <MarkPaidButton
                            id={item.subscription.id}
                            name={item.subscription.name}
                            amountLabel={formatIDR(item.amount)}
                            nextRenewalLabel={formatDateID(item.date)}
                            compact
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                emoji="✅"
                title="Tidak ada tagihan di sini"
                description="Kelompok ini kosong untuk saat ini."
              />
            )}
          </Card>
        ))}
      </div>

      <ReminderSettingsForm
        initial={{
          defaultDaysBefore: reminder.defaultDaysBefore,
          inAppEnabled: reminder.inAppEnabled,
          emailEnabled: reminder.emailEnabled,
        }}
        isPremiumPlan={limits.advancedReminders}
      />

      <Card>
        <CardHeader
          title="Semua langganan & tanggal renewal-nya"
          subtitle="Satu baris per langganan, diurutkan dari yang paling dekat."
        />
        {analytics.upcoming.length ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th scope="col">Layanan</th>
                  <th scope="col">Renewal berikutnya</th>
                  <th scope="col">Hitung mundur</th>
                  <th scope="col">Siklus</th>
                  <th scope="col">Jumlah</th>
                  <th scope="col">Status bayar</th>
                </tr>
              </thead>
              <tbody>
                {analytics.upcoming.map((item) => (
                  <tr key={`${item.subscription.id}-row`}>
                    <td className="font-medium text-brand-ink">{item.subscription.name}</td>
                    <td>{formatDateID(item.date)}</td>
                    <td className={item.daysLeft < 0 ? 'font-semibold text-red-600' : undefined}>{countdownLabel(item.daysLeft)}</td>
                    <td>{cycleLabel(item.subscription.billingCycle, item.subscription.customPeriodDays)}</td>
                    <td className="tnum font-semibold">{formatIDR(item.amount)}</td>
                    <td>
                      {item.paid ? <Badge tone="green">Sudah dibayar</Badge> : item.inTrial ? <Badge tone="blue">Trial</Badge> : <Badge tone="amber">Belum dibayar</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            emoji="📅"
            title="Belum ada jadwal renewal"
            description="Tambahkan langganan dan tanggal renewal-nya untuk melihat hitung mundur di sini."
            action={
              <Link href="/subscriptions?new=1" className="btn-primary">
                + Tambah langganan
              </Link>
            }
          />
        )}
      </Card>

      <p className="text-xs text-brand-muted">
        Tanggal renewal di atas adalah jadwal yang <em>kamu catat</em> (estimasi satu siklus dari tanggal mulai). Penyedia
        layanan dapat mengubah tanggal penagihan sebenarnya — perbarui catatanmu bila berbeda. Paket{' '}
        {entitlements.planName} · zona waktu {user.timezone}.
      </p>
    </div>
  );
}
