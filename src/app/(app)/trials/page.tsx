import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getCustomCategories, getUserPayments, getUserSubscriptions } from '@/lib/queries';
import { buildAnalytics } from '@/lib/analytics';
import { categoryById, resolveCategories } from '@/lib/categories';
import { countdownLabel, daysBetweenISO, formatDateID, todayISO } from '@/lib/dates';
import { cycleLabel, isoOf } from '@/lib/subscriptions';
import { formatIDR } from '@/lib/money';
import { Badge, Card, CardHeader, EmptyState, InfoBanner, LinkButton, PageHeader, ProgressBar, StatCard } from '@/components/ui/primitives';
import { DeleteSubscriptionButton, MarkPaidButton, StatusToggleButton } from '@/components/subscriptions/SubscriptionActions';

export const metadata: Metadata = { title: 'Free Trial' };
export const dynamic = 'force-dynamic';

export default async function TrialsPage() {
  const user = await requireUser();
  const today = todayISO();

  const [subscriptions, payments, customCategories] = await Promise.all([
    getUserSubscriptions(user.id),
    getUserPayments(user.id),
    getCustomCategories(user.id),
  ]);

  const analytics = buildAnalytics({ subscriptions, payments, categories: customCategories });
  const resolved = resolveCategories(customCategories);

  const running = analytics.trials.filter((trial) => trial.status !== 'ended');
  const ended = analytics.trials.filter((trial) => trial.status === 'ended');
  const endingSoon = running.filter((trial) => trial.daysLeft <= 3);

  const pendingMonthly = analytics.trialPendingMonthly;
  const pendingYearly = analytics.trialPendingYearly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pelacak Free Trial"
        subtitle="Catat layanan yang sedang kamu coba gratis. Whenly menghitung kapan tagihan pertama muncul dan berapa biayanya, supaya kamu bisa memutuskan sebelum uang terpotong."
        actions={
          <Link href="/subscriptions?new=1" className="btn-secondary">
            + Tambah trial
          </Link>
        }
      />

      <InfoBanner tone="warn" title="Whenly tidak bisa membatalkan langganan otomatis">
        Belum ada integrasi dengan penyedia layanan (Netflix, Spotify, dan lainnya), sehingga pembatalan otomatis{' '}
        <strong>tidak mungkin</strong> dilakukan dari sini. Yang bisa kami lakukan: mengingatkanmu lebih awal dan
        menunjukkan perkiraan tagihan. Pembatalan tetap kamu lakukan di aplikasi/website penyedianya. Jika kamu sudah
        membatalkan di sana, tandai langganan sebagai <em>nonaktif</em> atau hapus di Whenly agar tidak dihitung.
      </InfoBanner>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Trial berjalan" value={String(running.length)} emoji="⏳" tone="blue" hint={`${ended.length} trial sudah berakhir`} />
        <StatCard
          label="Berakhir ≤3 hari"
          value={String(endingSoon.length)}
          emoji="🔔"
          tone={endingSoon.length ? 'red' : 'green'}
          hint={endingSoon.length ? 'Segera putuskan sebelum ditagih' : 'Tidak ada yang mendesak'}
        />
        <StatCard
          label="Tagihan tambahan bulanan"
          value={formatIDR(pendingMonthly)}
          emoji="📈"
          tone={pendingMonthly > 0 ? 'amber' : 'green'}
          hint="Jika semua trial berlanjut menjadi langganan berbayar"
        />
        <StatCard
          label="Total pengeluaran sekarang"
          value={formatIDR(analytics.monthlyTotal)}
          emoji="📆"
          tone="violet"
          hint={`Setelah trial berakhir menjadi ${formatIDR(analytics.monthlyTotal + pendingMonthly)}/bulan`}
        />
      </div>

      {endingSoon.length ? (
        <InfoBanner tone="danger" title={`${endingSoon.length} trial berakhir dalam 3 hari`}>
          <ul className="ml-4 list-disc space-y-1">
            {endingSoon.map((trial) => (
              <li key={trial.subscription.id}>
                <strong>{trial.subscription.name}</strong> — berakhir {formatDateID(trial.endDate)} (
                {countdownLabel(trial.daysLeft)}), tagihan pertama{' '}
                {trial.firstChargeDate ? formatDateID(trial.firstChargeDate) : 'sehari setelahnya'} sebesar{' '}
                {formatIDR(trial.priceAfterTrial)}.
              </li>
            ))}
          </ul>
        </InfoBanner>
      ) : null}

      <Card>
        <CardHeader
          title="Trial yang sedang berjalan"
          subtitle="Trial tidak dihitung ke pengeluaran bulanan saat ini, tetapi masuk proyeksi tagihan mulai tanggal tagihan pertama."
        />
        {running.length ? (
          <ul className="divide-y divide-brand-line">
            {running.map((trial) => {
              const category = categoryById(resolved, trial.subscription.category);
              const progress =
                trial.startDate && trial.endDate
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        (daysBetweenISO(trial.startDate, today) /
                          Math.max(1, daysBetweenISO(trial.startDate, trial.endDate))) *
                          100,
                      ),
                    )
                  : 0;

              return (
                <li key={trial.subscription.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span aria-hidden className="text-base">
                          {category.emoji}
                        </span>
                        <span className="font-semibold text-brand-ink">{trial.subscription.name}</span>
                        {trial.subscription.isDemo ? <Badge tone="amber">DEMO</Badge> : null}
                        <Badge tone={trial.status === 'ending-today' ? 'red' : trial.daysLeft <= 3 ? 'amber' : 'blue'}>
                          {trial.status === 'ending-today' ? 'Berakhir hari ini' : countdownLabel(trial.daysLeft)}
                        </Badge>
                        <Badge tone="violet">{cycleLabel(trial.subscription.billingCycle, trial.subscription.customPeriodDays)}</Badge>
                      </div>

                      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-brand-muted sm:grid-cols-4">
                        <div>
                          <dt>Mulai trial</dt>
                          <dd className="font-medium text-brand-ink">{trial.startDate ? formatDateID(trial.startDate) : '—'}</dd>
                        </div>
                        <div>
                          <dt>Berakhir</dt>
                          <dd className="font-medium text-brand-ink">{formatDateID(trial.endDate)}</dd>
                        </div>
                        <div>
                          <dt>Tagihan pertama</dt>
                          <dd className="font-medium text-brand-ink">
                            {trial.firstChargeDate ? formatDateID(trial.firstChargeDate) : 'Sehari setelah trial'}
                          </dd>
                        </div>
                        <div>
                          <dt>Harga setelah trial</dt>
                          <dd className="font-medium text-brand-ink">{formatIDR(trial.priceAfterTrial)}</dd>
                        </div>
                      </dl>

                      <div className="mt-3 max-w-md">
                        <ProgressBar percent={progress} tone={trial.daysLeft <= 3 ? 'red' : 'violet'} height="h-2" />
                        <p className="mt-1 text-[11px] text-brand-muted">
                          {Math.round(progress)}% masa trial terpakai
                          {trial.subscription.benefitNotes ? ` · catatan: ${trial.subscription.benefitNotes}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <MarkPaidButton
                        id={trial.subscription.id}
                        name={trial.subscription.name}
                        amountLabel={formatIDR(trial.priceAfterTrial)}
                        nextRenewalLabel={trial.firstChargeDate ? formatDateID(trial.firstChargeDate) : 'setelah trial'}
                        compact
                      />
                      <Link href={`/subscriptions?edit=${trial.subscription.id}`} className="btn-ghost btn-sm">
                        ✏ Ubah
                      </Link>
                      <StatusToggleButton id={trial.subscription.id} name={trial.subscription.name} status={trial.subscription.status} />
                      <DeleteSubscriptionButton id={trial.subscription.id} name={trial.subscription.name} compact />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            emoji="⏳"
            title="Belum ada trial yang berjalan"
            description="Saat kamu mencoba layanan gratis, catat di sini agar tidak lupa membatalkan sebelum ditagih."
            action={
              <Link href="/subscriptions?new=1" className="btn-primary">
                + Catat trial baru
              </Link>
            }
          />
        )}
      </Card>

      {ended.length ? (
        <Card>
          <CardHeader
            title="Trial yang sudah berakhir"
            subtitle="Bila tagihan sudah masuk, tandai 'sudah dibayar' pada langganan terkait agar riwayat pengeluaranmu akurat."
          />
          <ul className="divide-y divide-brand-line">
            {ended.map((trial) => (
              <li key={trial.subscription.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-semibold text-brand-ink">{trial.subscription.name}</p>
                  <p className="text-xs text-brand-muted">
                    Trial berakhir {formatDateID(trial.endDate)} · harga setelah trial {formatIDR(trial.priceAfterTrial)} ·{' '}
                    renewal tercatat {formatDateID(isoOf(trial.subscription.nextRenewalDate))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={trial.subscription.status === 'active' ? 'amber' : 'slate'}>
                    {trial.subscription.status === 'active' ? 'Masih tercatat aktif' : 'Sudah dinonaktifkan'}
                  </Badge>
                  <Link href={`/subscriptions?edit=${trial.subscription.id}`} className="btn-secondary btn-sm">
                    Perbarui
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Cara estimasi ini dihitung" subtitle="Transparan, tanpa angka ajaib." />
        <div className="space-y-2 p-5 text-sm text-brand-muted">
          <p>
            <strong className="text-brand-ink">Tagihan pertama</strong> memakai tanggal yang kamu isi. Bila dikosongkan,
            sistem memakai sehari setelah trial berakhir.
          </p>
          <p>
            <strong className="text-brand-ink">Proyeksi tambahan</strong> ({formatIDR(pendingMonthly)}/bulan ·{' '}
            {formatIDR(pendingYearly)}/tahun) dihitung dari harga setelah trial pada masing-masing siklus, dinormalisasi
            ke bulanan (mingguan ×52÷12, tahunan ÷12).
          </p>
          <p>
            Semua nilai bersifat <strong className="text-brand-ink">estimasi</strong>; harga dan kebijakan trial dapat
            berubah dari sisi penyedia layanan.
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <LinkButton href="/renewals" variant="secondary">
          Lihat kalender renewal
        </LinkButton>
        <LinkButton href="/analytics" variant="secondary">
          Analitik pengeluaran
        </LinkButton>
      </div>
    </div>
  );
}
