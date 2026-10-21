'use client';

/**
 * Pengaturan pengingat.
 * Hanya kanal DALAM APLIKASI yang benar-benar berfungsi. Kanal email/push
 * ditampilkan sebagai belum tersedia dengan penjelasan teknis — bukan tombol palsu.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, Field, InfoBanner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPut, ApiClientError } from '@/lib/client';
import { demoOp, isDemoMode } from '@/lib/demo/client';

export function ReminderSettingsForm({
  initial,
  isPremiumPlan,
}: {
  initial: { defaultDaysBefore: number; inAppEnabled: boolean; emailEnabled: boolean };
  isPremiumPlan: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [days, setDays] = useState(String(initial.defaultDaysBefore));
  const [inApp, setInApp] = useState(initial.inAppEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({ op: 'reminder.save', defaultDaysBefore: Number(days), inAppEnabled: inApp });
        toast.success('Pengaturan pengingat disimpan.', `Pengingat default: H-${days}.`);
        router.refresh();
        return;
      }
      await apiPut('/api/reminders', {
        defaultDaysBefore: Number(days),
        inAppEnabled: inApp,
        emailEnabled: false,
      });
      toast.success('Pengaturan pengingat disimpan.', `Pengingat default: H-${days}.`);
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengaturan.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Pengaturan pengingat"
        subtitle="Menentukan kapan sebuah tagihan mulai ditandai mendesak di dashboard dan halaman ini."
      />
      <div className="space-y-4 p-5">
        <Field
          label="Ingatkan berapa hari sebelum jatuh tempo"
          htmlFor="reminder-days"
          hint="0 berarti diingatkan pada hari-H. Berlaku sebagai nilai default untuk langganan baru."
        >
          <input
            id="reminder-days"
            type="number"
            min={0}
            max={60}
            className="input tnum max-w-[10rem]"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </Field>

        <label className="flex items-start gap-3 rounded-xl border border-brand-line p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-brand-line text-violet-600 focus:ring-violet-500"
            checked={inApp}
            onChange={(event) => setInApp(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-brand-ink">Pengingat dalam aplikasi</span>
            <span className="block text-xs text-brand-muted">
              Menampilkan tagihan mendesak di dashboard, daftar renewal, dan kalender. Tidak mengirim pesan apa pun.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-brand-line bg-violet-50/40 p-3 opacity-70">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-brand-line" checked={false} disabled />
          <span>
            <span className="block text-sm font-semibold text-brand-ink">Pengingat email (belum tersedia)</span>
            <span className="block text-xs text-brand-muted">
              Memerlukan layanan pengirim email (mis. Resend/SendGrid) beserta scheduler (cron) yang belum dikonfigurasi
              pada prototype ini. Karena itu opsi ini dinonaktifkan, bukan disimulasikan.
            </span>
          </span>
        </label>

        {!isPremiumPlan ? (
          <InfoBanner tone="info" title="Paket Free">
            Pengingat dalam aplikasi sudah aktif. Pengaturan pengingat lanjutan (per-langganan prioritas,
            penyesuaian massal) tersedia pada paket Premium/Student — namun semua langganan tetap bisa diatur
            pengingatnya satu per satu.
          </InfoBanner>
        ) : null}

        {initial.emailEnabled ? (
          <InfoBanner tone="warn" title="Status email">
            Nilai `emailEnabled` di database sebelumnya pernah aktif, tetapi server selalu menulis ulang menjadi nonaktif
            karena provider email belum ada.
          </InfoBanner>
        ) : null}

        {error ? <InfoBanner tone="danger">{error}</InfoBanner> : null}

        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan pengaturan'}
          </button>
        </div>
      </div>
    </Card>
  );
}
