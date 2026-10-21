import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { getEntitlements } from '@/lib/plans';
import { getStudentVerification } from '@/lib/queries';
import { BILLING_PROVIDER_LABEL, isMockBilling, providerLabel, BILLING_PROVIDER } from '@/lib/billing';
import { COMPARISON_ROWS, PLANS, yearlySavings, type PlanId } from '@/config/plans';
import { formatDateID, todayISO } from '@/lib/dates';
import { formatIDR } from '@/lib/money';
import { Badge, Card, CardHeader, InfoBanner, PageHeader, cx } from '@/components/ui/primitives';
import { PlanSelector, type PlanCardData } from '@/components/billing/PlanSelector';

export const metadata: Metadata = { title: 'Paket & Harga' };
export const dynamic = 'force-dynamic';

const STUDENT_STATUS_LABEL: Record<string, string> = {
  none: 'belum diajukan',
  pending: 'sedang ditinjau (demo)',
  approved: 'disetujui (demo)',
  rejected: 'ditolak (demo)',
};

export default async function PricingPage() {
  const user = await requireUser();
  const [entitlements, verification] = await Promise.all([
    getEntitlements(user.id, user.planId, {
      planExpiresAt: user.planExpiresAt,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      planCycle: user.planCycle,
    }),
    getStudentVerification(user.id),
  ]);

  const studentStatus = verification?.status ?? user.studentStatus ?? 'none';
  const sandbox = isMockBilling();
  const today = todayISO();

  const planCards: PlanCardData[] = PLANS.slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((plan) => {
      const isCurrent = plan.id === user.planId;
      const studentBlocked = plan.id === 'student' && studentStatus !== 'approved';

      return {
        id: plan.id,
        name: plan.name,
        tagline: plan.tagline,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly ?? 0,
        yearlySavings: yearlySavings(plan.id),
        features: plan.features,
        caveats: plan.caveats,
        recommended: plan.recommended,
        isCurrent,
        selectable: !studentBlocked,
        blockedReason: studentBlocked
          ? `Paket Student memerlukan status verifikasi pelajar/mahasiswa yang disetujui. Statusmu saat ini: ${STUDENT_STATUS_LABEL[studentStatus] ?? studentStatus}.`
          : null,
        limitsLabel:
          plan.limits.maxActiveSubs === null
            ? 'Langganan tanpa batas wajar (fair use)'
            : `Maksimal ${plan.limits.maxActiveSubs} langganan aktif`,
      };
    });

  const membershipDaysLeft = entitlements.expiresAt
    ? Math.ceil((entitlements.expiresAt.getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paket & Harga"
        subtitle="Harga dalam Rupiah. Semua batas paket ditegakkan di sisi server — bukan hanya disembunyikan di tampilan. Kamu bisa berpindah atau turun paket kapan saja."
        breadcrumb={
          <>
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>{' '}
            / Paket &amp; Harga
          </>
        }
      />

      {/* ---- Status paket saat ini ---- */}
      <Card>
        <CardHeader
          title="Paket yang sedang kamu pakai"
          subtitle={`Dihitung per ${today} (${user.timezone}).`}
          action={<Badge tone={user.planId === 'free' ? 'slate' : 'violet'}>{entitlements.planName}</Badge>}
        />
        <dl className="grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Paket</dt>
            <dd className="mt-1 font-semibold text-brand-ink">{entitlements.planName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Siklus</dt>
            <dd className="mt-1 font-semibold text-brand-ink">{entitlements.cycle === 'yearly' ? 'Tahunan' : 'Bulanan'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Akses berlaku sampai</dt>
            <dd className="mt-1 font-semibold text-brand-ink">
              {entitlements.expiresAt ? (
                <>
                  {formatDateID(entitlements.expiresAt.toISOString().slice(0, 10))}
                  {membershipDaysLeft !== null ? (
                    <span className="ml-2 text-xs font-normal text-brand-muted">({membershipDaysLeft} hari lagi)</span>
                  ) : null}
                </>
              ) : (
                'Tanpa batas waktu (paket Free)'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Pemakaian langganan</dt>
            <dd className="mt-1 font-semibold text-brand-ink">
              {entitlements.usedSlots}
              {entitlements.limits.maxActiveSubs === null ? ' (tanpa batas)' : ` dari ${entitlements.maxActiveSubs}`}
            </dd>
          </div>
        </dl>
        {entitlements.cancelAtPeriodEnd ? (
          <div className="border-t border-brand-line px-5 py-3">
            <InfoBanner tone="warn" title="Perpanjangan otomatis dibatalkan">
              Akses berbayarmu tetap aktif sampai {entitlements.expiresAt ? formatDateID(entitlements.expiresAt.toISOString().slice(0, 10)) : 'akhir periode'}, lalu otomatis
              turun ke paket Free. Kamu bisa mengaktifkan kembali perpanjangan di halaman{' '}
              <Link href="/billing" className="font-semibold underline">
                Billing &amp; Langganan
              </Link>
              .
            </InfoBanner>
          </div>
        ) : null}
      </Card>

      <InfoBanner tone="warn" title={`Pembayaran: ${providerLabel()} — belum ada gateway nyata`}>
        Harga dan benefit di halaman ini sudah final untuk prototype, tetapi proses pembayaran masih berupa{' '}
        <strong>sandbox/demo</strong> ({BILLING_PROVIDER_LABEL[BILLING_PROVIDER] ?? BILLING_PROVIDER}). Tidak ada uang
        yang berpindah dan tidak ada data kartu/rekening yang diminta. Bila kamu mengubah <code>BILLING_PROVIDER</code>{' '}
        ke provider nyata tanpa mengonfigurasinya, server akan menolak checkout (501) alih-alih menampilkan pembayaran
        palsu.
      </InfoBanner>

      {/* ---- Kartu paket + alur checkout ---- */}
      <PlanSelector
        plans={planCards}
        currentPlanId={user.planId}
        currentCycle={user.planCycle}
        sandbox={sandbox}
        providerLabel={providerLabel()}
        studentStatus={STUDENT_STATUS_LABEL[studentStatus] ?? studentStatus}
      />

      {/* ---- Perbandingan fitur ---- */}
      <Card>
        <CardHeader title="Perbandingan fitur" subtitle="Ringkas, tanpa jebakan huruf kecil." />
        <div className="overflow-x-auto">
          <table className="table min-w-[720px]">
            <caption className="sr-only">Perbandingan fitur antar paket</caption>
            <thead>
              <tr>
                <th scope="col">Fitur</th>
                {PLANS.slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((plan) => (
                    <th key={plan.id} scope="col" className={cx('text-center', plan.id === user.planId ? 'text-violet-700' : undefined)}>
                      {plan.name}
                      {plan.id === user.planId ? <span className="ml-1 text-xs font-normal">(kamu)</span> : null}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="text-left font-medium text-brand-ink">
                    {row.label}
                  </th>
                  {PLANS.slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((plan) => (
                      <td key={`${row.label}-${plan.id}`} className="text-center">
                        <ComparisonCell value={row.values[plan.id as PlanId]} />
                      </td>
                    ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="text-left font-medium text-brand-ink">
                  Harga bulanan
                </th>
                {PLANS.slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((plan) => (
                    <td key={`${plan.id}-m`} className="tnum text-center font-semibold">
                      {plan.priceMonthly === 0 ? 'Gratis' : formatIDR(plan.priceMonthly)}
                    </td>
                  ))}
              </tr>
              <tr>
                <th scope="row" className="text-left font-medium text-brand-ink">
                  Harga tahunan
                </th>
                {PLANS.slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((plan) => (
                    <td key={`${plan.id}-y`} className="tnum text-center font-semibold">
                      {plan.priceYearly === null || plan.priceYearly === 0 ? 'Gratis' : formatIDR(plan.priceYearly)}
                    </td>
                  ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---- Transparansi batasan ---- */}
      <Card>
        <CardHeader title="Yang perlu kamu tahu sebelum membayar" subtitle="Ditulis apa adanya." />
        <ul className="space-y-2.5 p-5 text-sm text-brand-muted">
          <li>
            <strong className="text-brand-ink">Tidak ada pengembalian dana otomatis.</strong> Karena belum ada payment
            gateway, tidak ada transaksi nyata yang diproses pada prototype ini.
          </li>
          <li>
            <strong className="text-brand-ink">Paket Student diperiksa ulang.</strong> Bila status verifikasi pelajar
            berubah menjadi tidak disetujui, paket otomatis turun ke Free pada sinkronisasi berikutnya.
          </li>
          <li>
            <strong className="text-brand-ink">Paket berbayar punya batas wajar.</strong> Untuk menjaga performa,
            sistem menetapkan batas lunak {500} langganan meskipun paket tertulis &ldquo;tanpa batas&rdquo;.
          </li>
          <li>
            <strong className="text-brand-ink">Turun paket tidak menghapus data.</strong> Semua catatan tetap ada, hanya
            fitur dan kuota yang berubah.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex items-center justify-center text-emerald-600" aria-label="Tersedia">
        ✓
      </span>
    ) : (
      <span className="inline-flex items-center justify-center text-brand-muted/70" aria-label="Tidak tersedia">
        —
      </span>
    );
  }
  return <span className="text-sm text-brand-ink">{value}</span>;
}
