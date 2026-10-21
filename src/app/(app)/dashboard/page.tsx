import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getBudget, getCustomCategories, getUserPayments, getUserSubscriptions, getReminderSettings } from '@/lib/queries';
import { buildAnalytics } from '@/lib/analytics';
import { getEntitlements } from '@/lib/plans';
import { getPlanLimits } from '@/config/plans';
import { formatIDR, formatNumberID, formatPercent } from '@/lib/money';
import { countdownLabel, formatDateID, nowLabelID, todayISO } from '@/lib/dates';
import { cycleLabel, isoOf } from '@/lib/subscriptions';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  InfoBanner,
  LinkButton,
  PageHeader,
  ProgressBar,
  StatCard,
} from '@/components/ui/primitives';
import { CategoryDonut, MonthlyBarChart } from '@/components/charts/Charts';
import { MarkPaidButton } from '@/components/subscriptions/SubscriptionActions';
import { categoryById, resolveCategories } from '@/lib/categories';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const PRIORITY_LABEL: Record<string, { label: string; tone: 'red' | 'amber' | 'slate' }> = {
  high: { label: 'Prioritas tinggi', tone: 'red' },
  normal: { label: 'Prioritas normal', tone: 'amber' },
  low: { label: 'Prioritas rendah', tone: 'slate' },
};

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayISO();

  const [subscriptions, payments, customCategories, budget, reminder] = await Promise.all([
    getUserSubscriptions(user.id),
    getUserPayments(user.id),
    getCustomCategories(user.id),
    getBudget(user.id),
    getReminderSettings(user.id),
  ]);

  const entitlements = await getEntitlements(user.id, user.planId, {
    planExpiresAt: user.planExpiresAt,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    planCycle: user.planCycle,
  });

  const limits = getPlanLimits(user.planId);
  const analytics = buildAnalytics({ subscriptions, payments, categories: customCategories });
  const resolvedCategories = resolveCategories(customCategories);
  const categoryList = [...analytics.categoryBreakdown];

  const monthlyBudget = budget?.monthlyLimit ?? null;
  const remaining = monthlyBudget !== null ? monthlyBudget - analytics.monthlyTotal : null;
  const usedPercent = monthlyBudget ? (analytics.monthlyTotal / monthlyBudget) * 100 : 0;
  const overBudget = remaining !== null && remaining < 0;
  const nearBudget = monthlyBudget ? usedPercent >= (budget?.warnAtPercent ?? 80) : false;

  const upcomingSoon = analytics.upcoming.filter((item) => item.daysLeft <= 7);
  const endingSoon = analytics.trials.filter((trial) => trial.status !== 'ended' && trial.daysLeft <= 3);
  const overdue = analytics.overdue;

  const empty = subscriptions.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${user.name.split(' ')[0]} 👋`}
        subtitle={`${nowLabelID()} · ringkasan langgananmu dihitung langsung dari data yang tercatat.`}
        actions={
          <>
            <LinkButton href="/subscriptions" variant="secondary">
              Kelola langganan
            </LinkButton>
            <LinkButton href="/subscriptions?new=1">+ Tambah langganan</LinkButton>
          </>
        }
      />

      {user.isDemo ? (
        <div className="demo-banner">
          <span className="font-semibold">Akun demo.</span>
          <span>
            Semua langganan di akun ini ditandai <strong>DEMO</strong>. Kamu bebas mengubah atau menghapusnya untuk
            mencoba fitur. Untuk mengembalikan data awal, jalankan <code className="rounded bg-white/70 px-1.5 py-0.5">npm run db:seed</code>.
          </span>
        </div>
      ) : null}

      {entitlements.planId === 'free' && entitlements.atLimit ? (
        <InfoBanner tone="warn" title={`Kuota paket Free tercapai (${entitlements.usedSlots}/${entitlements.maxActiveSubs} slot)`}>
          Kamu masih bisa mengubah dan menghapus data yang ada, tetapi menambah langganan baru akan ditolak server.
          Hapus/arsipkan salah satu, atau{' '}
          <Link href="/pricing" className="font-semibold underline">
            upgrade paket
          </Link>
          .
        </InfoBanner>
      ) : null}

      {overBudget ? (
        <InfoBanner tone="danger" title="Anggaran bulanan terlampaui">
          Total estimasi bulanan {formatIDR(analytics.monthlyTotal)} melebihi anggaran {formatIDR(monthlyBudget ?? 0)}{' '}
          (kelebihan {formatIDR(Math.abs(remaining ?? 0))}). Tinjau langganan yang jarang dipakai di{' '}
          <Link href="/analytics" className="font-semibold underline">
            Analitik
          </Link>
          .
        </InfoBanner>
      ) : null}

      {overdue.length ? (
        <InfoBanner tone="warn" title={`${overdue.length} tagihan sudah melewati jatuh tempo`}>
          {overdue.slice(0, 3).map((item) => `${item.subscription.name} (${countdownLabel(item.daysLeft)})`).join(', ')}
          {overdue.length > 3 ? `, dan ${overdue.length - 3} lainnya` : ''}. Buka{' '}
          <Link href="/renewals" className="font-semibold underline">
            Renewal &amp; Reminder
          </Link>{' '}
          untuk menandainya sudah dibayar.
        </InfoBanner>
      ) : null}

      {/* ---- Kartu statistik ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Langganan aktif"
          value={formatNumberID(analytics.activeCount)}
          hint={`${analytics.billableCount} dihitung ke pengeluaran · ${analytics.pausedCount} nonaktif`}
          emoji="🧾"
          tone="violet"
        />
        <StatCard
          label="Estimasi bulanan"
          value={formatIDR(analytics.monthlyTotal)}
          hint={`Rata-rata ${formatIDR(analytics.averageMonthlyPerActive)} per langganan aktif`}
          emoji="📆"
          tone="blue"
        />
        <StatCard
          label="Estimasi tahunan"
          value={formatIDR(analytics.yearlyTotal)}
          hint={`Setara ${formatIDR(analytics.dailyTotal)} per hari`}
          emoji="🗓"
          tone="green"
        />
        {monthlyBudget !== null ? (
          <StatCard
            label="Sisa anggaran bulan ini"
            value={formatIDR(remaining ?? 0)}
            hint={
              <>
                {formatPercent(usedPercent, 1)} dari {formatIDR(monthlyBudget)} terpakai
                {analytics.trialPendingMonthly > 0 ? ` · trial akan menambah ${formatIDR(analytics.trialPendingMonthly)}/bulan` : ''}
              </>
            }
            emoji={overBudget ? '🚨' : '🎯'}
            tone={overBudget ? 'red' : nearBudget ? 'amber' : 'green'}
            footer={
              monthlyBudget ? (
                <ProgressBar percent={usedPercent} tone={overBudget ? 'red' : nearBudget ? 'amber' : 'green'} />
              ) : null
            }
          />
        ) : (
          <StatCard
            label="Budget planner"
            value={limits.budgetPlanner ? 'Belum diatur' : '🔒 Premium'}
            hint={
              limits.budgetPlanner
                ? 'Tetapkan batas bulanan untuk memantau sisa anggaran.'
                : 'Paket Free belum bisa memakai budget planner.'
            }
            emoji="🎯"
            tone="amber"
            footer={
              <LinkButton href="/budget" variant="secondary" className="btn-sm">
                {limits.budgetPlanner ? 'Atur anggaran' : 'Lihat paket'}
              </LinkButton>
            }
          />
        )}
      </div>

      {empty ? (
        <Card>
          <EmptyState
            emoji="🌱"
            title="Belum ada langganan tercatat"
            description="Mulai dengan menambahkan langganan pertamamu — misalnya Spotify, Netflix, atau Canva. Semua perhitungan di dashboard akan muncul otomatis."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/subscriptions?new=1">+ Tambah langganan</LinkButton>
                <LinkButton href="/pricing" variant="secondary">
                  Lihat paket &amp; harga
                </LinkButton>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          {/* ---- Grafik ---- */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader
                title="Proyeksi pengeluaran 12 bulan"
                subtitle="Dihitung dari jadwal tagihan tiap langganan, termasuk trial yang akan berubah menjadi tagihan."
                action={
                  <Link href="/analytics" className="btn-secondary btn-sm">
                    Analitik lengkap
                  </Link>
                }
              />
              <div className="p-4">
                <MonthlyBarChart data={analytics.next12Months} height={280} />
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Kategori pengeluaran" subtitle="Berdasarkan biaya berjalan (estimasi bulanan)." />
              <div className="p-4">
                <CategoryDonut
                  data={categoryList.map((row) => ({ name: row.name, value: row.monthly, color: row.color }))}
                  height={280}
                />
                <ul className="mt-3 space-y-2">
                  {categoryList.map((row) => (
                    <li key={row.categoryId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden>{row.emoji}</span>
                        <span className="truncate font-medium text-brand-ink">{row.name}</span>
                        <span className="text-xs text-brand-muted">({row.count})</span>
                      </span>
                      <span className="tnum shrink-0 font-semibold text-brand-ink">{formatIDR(row.monthly)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          {/* ---- Renewal terdekat + trial ---- */}
          <div className="grid gap-5 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader
                title="Tagihan terdekat (7 hari)"
                subtitle={`${analytics.dueToday.length} jatuh tempo hari ini · ${analytics.dueIn7.length} dalam 7 hari`}
                action={
                  <Link href="/renewals" className="btn-secondary btn-sm">
                    Semua renewal
                  </Link>
                }
              />
              {upcomingSoon.length ? (
                <ul className="divide-y divide-brand-line">
                  {upcomingSoon.slice(0, 6).map((item) => {
                    const category = categoryById(resolvedCategories, item.subscription.category);
                    return (
                      <li key={`${item.subscription.id}-${item.date}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base" aria-hidden>
                              {category.emoji}
                            </span>
                            <span className="font-semibold text-brand-ink">{item.subscription.name}</span>
                            {item.subscription.isDemo ? <Badge tone="amber">DEMO</Badge> : null}
                            {item.inTrial ? <Badge tone="blue">Masih trial</Badge> : null}
                            {item.paid ? <Badge tone="green">Sudah dibayar</Badge> : null}
                          </div>
                          <p className="mt-0.5 text-xs text-brand-muted">
                            {formatDateID(item.date)} · {countdownLabel(item.daysLeft)} · {cycleLabel(item.subscription.billingCycle, item.subscription.customPeriodDays)} ·{' '}
                            {PRIORITY_LABEL[item.priority]?.label ?? 'Prioritas normal'}
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
                  emoji="😌"
                  title="Tidak ada tagihan dalam 7 hari ke depan"
                  description="Semua aman untuk sekarang. Pengingat akan muncul di sini saat tanggalnya makin dekat."
                />
              )}
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Free trial"
                subtitle={analytics.trialRunningCount ? `${analytics.trialRunningCount} trial sedang berjalan` : 'Tidak ada trial berjalan'}
                action={
                  <Link href="/trials" className="btn-secondary btn-sm">
                    Detail
                  </Link>
                }
              />
              {analytics.trials.length ? (
                <ul className="divide-y divide-brand-line">
                  {analytics.trials.slice(0, 5).map((trial) => (
                    <li key={trial.subscription.id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-brand-ink">{trial.subscription.name}</span>
                        <Badge tone={trial.status === 'ended' ? 'slate' : trial.daysLeft <= 3 ? 'red' : 'blue'}>
                          {trial.status === 'ended' ? 'Sudah berakhir' : countdownLabel(trial.daysLeft)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-brand-muted">
                        Berakhir {formatDateID(trial.endDate)} · tagihan pertama{' '}
                        {trial.firstChargeDate ? formatDateID(trial.firstChargeDate) : '—'} · setelah trial{' '}
                        {formatIDR(trial.priceAfterTrial)}/siklus
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  emoji="⏳"
                  title="Belum ada free trial"
                  description="Catat layanan yang sedang kamu coba gratis agar tidak kaget saat tagihan pertama muncul."
                />
              )}
              {endingSoon.length ? (
                <div className="border-t border-brand-line p-4">
                  <InfoBanner tone="warn" title={`${endingSoon.length} trial berakhir ≤3 hari`}>
                    Tentukan sekarang: lanjutkan berlangganan, atau batalkan langsung di aplikasi penyedianya.
                    Whenly <strong>tidak</strong> bisa membatalkan langganan secara otomatis (belum ada integrasi
                    dengan penyedia layanan).
                  </InfoBanner>
                </div>
              ) : null}
            </Card>
          </div>

          {/* ---- Value checker ---- */}
          <Card>
            <CardHeader
              title="Value checker — layanan yang perlu ditinjau"
              subtitle="Berdasarkan frekuensi pemakaian dan nilai manfaat yang kamu catat. Tidak ada pembatalan otomatis."
              action={
                <Link href="/analytics#value-checker" className="btn-secondary btn-sm">
                  Kelola penilaian
                </Link>
              }
            />
            {analytics.valueFlags.length ? (
              <ul className="divide-y divide-brand-line">
                {analytics.valueFlags.slice(0, 5).map((flag) => (
                  <li key={flag.subscription.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {flag.severity === 'high' ? <Badge tone="red">Tinjau segera</Badge> : <Badge tone="amber">Perlu ditinjau</Badge>}
                        <span className="font-semibold text-brand-ink">{flag.subscription.name}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-brand-muted">
                        {flag.reason} · estimasi {formatIDR(flag.monthlyCost)}/bulan
                        {flag.subscription.valueRating ? ` · nilai ${flag.subscription.valueRating}/5` : ''}
                      </p>
                    </div>
                    <Link href={`/subscriptions?edit=${flag.subscription.id}`} className="btn-secondary btn-sm">
                      Tinjau
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                emoji="👍"
                title="Semua layananmu terpakai"
                description="Tidak ada langganan yang ditandai jarang dipakai atau bernilai rendah."
              />
            )}
          </Card>

          {/* ---- Ringkasan cepat ---- */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="card-pad">
              <p className="section-title">Bulanan vs tahunan</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-brand-muted">Estimasi bulanan</dt>
                  <dd className="tnum font-semibold">{formatIDR(analytics.monthlyTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-brand-muted">Estimasi tahunan</dt>
                  <dd className="tnum font-semibold">{formatIDR(analytics.yearlyTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-brand-muted">Setara mingguan</dt>
                  <dd className="tnum font-semibold">{formatIDR(analytics.weeklyTotal)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-brand-muted">
                Normalisasi: mingguan ×52÷12 · tahunan ÷12 · interval kustom memakai panjang periode dalam hari.
              </p>
            </Card>

            <Card className="card-pad">
              <p className="section-title">Jika trial menjadi tagihan</p>
              {analytics.trialPendingMonthly > 0 ? (
                <>
                  <p className="tnum mt-3 text-2xl font-bold text-brand-ink">{formatIDR(analytics.trialPendingMonthly)}</p>
                  <p className="text-xs text-brand-muted">tambahan per bulan setelah semua trial berakhir</p>
                  <p className="tnum mt-3 text-sm text-brand-muted">
                    Total menjadi {formatIDR(analytics.monthlyTotal + analytics.trialPendingMonthly)}/bulan
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-brand-muted">Tidak ada trial yang akan berubah menjadi tagihan.</p>
              )}
            </Card>

            <Card className="card-pad">
              <p className="section-title">Pengingat aktif</p>
              <p className="mt-3 text-sm text-brand-ink">
                Pengingat dalam aplikasi:{' '}
                <strong>{reminder.inAppEnabled ? 'aktif' : 'nonaktif'}</strong> · default H-{reminder.defaultDaysBefore}
              </p>
              <p className="mt-2 text-xs text-brand-muted">
                Pengingat email <strong>belum tersedia</strong> karena belum ada layanan notifikasi yang terintegrasi.
                Lihat pengaturannya di halaman Renewal.
              </p>
              <div className="mt-3">
                <LinkButton href="/renewals" variant="secondary" className="btn-sm">
                  Atur pengingat
                </LinkButton>
              </div>
            </Card>
          </div>
        </>
      )}

      <p className="text-xs text-brand-muted">
        Terakhir dihitung: {today} (Asia/Jakarta). Semua estimasi diberi label <em>estimasi</em> karena tanggal dan harga
        dapat berubah dari sisi penyedia layanan.
      </p>
    </div>
  );
}
