import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getBudget, getCustomCategories, getUserPayments, getUserSubscriptions } from '@/lib/queries';
import { buildAnalytics } from '@/lib/analytics';
import { getPlan, getPlanLimits } from '@/config/plans';
import { formatIDR, formatPercent, safePercent } from '@/lib/money';
import { Card, CardHeader, InfoBanner, LinkButton, PageHeader, ProgressBar, StatCard } from '@/components/ui/primitives';
import { BudgetForm } from '@/components/forms/BudgetForm';

export const metadata: Metadata = { title: 'Budget Planner' };
export const dynamic = 'force-dynamic';

export default async function BudgetPage() {
  const user = await requireUser();
  const limits = getPlanLimits(user.planId);
  const plan = getPlan(user.planId);

  const [subscriptions, payments, customCategories, budget] = await Promise.all([
    getUserSubscriptions(user.id),
    getUserPayments(user.id),
    getCustomCategories(user.id),
    getBudget(user.id),
  ]);

  const analytics = buildAnalytics({ subscriptions, payments, categories: customCategories });

  if (!limits.budgetPlanner) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Budget Planner"
          subtitle="Tetapkan batas pengeluaran bulanan untuk langganan, lalu pantau pemakaiannya secara otomatis."
        />
        <InfoBanner tone="warn" title={`Budget planner belum tersedia pada paket ${plan.name}`}>
          Paket Free tetap bisa melihat total bulanan dan daftar renewal di dashboard. Untuk menetapkan anggaran,
          menerima peringatan saat mendekati batas, dan melihat sisa anggaran per kategori, silakan upgrade ke paket
          Premium atau Student.
        </InfoBanner>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Yang bisa kamu pantau sekarang" subtitle="Ringkasan dasar tetap tersedia di paket Free." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <StatCard label="Estimasi bulanan" value={formatIDR(analytics.monthlyTotal)} emoji="📆" tone="violet" />
              <StatCard label="Estimasi tahunan" value={formatIDR(analytics.yearlyTotal)} emoji="🗓" tone="blue" />
            </div>
            <div className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
              Angka di atas dihitung dari {analytics.billableCount} langganan berbayar aktif.
            </div>
          </Card>

          <Card>
            <CardHeader title="Yang kamu dapatkan dengan Premium" />
            <ul className="space-y-2 p-5 text-sm">
              {[
                'Batas anggaran bulanan + peringatan otomatis',
                'Persentase pemakaian anggaran dan sisa saldo',
                'Proyeksi bila trial berubah menjadi tagihan',
                'Pantauan per kategori pengeluaran',
                'Ekspor CSV untuk pembukuan pribadi',
              ].map((item) => (
                <li key={item} className="flex gap-2 text-brand-ink">
                  <span aria-hidden className="text-emerald-600">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="border-t border-brand-line px-5 py-4">
              <LinkButton href="/pricing">Lihat paket &amp; harga</LinkButton>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const monthlyBudget = budget?.monthlyLimit ?? null;
  const usedPercent = monthlyBudget ? (analytics.monthlyTotal / monthlyBudget) * 100 : 0;
  const remaining = monthlyBudget !== null ? monthlyBudget - analytics.monthlyTotal : null;
  const warnAt = budget?.warnAtPercent ?? 80;

  const categoryRows = analytics.categoryBreakdown.map((row) => ({
    ...row,
    shareOfBudget: monthlyBudget ? safePercent(row.monthly, monthlyBudget, 1) : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget Planner"
        subtitle="Tetapkan batas pengeluaran bulanan, lalu lihat seberapa besar anggaran yang terpakai oleh langgananmu."
      />

      {monthlyBudget === null ? (
        <InfoBanner tone="info" title="Belum ada anggaran yang ditetapkan">
          Isi batas anggaran di bawah. Setelah tersimpan, dashboard dan halaman ini akan menampilkan sisa anggaran serta
          peringatan saat pemakaian mendekati batas.
        </InfoBanner>
      ) : remaining !== null && remaining < 0 ? (
        <InfoBanner tone="danger" title="Anggaran terlampaui">
          Pengeluaran bulanan {formatIDR(analytics.monthlyTotal)} melebihi anggaran {formatIDR(monthlyBudget)} sebesar{' '}
          {formatIDR(Math.abs(remaining))}. Tinjau langganan yang jarang dipakai di{' '}
          <Link href="/analytics" className="font-semibold underline">
            Analitik
          </Link>
          .
        </InfoBanner>
      ) : monthlyBudget !== null && usedPercent >= warnAt ? (
        <InfoBanner tone="warn" title="Pemakaian anggaran mendekati batas">
          Kamu sudah memakai {formatPercent(usedPercent, 1)} dari anggaran {formatIDR(monthlyBudget)}. Sisa{' '}
          {formatIDR(remaining ?? 0)}.
        </InfoBanner>
      ) : null}

      {monthlyBudget !== null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Anggaran bulanan" value={formatIDR(monthlyBudget)} emoji="🎯" tone="violet" />
          <StatCard label="Terpakai" value={formatIDR(analytics.monthlyTotal)} emoji="📆" tone="blue" hint={formatPercent(usedPercent, 1)} />
          <StatCard
            label="Sisa anggaran"
            value={formatIDR(remaining ?? 0)}
            emoji={remaining !== null && remaining < 0 ? '🚨' : '💰'}
            tone={remaining !== null && remaining < 0 ? 'red' : 'green'}
          />
          <StatCard
            label="Jika trial berlanjut"
            value={formatIDR(analytics.monthlyTotal + analytics.trialPendingMonthly)}
            emoji="⏳"
            tone={analytics.trialPendingMonthly > 0 ? 'amber' : 'green'}
            hint={
              analytics.trialPendingMonthly > 0
                ? `+${formatIDR(analytics.trialPendingMonthly)} dari trial`
                : 'Tidak ada trial berjalan'
            }
            footer={monthlyBudget ? <ProgressBar percent={monthlyBudget ? ((analytics.monthlyTotal + analytics.trialPendingMonthly) / monthlyBudget) * 100 : 0} tone="amber" /> : null}
          />
        </div>
      ) : null}

      <BudgetForm
        initial={budget ? { monthlyLimit: budget.monthlyLimit, warnAtPercent: budget.warnAtPercent, notes: budget.notes } : null}
        monthlyTotal={analytics.monthlyTotal}
        trialPendingMonthly={analytics.trialPendingMonthly}
      />

      {monthlyBudget !== null && categoryRows.length ? (
        <Card>
          <CardHeader
            title="Pemakaian anggaran per kategori"
            subtitle={`Persentase dihitung dari batas anggaran ${formatIDR(monthlyBudget)} per bulan.`}
          />
          <ul className="divide-y divide-brand-line">
            {categoryRows.map((row) => (
              <li key={row.categoryId} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    <span aria-hidden>{row.emoji}</span>
                    <span className="font-medium text-brand-ink">{row.name}</span>
                    <span className="text-xs text-brand-muted">({row.count} langganan)</span>
                  </span>
                  <span className="tnum text-sm font-semibold text-brand-ink">
                    {formatIDR(row.monthly)}
                    <span className="ml-2 text-xs font-normal text-brand-muted">
                      {row.shareOfBudget !== null ? `${row.shareOfBudget}% anggaran` : ''}
                    </span>
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar percent={monthlyBudget ? safePercent(row.monthly, monthlyBudget, 1) : 0} tone="violet" height="h-1.5" />
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">
            Kategori &ldquo;Lainnya&rdquo; menggabungkan langganan yang kategorinya sudah dihapus.
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Bagaimana peringatan bekerja" subtitle="Jelas dan dapat diprediksi." />
        <ul className="space-y-2 p-5 text-sm text-brand-muted">
          <li>
            <strong className="text-brand-ink">Ambang peringatan</strong> ({warnAt}%): dashboard menandai anggaranmu
            kuning saat pemakaian melewati ambang ini.
          </li>
          <li>
            <strong className="text-brand-ink">Melebihi anggaran</strong>: kartu berubah merah dan muncul peringatan
            dengan besaran kelebihan.
          </li>
          <li>
            <strong className="text-brand-ink">Trial</strong> tidak masuk hitungan terpakai, tetapi ditampilkan
            terpisah sebagai potensi tambahan agar tidak ada kejutan.
          </li>
          <li>
            <strong className="text-brand-ink">Status nonaktif</strong> tidak dihitung ke pengeluaran berjalan.
          </li>
        </ul>
      </Card>

      <p className="text-xs text-brand-muted">
        Angka anggaran adalah <em>target pribadi</em>, bukan batas dari pihak penyedia layanan. Whenly tidak dapat
        menghentikan tagihan otomatis dari pihak ketiga.
      </p>
    </div>
  );
}
