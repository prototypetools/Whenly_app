import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getCustomCategories, getUserPayments, getUserSubscriptions } from '@/lib/queries';
import { buildAnalytics, recurringSplit } from '@/lib/analytics';
import { getPlan, getPlanLimits } from '@/config/plans';
import { resolveCategories, categoryById } from '@/lib/categories';
import { formatIDR, formatPercent, safePercent } from '@/lib/money';
import { monthKeyFromDate, todayISO } from '@/lib/dates';
import { monthlyEquivalent } from '@/lib/subscriptions';
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
  KeyValue,
} from '@/components/ui/primitives';
import { CategoryDonut, ComparisonBarChart, MonthlyBarChart, PaymentHistoryChart, TrendLineChart } from '@/components/charts/Charts';
import { ValueChecker, type ValueItem } from '@/components/analytics/ValueChecker';
import { ExportButtons } from '@/components/forms/ExportButtons';

export const metadata: Metadata = { title: 'Analitik Pengeluaran' };
export const dynamic = 'force-dynamic';

/** Pratinjau terkunci untuk paket Free: menjelaskan isi fitur tanpa memberi data. */
function LockedAnalytics({ planName }: { planName: string }) {
  return (
    <div className="space-y-6">
      <InfoBanner tone="warn" title="Analitik lanjutan tersedia pada paket Premium/Student">
        Paket <strong>{planName}</strong> menampilkan ringkasan dasar di dashboard (jumlah langganan, total bulanan,
        daftar renewal). Grafik tren, riwayat pengeluaran, perbandingan bulanan vs tahunan, ekspor CSV, dan penilaian
        value checker lengkap tersedia setelah upgrade.
      </InfoBanner>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tren pengeluaran 12 bulan" subtitle="Pratinjau (data tidak ditampilkan pada paket Free)." />
          <div className="relative p-4">
            <div className="pointer-events-none select-none blur-sm">
              <div className="flex h-[280px] items-end gap-2 px-2">
                {[42, 55, 48, 61, 70, 64, 58, 72, 80, 74, 88, 95].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-lg bg-gradient-to-t from-violet-300 to-violet-100" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/70 text-center">
              <span className="text-2xl">🔒</span>
              <p className="text-sm font-semibold text-brand-ink">Grafik tren &amp; riwayat pembayaran</p>
              <LinkButton href="/pricing">Buka dengan Premium</LinkButton>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Perbandingan bulanan vs tahunan" subtitle="Pratinjau." />
          <div className="relative p-4">
            <div className="pointer-events-none select-none space-y-3 blur-sm">
              {[70, 45, 88, 35, 60].map((width, index) => (
                <div key={index} className="h-6 rounded-lg bg-gradient-to-r from-blue-200 to-violet-200" style={{ width: `${width}%` }} />
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/70 text-center">
              <span className="text-2xl">🔒</span>
              <p className="text-sm font-semibold text-brand-ink">Simulasi hemat tahunan</p>
              <LinkButton href="/pricing">Lihat paket</LinkButton>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Yang kamu dapatkan di paket berbayar" />
        <ul className="grid gap-3 p-5 text-sm sm:grid-cols-2">
          {[
            'Grafik tren: pembayaran nyata vs proyeksi tagihan 12 bulan',
            'Riwayat pengeluaran per bulan dari pembayaran yang tercatat',
            'Perbandingan simulasi bulanan vs tahunan per layanan',
            'Breakdown kategori lengkap dengan persentase',
            'Ekspor CSV langganan & riwayat pembayaran',
            'Value checker lengkap untuk meninjau langganan jarang dipakai',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-emerald-600">✓</span>
              <span className="text-brand-ink">{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const limits = getPlanLimits(user.planId);

  const [subscriptions, payments, customCategories] = await Promise.all([
    getUserSubscriptions(user.id),
    getUserPayments(user.id),
    getCustomCategories(user.id),
  ]);

  const analytics = buildAnalytics({ subscriptions, payments, categories: customCategories });
  const resolved = resolveCategories(customCategories);
  const split = recurringSplit(subscriptions);

  const valueItems: ValueItem[] = subscriptions
    .filter((sub) => sub.status === 'active')
    .map((sub) => {
      const flag = analytics.valueFlags.find((f) => f.subscription.id === sub.id);
      return {
        id: sub.id,
        name: sub.name,
        monthly: Math.round(monthlyEquivalent(sub)),
        usageFrequency: sub.usageFrequency,
        valueRating: sub.valueRating,
        severity: flag ? flag.severity : null,
        reason: flag ? flag.reason : null,
        status: sub.status,
      };
    })
    .sort((a, b) => b.monthly - a.monthly);

  const trendData = analytics.last12Months.map((point) => ({
    label: point.label,
    actual: point.actual,
    projected: point.projected,
  }));

  const yearlyIfMonthly = analytics.monthlyTotal * 12;
  const savingFromYearly = Math.max(0, yearlyIfMonthly - analytics.yearlyTotal);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analitik Pengeluaran"
        subtitle="Semua angka di halaman ini dihitung dari data yang kamu catat: jadwal siklus langganan dan pembayaran yang sudah kamu tandai lunas."
        actions={<ExportButtons csvUnlocked={limits.csvExport} />}
      />

      {!limits.advancedAnalytics ? (
        <LockedAnalytics planName={getPlan(user.planId).name} />
      ) : subscriptions.length === 0 ? (
        <Card>
          <EmptyState
            emoji="📈"
            title="Belum ada data untuk dianalisis"
            description="Tambahkan langganan pertamamu, lalu analitik akan terisi otomatis."
            action={<LinkButton href="/subscriptions?new=1">+ Tambah langganan</LinkButton>}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Biaya berjalan per bulan" value={formatIDR(analytics.monthlyTotal)} emoji="📆" tone="violet" hint={`${analytics.billableCount} langganan berbayar aktif`} />
            <StatCard label="Proyeksi per tahun" value={formatIDR(analytics.yearlyTotal)} emoji="🗓" tone="blue" hint={`Rata-rata ${formatIDR(analytics.averageMonthlyPerActive)}/langganan`} />
            <StatCard label="Sudah dibayar (12 bulan)" value={formatIDR(analytics.paidTotal12Months)} emoji="✅" tone="green" hint={`${analytics.paidHistory.reduce((sum, p) => sum + p.count, 0)} pembayaran tercatat`} />
            <StatCard
              label="Potensi hemat"
              value={formatIDR(savingFromYearly)}
              emoji="💡"
              tone={savingFromYearly > 0 ? 'amber' : 'green'}
              hint="Selisih jika semua langganan dibayar tahunan (perkiraan kasar)"
            />
          </div>

          {analytics.trialPendingMonthly > 0 ? (
            <InfoBanner tone="info" title="Trial yang akan menjadi tagihan">
              Setelah semua trial yang berjalan berakhir, perkiraan pengeluaranmu bertambah sekitar{' '}
              <strong>{formatIDR(analytics.trialPendingMonthly)}/bulan</strong> (menjadi{' '}
              {formatIDR(analytics.monthlyTotal + analytics.trialPendingMonthly)}/bulan). Lihat detailnya di{' '}
              <Link href="/trials" className="font-semibold underline">
                Pelacak Free Trial
              </Link>
              .
            </InfoBanner>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Tren 12 bulan: pembayaran nyata vs proyeksi"
                subtitle="Garis biru = pembayaran yang kamu tandai lunas. Garis putus-putus ungu = tagihan terjadwal dari siklus langganan."
              />
              <div className="p-4">
                <TrendLineChart data={trendData} height={300} />
              </div>
              <div className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
                Total dibayar 12 bulan terakhir: <strong>{formatIDR(analytics.paidTotal12Months)}</strong> · rata-rata{' '}
                <strong>{formatIDR(analytics.averagePaidPerMonth)}</strong>/bulan.
              </div>
            </Card>

            <Card>
              <CardHeader title="Breakdown kategori" subtitle="Berdasarkan biaya berjalan per bulan." />
              <div className="p-4">
                <CategoryDonut
                  data={analytics.categoryBreakdown.map((row) => ({ name: row.name, value: row.monthly, color: row.color }))}
                  height={240}
                />
                <ul className="mt-4 space-y-3">
                  {analytics.categoryBreakdown.map((row) => (
                    <li key={row.categoryId}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span aria-hidden>{row.emoji}</span>
                          <span className="truncate font-medium text-brand-ink">{row.name}</span>
                        </span>
                        <span className="tnum shrink-0 font-semibold text-brand-ink">{formatIDR(row.monthly)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <ProgressBar percent={row.percent} height="h-1.5" />
                        <span className="w-12 shrink-0 text-right text-xs text-brand-muted">{formatPercent(row.percent, 1)}</span>
                      </div>
                      <p className="mt-1 text-xs text-brand-muted">
                        {row.count} langganan · {formatIDR(row.yearly)}/tahun
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Proyeksi tagihan 12 bulan ke depan" subtitle="Termasuk tagihan trial yang akan mulai berjalan." />
              <div className="p-4">
                <MonthlyBarChart data={analytics.next12Months} height={280} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Riwayat pembayaran per bulan" subtitle="Hanya dari pembayaran yang benar-benar kamu catat sebagai lunas." />
              <div className="p-4">
                {analytics.paidHistory.some((point) => point.amount > 0) ? (
                  <PaymentHistoryChart data={analytics.paidHistory} height={280} />
                ) : (
                  <EmptyState
                    emoji="🧾"
                    title="Belum ada pembayaran tercatat"
                    description="Tandai tagihan sebagai 'sudah dibayar' di halaman Renewal atau Langganan agar riwayat ini terisi."
                    action={
                      <LinkButton href="/renewals" variant="secondary">
                        Ke halaman Renewal
                      </LinkButton>
                    }
                  />
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Perbandingan bulanan vs tahunan per layanan"
              subtitle="Estimasi biaya bulanan dan biaya setahun penuh (bukan harga diskon tahunan dari penyedia)."
            />
            <div className="p-4">
              <ComparisonBarChart data={analytics.monthlyVsYearly} height={Math.max(300, analytics.monthlyVsYearly.length * 44)} />
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader title="Komposisi siklus pembayaran" subtitle="Setelah normalisasi ke bulanan." />
              <dl className="p-5">
                <KeyValue label="Siklus mingguan">{formatIDR(split.weekly)}/bulan</KeyValue>
                <KeyValue label="Siklus bulanan">{formatIDR(split.monthly)}/bulan</KeyValue>
                <KeyValue label="Siklus tahunan">{formatIDR(split.yearly)}/bulan</KeyValue>
                <KeyValue label="Interval kustom">{formatIDR(split.custom)}/bulan</KeyValue>
              </dl>
              <div className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
                Normalisasi: mingguan ×52÷12 · tahunan ÷12 · kustom memakai jumlah hari periode.
              </div>
            </Card>

            <Card>
              <CardHeader title="Layanan termahal" subtitle="Delapan teratas berdasarkan biaya bulanan." />
              <ul className="divide-y divide-brand-line">
                {analytics.topServices.map((service, index) => {
                  const category = categoryById(resolved, service.categoryId);
                  return (
                    <li key={service.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">
                          {index + 1}
                        </span>
                        <span aria-hidden>{category.emoji}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-brand-ink">{service.name}</span>
                          <span className="block text-xs text-brand-muted">
                            {formatPercent(safePercent(service.monthly, analytics.monthlyTotal), 1)} dari total bulanan
                          </span>
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-sm font-semibold text-brand-ink">{formatIDR(service.monthly)}</span>
                    </li>
                  );
                })}
                {analytics.topServices.length === 0 ? <li className="px-5 py-4 text-sm text-brand-muted">Belum ada data.</li> : null}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Ringkasan status" subtitle="Distribusi seluruh catatan langgananmu." />
              <dl className="p-5">
                <KeyValue label="Total catatan">{analytics.totalSubscriptions}</KeyValue>
                <KeyValue label="Aktif">
                  <span className="inline-flex items-center gap-2">
                    {analytics.activeCount}
                    <Badge tone="green">{formatPercent(safePercent(analytics.activeCount, analytics.totalSubscriptions), 0)}</Badge>
                  </span>
                </KeyValue>
                <KeyValue label="Nonaktif (dijeda)">{analytics.pausedCount}</KeyValue>
                <KeyValue label="Dibatalkan / berakhir">{analytics.canceledCount}</KeyValue>
                <KeyValue label="Masuk hitungan biaya">{analytics.billableCount}</KeyValue>
                <KeyValue label="Trial berjalan">{analytics.trialRunningCount}</KeyValue>
              </dl>
              <div className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
                Nonaktif/dibatalkan tidak dihitung ke biaya berjalan, tetapi tetap tersimpan sebagai riwayat.
              </div>
            </Card>
          </div>

          <ValueChecker items={valueItems} />

          <p className="text-xs text-brand-muted">
            Data terakhir dihitung {todayISO()} ({user.timezone}) · bulan berjalan {monthKeyFromDate(new Date())}. Semua
            angka bersifat <em>estimasi</em> dari jadwal yang kamu catat.
          </p>
        </>
      )}
    </div>
  );
}
