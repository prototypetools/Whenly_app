'use client';

/**
 * Aksi per-langganan yang dipakai ulang di beberapa halaman.
 * Semua aksi memanggil API (yang menegakkan aturan paket di server) lalu
 * menyegarkan data halaman. Pada `NEXT_PUBLIC_DEMO_MODE=true`, aksi
 * dijalankan terhadap penyimpanan demo di localStorage.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Field, InfoBanner, buttonClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiDelete, apiPatch, apiPost, ApiClientError } from '@/lib/client';
import { demoDeleteSub, demoExtendSub, demoPaySub, demoUpdateSub, isDemoMode } from '@/lib/demo/client';

function handleError(showToast: (message: string, detail?: string) => void, error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    showToast(error.message, error.code === 'PLAN_LIMIT_REACHED' ? 'Kuota paket tercapai.' : undefined);
  } else {
    showToast(fallback);
  }
}

/** Menandai tagihan siklus ini sudah dibayar (mencatat pembayaran + memajukan renewal). */
export function MarkPaidButton({
  id,
  name,
  amountLabel,
  nextRenewalLabel,
  compact = false,
}: {
  id: string;
  name: string;
  amountLabel: string;
  nextRenewalLabel: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      if (isDemoMode()) {
        const result = await demoPaySub('', id, 1);
        toast.success(`${name} ditandai sudah dibayar.`, `Renewal berikutnya: ${result.nextRenewal}.`);
        setOpen(false);
        router.refresh();
        return;
      }
      const result = await apiPost<{ nextRenewal: string }>(`/api/subscriptions/${id}/pay`, { advance: true });
      toast.success(`${name} ditandai sudah dibayar.`, `Renewal berikutnya: ${result.nextRenewal}.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      handleError(toast.error, error, 'Gagal menandai pembayaran.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={buttonClass('secondary', compact ? 'btn-sm' : undefined)} onClick={() => setOpen(true)}>
        ✅ Tandai dibayar
      </button>
      <ConfirmDialog
        open={open}
        tone="primary"
        title={`Tandai ${name} sudah dibayar?`}
        confirmLabel="Ya, tandai dibayar"
        cancelLabel="Batal"
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        message={
          <div className="space-y-3">
            <p>
              Pencatatan manual: pembayaran sebesar <strong>{amountLabel}</strong> akan dicatat sebagai riwayat, dan
              tanggal renewal dimajukan satu siklus.
            </p>
            <InfoBanner tone="info">
              Tanggal renewal sekarang: <strong>{nextRenewalLabel}</strong>. Ini <em>bukan</em> konfirmasi dari gateway
              pembayaran — kamu sendiri yang menandainya.
            </InfoBanner>
          </div>
        }
      />
    </>
  );
}

/** Memajukan tanggal renewal N siklus tanpa mencatat pembayaran. */
export function ExtendButton({ id, name, cycleLabel }: { id: string; name: string; cycleLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState(1);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (isDemoMode()) {
        const result = await demoExtendSub('', id, steps);
        toast.success(`Renewal ${name} diperpanjang ${steps} siklus.`, `Tanggal baru: ${result.nextRenewal}.`);
        setOpen(false);
        router.refresh();
        return;
      }
      const result = await apiPost<{ nextRenewal: string }>(`/api/subscriptions/${id}/extend`, { steps });
      toast.success(`Renewal ${name} diperpanjang ${steps} siklus.`, `Tanggal baru: ${result.nextRenewal}.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      handleError(toast.error, error, 'Gagal memperpanjang.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
        ⏭ Perpanjang
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Perpanjang ${name}`}
        description="Memajukan tanggal renewal tanpa mencatat pembayaran."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Memproses…' : 'Perpanjang'}
            </button>
          </>
        }
      >
        <Field
          label="Jumlah siklus"
          hint={`Satu siklus = ${cycleLabel}. Maksimal 12 siklus sekaligus.`}
          htmlFor={`steps-${id}`}
        >
          <input
            id={`steps-${id}`}
            type="number"
            min={1}
            max={12}
            className="input"
            value={steps}
            onChange={(event) => setSteps(Math.min(12, Math.max(1, Number(event.target.value) || 1)))}
          />
        </Field>
      </Modal>
    </>
  );
}

/** Menghapus langganan (dengan konfirmasi). */
export function DeleteSubscriptionButton({ id, name, compact }: { id: string; name: string; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      if (isDemoMode()) {
        await demoDeleteSub('', id);
        toast.success(`${name} dihapus.`);
        setOpen(false);
        router.refresh();
        return;
      }
      await apiDelete(`/api/subscriptions/${id}`);
      toast.success(`${name} dihapus.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      handleError(toast.error, error, 'Gagal menghapus.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={buttonClass('ghost', `text-red-600 hover:bg-red-50 hover:text-red-700 ${compact ? 'btn-sm' : ''}`)}
        onClick={() => setOpen(true)}
        aria-label={`Hapus ${name}`}
      >
        🗑 Hapus
      </button>
      <ConfirmDialog
        open={open}
        title={`Hapus ${name}?`}
        confirmLabel="Hapus permanen"
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={remove}
        message={
          <p>
            Data langganan <strong>{name}</strong> beserta keterkaitannya akan dihapus permanen. Riwayat pembayaran yang
            sudah tercatat tetap tersimpan untuk analitik.
          </p>
        }
      />
    </>
  );
}

/** Menjeda atau mengaktifkan kembali langganan. */
export function StatusToggleButton({ id, name, status }: { id: string; name: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (status === 'canceled' || status === 'expired') return null;
  const nextStatus = status === 'active' ? 'paused' : 'active';
  const label = status === 'active' ? '⏸ Nonaktifkan' : '▶ Aktifkan';

  async function toggle() {
    setBusy(true);
    try {
      if (isDemoMode()) {
        await demoUpdateSub('', id, { status: nextStatus });
        toast.success(nextStatus === 'active' ? `${name} diaktifkan kembali.` : `${name} dinonaktifkan.`, nextStatus === 'active' ? undefined : 'Langganan nonaktif tidak dihitung ke total pengeluaran.');
        router.refresh();
        return;
      }
      await apiPatch(`/api/subscriptions/${id}`, { status: nextStatus });
      toast.success(nextStatus === 'active' ? `${name} diaktifkan kembali.` : `${name} dinonaktifkan.`, nextStatus === 'active' ? undefined : 'Langganan nonaktif tidak dihitung ke total pengeluaran.');
      router.refresh();
    } catch (error) {
      handleError(toast.error, error, 'Gagal mengubah status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-ghost btn-sm" onClick={toggle} disabled={busy}>
      {busy ? '…' : label}
    </button>
  );
}
