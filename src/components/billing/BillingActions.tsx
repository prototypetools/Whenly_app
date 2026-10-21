'use client';

/**
 * Aksi billing: batalkan / aktifkan kembali perpanjangan otomatis.
 * Tidak ada tombol "bayar sekarang" palsu — pembayaran nyata tidak tersedia
 * pada prototype sandbox ini, dan itu dinyatakan terang-terangan di UI.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/Modal';
import { InfoBanner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPost, ApiClientError } from '@/lib/client';
import { demoOp, isDemoMode } from '@/lib/demo/client';

export function BillingActions({
  planId,
  cancelAtPeriodEnd,
  expiresAtLabel,
  sandbox,
}: {
  planId: string;
  cancelAtPeriodEnd: boolean;
  expiresAtLabel: string | null;
  sandbox: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'cancel' | 'resume') {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({ op: action === 'cancel' ? 'plan.cancelRenewal' : 'plan.resumeRenewal' });
      } else {
        await apiPost('/api/billing/renewal', { action });
      }
      toast.success(
        action === 'cancel' ? 'Perpanjangan otomatis dibatalkan.' : 'Perpanjangan otomatis diaktifkan kembali.',
        action === 'cancel'
          ? `Akses tetap aktif sampai ${expiresAtLabel ?? 'akhir periode'}, lalu turun ke Free.`
          : 'Paket akan diperpanjang otomatis pada akhir periode (simulasi sandbox).',
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal memproses aksi billing.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (planId === 'free') {
    return (
      <InfoBanner tone="info" title="Paket Free tidak memiliki tagihan berulang">
        Tidak ada perpanjangan otomatis yang perlu diatur. Untuk membuka fitur berbayar, buka halaman{' '}
        <strong>Paket &amp; Harga</strong>.
      </InfoBanner>
    );
  }

  return (
    <div className="space-y-3">
      {!sandbox ? (
        <InfoBanner tone="danger" title="Provider pembayaran belum dikonfigurasi">
          Perpanjangan otomatis tidak dapat dijalankan tanpa gateway nyata. Status pembayaran akan ditandai{' '}
          <em>menunggu konfirmasi</em>, bukan berhasil.
        </InfoBanner>
      ) : null}

      {error ? <InfoBanner tone="danger">{error}</InfoBanner> : null}

      {cancelAtPeriodEnd ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-amber-900">
            Perpanjangan otomatis <strong>dibatalkan</strong>. Akses aktif sampai {expiresAtLabel ?? 'akhir periode'}.
          </p>
          <button type="button" className="btn-primary btn-sm" onClick={() => run('resume')} disabled={busy}>
            {busy ? 'Memproses…' : 'Aktifkan kembali perpanjangan'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-line bg-violet-50/40 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-brand-muted">
            Perpanjangan otomatis <strong className="text-brand-ink">aktif</strong>. Pada akhir periode, paket akan
            diperpanjang {sandbox ? '(simulasi sandbox, ditandai demo)' : '(menunggu konfirmasi pembayaran nyata)'}.
          </p>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirming(true)} disabled={busy}>
            Batalkan perpanjangan
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Batalkan perpanjangan otomatis?"
        message={
          <div className="space-y-2">
            <p>
              Akses berbayarmu <strong>tetap aktif</strong> sampai {expiresAtLabel ?? 'akhir periode'} — tidak ada yang
              dicabut seketika.
            </p>
            <p className="text-brand-muted">
              Setelah masa itu habis, paket otomatis turun ke Free dan fitur berbayar dinonaktifkan. Datamu tidak
              dihapus, dan kamu bisa berlangganan lagi kapan saja.
            </p>
          </div>
        }
        confirmLabel="Ya, batalkan perpanjangan"
        cancelLabel="Biarkan aktif"
        busy={busy}
        onConfirm={() => run('cancel')}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
