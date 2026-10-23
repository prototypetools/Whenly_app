'use client';

/**
 * Pengaturan pengingat.
 *
 * Pengingat dalam aplikasi selalu aktif. Pengingat email hanya bisa
 * diaktifkan bila server sudah dikonfigurasi (RESEND_API_KEY tersedia),
 * sehingga tidak ada tombol yang berpura-pura berfungsi.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, Field, InfoBanner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPost, apiPut, ApiClientError } from '@/lib/client';
import { demoOp, isDemoMode } from '@/lib/demo/client';

type TestState = { status: 'sent' | 'skipped' | 'failed'; message: string } | null;

export function ReminderSettingsForm({
  initial,
  isPremiumPlan,
  emailConfigured,
}: {
  initial: { defaultDaysBefore: number; inAppEnabled: boolean; emailEnabled: boolean };
  isPremiumPlan: boolean;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [days, setDays] = useState(String(initial.defaultDaysBefore));
  const [inApp, setInApp] = useState(initial.inAppEnabled);
  const [email, setEmail] = useState(initial.emailEnabled);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestState>(null);
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
        emailEnabled: email,
      });
      toast.success(
        'Pengaturan pengingat disimpan.',
        email ? `Email aktif: dikirim pada H-${days}, H-1, dan hari-H.` : `Pengingat default: H-${days}.`,
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengaturan.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiPost<{ status: 'sent' | 'skipped' | 'failed'; message: string }>(
        '/api/reminders/test',
      );
      setTestResult(result);
      if (result.status === 'sent') toast.success('Email uji terkirim.', result.message);
      else toast.error('Email uji belum terkirim.', result.message);
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal mengirim email uji.';
      setTestResult({ status: 'failed', message });
      toast.error(message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Pengaturan pengingat"
        subtitle="Menentukan kapan sebuah tagihan mulai ditandai mendesak di dashboard dan kapan email dikirim."
      />
      <div className="space-y-4 p-5">
        <Field
          label="Ingatkan berapa hari sebelum jatuh tempo"
          htmlFor="reminder-days"
          hint="0 berarti diingatkan pada hari-H. Email dikirim pada H-{jumlah ini}, H-1, dan hari-H."
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

        <label
          className={`flex items-start gap-3 rounded-xl border p-3 ${
            emailConfigured ? 'border-brand-line bg-violet-50/40' : 'border-brand-line bg-slate-50 opacity-70'
          }`}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-brand-line text-violet-600 focus:ring-violet-500"
            checked={email}
            disabled={!emailConfigured}
            onChange={(event) => setEmail(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-brand-ink">
              Pengingat email {emailConfigured ? '' : '(belum dikonfigurasi)'}
            </span>
            <span className="block text-xs text-brand-muted">
              {emailConfigured
                ? 'Email otomatis dikirim oleh cron harian pada H-{jumlah di atas}, H-1, dan hari-H. Satu email per tagihan, tidak akan dobel.'
                : 'Isi RESEND_API_KEY di environment Vercel agar email bisa dikirim. Selama belum diisi, opsi ini dinonaktifkan — bukan disimulasikan.'}
            </span>
          </span>
        </label>

        {isPremiumPlan ? (
          <InfoBanner tone="info" title="Paket kamu">
            Pengaturan pengingat lanjutan (prioritas per-langganan) aktif untuk paket Premium/Student.
          </InfoBanner>
        ) : (
          <InfoBanner tone="info" title="Paket Free">
            Pengingat dalam aplikasi sudah aktif. Pengaturan lanjutan (prioritas per-langganan) tersedia pada paket
            Premium/Student, namun semua langganan tetap bisa diatur satu per satu.
          </InfoBanner>
        )}

        {testResult ? (
          <InfoBanner
            tone={testResult.status === 'sent' ? 'success' : testResult.status === 'failed' ? 'danger' : 'warn'}
            title={testResult.status === 'sent' ? 'Email terkirim' : 'Email belum terkirim'}
          >
            {testResult.message}
          </InfoBanner>
        ) : null}

        {error ? <InfoBanner tone="danger">{error}</InfoBanner> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={sendTest}
            disabled={testing || isDemoMode()}
            title={isDemoMode() ? 'Tidak tersedia pada mode demo.' : 'Kirim email uji ke alamat akunmu.'}
          >
            {testing ? 'Mengirim…' : 'Kirim email uji'}
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan pengaturan'}
          </button>
        </div>
      </div>
    </Card>
  );
}
