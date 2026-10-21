'use client';

/**
 * Pemilih paket + alur checkout SANDBOX.
 *
 * Alur: pilih paket → buat sesi checkout (status pending) → konfirmasi
 * (simulasi pembayaran berhasil, ditandai "demo") → paket aktif.
 *
 * Tidak ada data pembayaran yang diminta/di simpan, dan tidak ada klaim
 * pembayaran nyata: semuanya diberi label Sandbox/Demo secara eksplisit.
 * Bila BILLING_PROVIDER bukan 'mock', server menolak dengan 501 sampai
 * integrasi nyata dipasang.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Badge, Card, InfoBanner, ProgressBar, buttonClass, cx } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPost, ApiClientError } from '@/lib/client';
import { demoOp, isDemoMode } from '@/lib/demo/client';
import { formatIDR } from '@/lib/money';

export interface PlanCardData {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  yearlySavings: number;
  features: { key: string; label: string }[];
  caveats: string[];
  recommended: boolean;
  isCurrent: boolean;
  selectable: boolean;
  blockedReason: string | null;
  limitsLabel: string;
}

interface CheckoutState {
  checkoutId: string;
  planId: string;
  planName: string;
  cycle: 'monthly' | 'yearly';
  amount: number;
  providerLabel: string;
  note: string;
}

export function PlanSelector({
  plans,
  currentPlanId,
  currentCycle,
  sandbox,
  providerLabel,
  studentStatus,
}: {
  plans: PlanCardData[];
  currentPlanId: string;
  currentCycle: string;
  sandbox: boolean;
  providerLabel: string;
  studentStatus: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>(currentCycle === 'yearly' ? 'yearly' : 'monthly');
  const [target, setTarget] = useState<PlanCardData | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [activated, setActivated] = useState<{ planName: string; periodEnd: string; amount: number; providerRef: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<PlanCardData | null>(null);

  function reset() {
    setTarget(null);
    setCheckout(null);
    setActivated(null);
  }

  async function startCheckout(plan: PlanCardData) {
    setBusy(true);
    try {
      if (isDemoMode()) {
        const result = await demoOp<{ activated: { planId: string; planCycle: string; currentPeriodEnd: string; amount: number; providerRef: string } }>({
          op: 'plan.select',
          planId: plan.id,
          cycle,
        });
        setCheckout({
          checkoutId: `demo_${plan.id}`,
          planId: plan.id,
          planName: plan.name,
          cycle,
          amount: cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly,
          provider: 'mock',
          providerLabel: 'Sandbox internal (demo)',
          status: 'pending',
          sandbox: true,
          note: 'Mode demo: pembayaran disimulasikan.',
        } as CheckoutState);
        setActivated({
          planName: plan.name,
          periodEnd: result.activated.currentPeriodEnd,
          amount: result.activated.amount,
          providerRef: result.activated.providerRef,
        });
        toast.success(`Paket ${plan.name} aktif (demo).`, `Berlaku sampai ${result.activated.currentPeriodEnd}.`);
        router.refresh();
        return;
      }
      const result = await apiPost<{ checkout: CheckoutState }>('/api/billing/checkout', {
        planId: plan.id,
        cycle,
      });
      setCheckout(result.checkout);
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message);
      } else {
        toast.error('Gagal memulai checkout.');
      }
      reset();
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment() {
    if (!checkout) return;
    setBusy(true);
    try {
      if (isDemoMode()) {
        const result = await demoOp<{ activated: { currentPeriodEnd: string; amount: number; providerRef: string } }>({
          op: 'plan.confirm',
          planId: checkout.planId,
          cycle: checkout.cycle,
        });
        setActivated({
          planName: checkout.planName,
          periodEnd: result.activated.currentPeriodEnd,
          amount: result.activated.amount,
          providerRef: result.activated.providerRef,
        });
        toast.success(`Paket ${checkout.planName} aktif (demo).`, `Berlaku sampai ${result.activated.currentPeriodEnd}.`);
        router.refresh();
        return;
      }
      const result = await apiPost<{
        activated: { planId: string; planCycle: string; currentPeriodEnd: string; amount: number; providerRef: string };
      }>('/api/billing/confirm', { checkoutId: checkout.checkoutId });

      setActivated({
        planName: checkout.planName,
        periodEnd: result.activated.currentPeriodEnd,
        amount: result.activated.amount,
        providerRef: result.activated.providerRef,
      });
      toast.success(`Paket ${checkout.planName} aktif (simulasi sandbox).`, `Berlaku sampai ${result.activated.currentPeriodEnd}.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Gagal mengonfirmasi pembayaran.');
    } finally {
      setBusy(false);
    }
  }

  async function downgrade(plan: PlanCardData) {
    setBusy(true);
    try {
      if (isDemoMode()) {
        await demoOp({ op: 'plan.select', planId: 'free', cycle: 'monthly' });
      } else {
        await apiPost('/api/plan/select', { planId: 'free' });
      }
      toast.success('Paket diubah ke Free.', 'Fitur berbayar dinonaktifkan, datamu tetap aman.');
      setDowngradeTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Gagal mengubah paket.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ---- Toggle siklus ---- */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex rounded-xl border border-brand-line bg-white p-1" role="group" aria-label="Pilih siklus pembayaran">
          {(['monthly', 'yearly'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCycle(option)}
              className={cx(
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                cycle === option ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'text-brand-muted hover:text-violet-700',
              )}
              aria-pressed={cycle === option}
            >
              {option === 'monthly' ? 'Bulanan' : 'Tahunan'}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-muted">
          {cycle === 'yearly' ? 'Harga tahunan biasanya lebih hemat.' : 'Bisa berpindah ke tahunan kapan saja.'}
        </p>
      </div>

      {!sandbox ? (
        <InfoBanner tone="danger" title={`Provider pembayaran aktif: ${providerLabel}`}>
          Prototype ini belum memiliki integrasi webhook/kredensial untuk provider tersebut. Tombol berlangganan akan
          ditolak server (501) sampai integrasi benar-benar selesai — ini disengaja agar tidak ada status pembayaran
          palsu.
        </InfoBanner>
      ) : null}

      {/* ---- Kartu paket ---- */}
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
          const isCurrent = plan.isCurrent;
          const isFree = plan.id === 'free';

          return (
            <Card
              key={plan.id}
              className={cx('relative flex flex-col', plan.recommended && !isCurrent ? 'border-violet-400 ring-2 ring-violet-200' : undefined, isCurrent ? 'border-emerald-400 ring-2 ring-emerald-200' : undefined)}
            >
              {plan.recommended && !isCurrent ? (
                <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Direkomendasikan
                </span>
              ) : null}
              {isCurrent ? (
                <span className="absolute -top-3 left-5 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Paket aktif
                </span>
              ) : null}

              <div className="card-pad flex flex-1 flex-col">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-brand-ink">{plan.name}</h3>
                  {plan.id === 'student' ? <Badge tone="blue">Perlu verifikasi</Badge> : null}
                </div>
                <p className="mt-1 min-h-[2.5rem] text-sm text-brand-muted">{plan.tagline}</p>

                <p className="tnum mt-4 text-3xl font-extrabold text-brand-ink">
                  {price === 0 ? 'Gratis' : formatIDR(price)}
                  {price === 0 ? null : <span className="text-sm font-medium text-brand-muted">/{cycle === 'yearly' ? 'tahun' : 'bulan'}</span>}
                </p>
                {cycle === 'yearly' && plan.yearlySavings > 0 ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Hemat {formatIDR(plan.yearlySavings)} dibanding 12× harga bulanan
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-brand-muted">{plan.limitsLabel}</p>

                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature.key} className="flex gap-2 text-brand-ink">
                      <span aria-hidden className="text-emerald-600">
                        ✓
                      </span>
                      <span>{feature.label}</span>
                    </li>
                  ))}
                </ul>

                {plan.caveats.length ? (
                  <ul className="mt-4 space-y-1 text-xs text-brand-muted">
                    {plan.caveats.map((caveat) => (
                      <li key={caveat}>• {caveat}</li>
                    ))}
                  </ul>
                ) : null}

                {plan.blockedReason ? (
                  <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{plan.blockedReason}</p>
                ) : null}

                <div className="mt-5">
                  {isCurrent ? (
                    <button type="button" className="btn-secondary w-full" disabled>
                      Paket yang sedang dipakai
                    </button>
                  ) : isFree ? (
                    <button type="button" className="btn-secondary w-full" onClick={() => setDowngradeTarget(plan)} disabled={busy}>
                      Turun ke Free
                    </button>
                  ) : plan.selectable ? (
                    <button
                      type="button"
                      className={cx(plan.recommended ? 'btn-primary' : 'btn-secondary', 'w-full')}
                      onClick={() => {
                        setTarget(plan);
                        setCheckout(null);
                        setActivated(null);
                      }}
                      disabled={busy}
                    >
                      {currentPlanId === 'free' ? `Upgrade ke ${plan.name}` : `Pilih ${plan.name}`}
                    </button>
                  ) : (
                    <>
                      <button type="button" className="btn-secondary w-full" disabled>
                        Belum bisa dipilih
                      </button>
                      <Link href="/student" className="mt-2 block text-center text-xs font-semibold text-violet-700 hover:underline">
                        Ajukan verifikasi pelajar →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ---- Modal checkout ---- */}
      <Modal
        open={Boolean(target) && !activated}
        onClose={reset}
        title={checkout ? `Konfirmasi pembayaran — ${checkout.planName}` : `Pilih paket ${target?.name ?? ''}`}
        description={checkout ? 'Langkah terakhir sebelum paket diaktifkan.' : 'Periksa rincian sebelum melanjutkan.'}
        size="md"
        footer={
          activated ? (
            <button type="button" className="btn-primary" onClick={reset}>
              Selesai
            </button>
          ) : checkout ? (
            <>
              <button type="button" className="btn-secondary" onClick={reset} disabled={busy}>
                Batal
              </button>
              <button type="button" className="btn-primary" onClick={confirmPayment} disabled={busy}>
                {busy ? 'Memproses…' : 'Simulasikan pembayaran berhasil'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={reset} disabled={busy}>
                Batal
              </button>
              <button type="button" className="btn-primary" onClick={() => target && startCheckout(target)} disabled={busy}>
                {busy ? 'Menyiapkan…' : 'Lanjut ke pembayaran'}
              </button>
            </>
          )
        }
      >
        {activated ? (
          <div className="space-y-4">
            <InfoBanner tone="success" title={`Paket ${activated.planName} aktif (simulasi)`}>
              Masa berlaku sampai <strong>{activated.periodEnd}</strong>. Referensi sandbox:{' '}
              <code className="rounded bg-white/70 px-1.5 py-0.5">{activated.providerRef}</code>.
            </InfoBanner>
            <p className="text-sm text-brand-muted">
              Status pembayaran ditandai <strong>demo</strong> karena tidak ada transaksi nyata. Kamu dapat melihat
              riwayat perubahan paket di halaman <strong>Billing &amp; Langganan</strong>.
            </p>
            <Link href="/billing" className="link text-sm">
              Buka halaman Billing →
            </Link>
          </div>
        ) : checkout ? (
          <div className="space-y-4">
            <dl className="divide-y divide-brand-line rounded-xl border border-brand-line">
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-brand-muted">Paket</dt>
                <dd className="font-semibold text-brand-ink">{checkout.planName}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-brand-muted">Siklus</dt>
                <dd className="font-semibold text-brand-ink">{checkout.cycle === 'yearly' ? 'Tahunan' : 'Bulanan'}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-brand-muted">Jumlah</dt>
                <dd className="tnum font-semibold text-brand-ink">{formatIDR(checkout.amount)}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-brand-muted">Metode</dt>
                <dd className="font-semibold text-brand-ink">{checkout.providerLabel}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-brand-muted">ID checkout</dt>
                <dd className="font-mono text-xs text-brand-ink">{checkout.checkoutId.slice(0, 12)}…</dd>
              </div>
            </dl>

            <InfoBanner tone="warn" title="Ini simulasi, bukan pembayaran sungguhan">
              {checkout.note} Tidak ada nomor kartu, rekening, atau data pembayaran lain yang diminta.
            </InfoBanner>
          </div>
        ) : target ? (
          <div className="space-y-4">
            <dl className="divide-y divide-brand-line rounded-xl border border-brand-line">
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-brand-muted">Paket</dt>
                <dd className="font-semibold text-brand-ink">{target.name}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-brand-muted">Siklus</dt>
                <dd className="font-semibold text-brand-ink">{cycle === 'yearly' ? 'Tahunan' : 'Bulanan'}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <dt className="text-brand-muted">Jumlah</dt>
                <dd className="tnum font-semibold text-brand-ink">
                  {formatIDR(cycle === 'yearly' ? target.priceYearly : target.priceMonthly)}
                </dd>
              </div>
              {cycle === 'yearly' && target.yearlySavings > 0 ? (
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <dt className="text-brand-muted">Hemat</dt>
                  <dd className="font-semibold text-emerald-700">{formatIDR(target.yearlySavings)}</dd>
                </div>
              ) : null}
            </dl>

            {target.id === 'student' ? (
              <InfoBanner tone="info" title={`Status verifikasi: ${studentStatus}`}>
                Harga pelajar hanya berlaku selama status verifikasi pelajar/mahasiswa disetujui. Bila status berubah,
                paket otomatis turun ke Free.
              </InfoBanner>
            ) : null}

            <InfoBanner tone="warn" title="Pembayaran sandbox">
              Belum ada payment gateway terintegrasi ({providerLabel}). Kamu akan diminta menekan tombol &ldquo;Simulasikan
              pembayaran berhasil&rdquo; dan statusnya ditandai demo — tidak ada uang yang berpindah.
            </InfoBanner>
          </div>
        ) : null}
      </Modal>

      {/* ---- Modal downgrade ---- */}
      <Modal
        open={Boolean(downgradeTarget)}
        onClose={() => setDowngradeTarget(null)}
        title="Turun ke paket Free?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDowngradeTarget(null)} disabled={busy}>
              Batal
            </button>
            <button type="button" className="btn-danger" onClick={() => downgradeTarget && downgrade(downgradeTarget)} disabled={busy}>
              {busy ? 'Memproses…' : 'Ya, turun ke Free'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>Paket Free membatasi jumlah langganan aktif dan menonaktifkan analitik lanjutan, anggaran, dan ekspor CSV.</p>
          <InfoBanner tone="warn" title="Datamu tidak dihapus">
            Semua langganan tetap tersimpan. Namun bila kamu memiliki lebih dari 5 langganan aktif, kamu perlu
            menghapus/menonaktifkan sebagian sebelum bisa menambah yang baru.
          </InfoBanner>
        </div>
      </Modal>

      {/* ---- Catatan transparansi ---- */}
      <Card className="card-pad bg-violet-50/50">
        <h3 className="text-sm font-semibold text-brand-ink">Kenapa pembayaran saya belum bisa nyata?</h3>
        <p className="mt-1.5 text-sm text-brand-muted">
          Prototype ini fokus pada fungsionalitas produk: pencatatan langganan, proyeksi biaya, pengingat, dan penegakan
          batas paket di sisi server. Integrasi payment gateway (Midtrans/Xendit/Stripe) memerlukan akun merchant,
          kredensial, dan webhook yang belum tersedia di lingkungan ini. Karena itu semua alur pembayaran disimulasikan
          dan diberi label jelas sebagai sandbox/demo, bukan diklaim berhasil.
        </p>
        <ProgressBar percent={100} tone="violet" height="h-1" />
      </Card>
    </div>
  );
}
