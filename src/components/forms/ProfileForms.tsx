'use client';

/**
 * Form profil, ganti password, dan zona berbahaya.
 * Semua validasi ulang dilakukan server; UI hanya membantu.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, Field, InfoBanner } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { apiPatch, apiPost, apiDelete, ApiClientError } from '@/lib/client';
import { demoLogout, demoOp, isDemoMode } from '@/lib/demo/client';

const TIMEZONE_OPTIONS = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
];

const AVATAR_COLORS = [
  { value: '#6d28d9', label: 'Ungu' },
  { value: '#2563eb', label: 'Biru' },
  { value: '#0891b2', label: 'Sian' },
  { value: '#0d9488', label: 'Teal' },
  { value: '#db2777', label: 'Pink' },
  { value: '#ea580c', label: 'Oranye' },
];

// ------------------------------------------------------------------
// Profil
// ------------------------------------------------------------------

export function ProfileSettingsForm({
  initial,
}: {
  initial: { name: string; email: string; timezone: string; locale: string; avatarColor: string; isDemo: boolean };
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [locale, setLocale] = useState(initial.locale);
  const [avatarColor, setAvatarColor] = useState(initial.avatarColor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({ op: 'profile.save', name: name.trim(), timezone, avatarColor });
      } else {
        await apiPatch('/api/profile', { name: name.trim(), timezone, locale, avatarColor });
      }
      toast.success('Profil diperbarui.', 'Perubahan berlaku pada semua halaman.');
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal memperbarui profil.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Profil" subtitle="Nama, zona waktu, dan warna avatar." />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Nama" htmlFor="pf-name" required>
          <input id="pf-name" className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="pf-email" hint="Email tidak dapat diubah pada prototype ini.">
          <input id="pf-email" className="input" value={initial.email} readOnly disabled />
        </Field>
        <Field label="Zona waktu" htmlFor="pf-tz" hint="Dipakai untuk perhitungan tanggal jatuh tempo & pengingat.">
          <select id="pf-tz" className="input" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {!TIMEZONE_OPTIONS.includes(timezone) ? <option value={timezone}>{timezone}</option> : null}
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bahasa tampilan" htmlFor="pf-locale">
          <select id="pf-locale" className="input" value={locale} onChange={(event) => setLocale(event.target.value)}>
            <option value="id-ID">Bahasa Indonesia</option>
            <option value="en-US">English (US)</option>
          </select>
        </Field>

        <Field label="Warna avatar" htmlFor="pf-color" className="sm:col-span-2" hint="Dipakai pada inisial di bilah atas.">
          <div className="flex flex-wrap items-center gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setAvatarColor(color.value)}
                className={
                  'h-8 w-8 rounded-lg border-2 transition-transform ' +
                  (avatarColor.toLowerCase() === color.value ? 'scale-110 border-brand-ink' : 'border-transparent')
                }
                style={{ backgroundColor: color.value }}
                aria-label={`Warna ${color.label}`}
                aria-pressed={avatarColor.toLowerCase() === color.value}
              />
            ))}
            <input
              id="pf-color"
              className="input tnum max-w-[10rem]"
              value={avatarColor}
              onChange={(event) => setAvatarColor(event.target.value)}
              aria-label="Warna avatar dalam HEX"
            />
          </div>
        </Field>

        {error ? (
          <div className="sm:col-span-2">
            <InfoBanner tone="danger">{error}</InfoBanner>
          </div>
        ) : null}

        <div className="flex sm:col-span-2 sm:justify-end">
          <button type="button" className="btn-primary" onClick={submit} disabled={busy || name.trim().length < 2}>
            {busy ? 'Menyimpan…' : 'Simpan profil'}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------
// Ganti password
// ------------------------------------------------------------------

export function PasswordForm() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function submit() {
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        toast.success('Mode demo: password tidak diubah.', 'Akun demo memakai password tetap (demo12345).');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        return;
      }
      const result = await apiPost<{ updated: boolean; otherSessionsRemoved: number }>('/api/profile/password', {
        currentPassword,
        newPassword,
      });
      toast.success(
        'Password berhasil diganti.',
        result.otherSessionsRemoved > 0
          ? `${result.otherSessionsRemoved} sesi lain diputuskan atas alasan keamanan.`
          : 'Sesi ini tetap aktif.',
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal mengganti password.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Keamanan" subtitle="Ganti password. Semua sesi lain akan otomatis diputuskan." />
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <Field label="Password saat ini" htmlFor="pw-current" required>
          <input
            id="pw-current"
            type="password"
            className="input"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="Password baru" htmlFor="pw-new" required hint="Minimal 8 karakter, mengandung huruf dan angka.">
          <input
            id="pw-new"
            type="password"
            className="input"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field
          label="Ulangi password baru"
          htmlFor="pw-confirm"
          required
          error={mismatch ? 'Konfirmasi password tidak sama.' : null}
        >
          <input
            id="pw-confirm"
            type="password"
            className="input"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>

        {error ? (
          <div className="sm:col-span-3">
            <InfoBanner tone="danger">{error}</InfoBanner>
          </div>
        ) : null}

        <div className="flex sm:col-span-3 sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={submit}
            disabled={busy || !currentPassword || newPassword.length < 8 || mismatch}
          >
            {busy ? 'Memproses…' : 'Ganti password'}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------
// Zona berbahaya
// ------------------------------------------------------------------

export function DangerZone({ subscriptionCount }: { subscriptionCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [resetText, setResetText] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resetData() {
    if (resetText !== 'HAPUS') return;
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({ op: 'account.delete' });
        toast.success('Data langganan dihapus.', 'Mode demo: seluruh langganan akun ini dihapus.');
        setResetText('');
        router.refresh();
        return;
      }
      const result = await apiPost<{ removedSubscriptions: number; removedPayments: number }>('/api/account', {
        action: 'reset-data',
        confirm: 'HAPUS',
      });
      toast.success(
        'Data langganan dihapus.',
        `${result.removedSubscriptions} langganan dan ${result.removedPayments} catatan pembayaran dihapus.`,
      );
      setResetText('');
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal menghapus data.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        await demoOp({ op: 'account.delete' });
        await demoLogout();
        toast.success('Akun demo dihapus.', 'Sesi demo berakhir.');
        router.replace('/login');
        router.refresh();
        return;
      }
      await apiDelete('/api/account', { password: deletePassword, confirm: 'HAPUS PERMANEN' });
      toast.success('Akun dihapus.', 'Semoga cepat bertemu lagi!');
      router.replace('/login');
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal menghapus akun.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-red-200">
      <CardHeader title="Zona berbahaya" subtitle="Tindakan di sini tidak dapat dibatalkan. Baca dengan teliti." />

      <div className="space-y-5 p-5">
        {error ? <InfoBanner tone="danger">{error}</InfoBanner> : null}

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="text-sm font-semibold text-brand-ink">Hapus semua data langganan</h3>
          <p className="mt-1 text-sm text-brand-muted">
            Menghapus <strong>{subscriptionCount} langganan</strong> beserta seluruh riwayat pembayaran. Akun dan paket
            tetap ada. Ketik <code className="rounded bg-white px-1.5 py-0.5 font-semibold">HAPUS</code> untuk
            mengonfirmasi.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="input max-w-[12rem]"
              value={resetText}
              onChange={(event) => setResetText(event.target.value)}
              placeholder="HAPUS"
              aria-label="Ketik HAPUS untuk konfirmasi"
            />
            <button
              type="button"
              className="btn-danger"
              onClick={resetData}
              disabled={busy || resetText !== 'HAPUS' || subscriptionCount === 0}
            >
              {busy ? 'Menghapus…' : 'Hapus semua data langganan'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
          <h3 className="text-sm font-semibold text-red-900">Hapus akun permanen</h3>
          <p className="mt-1 text-sm text-red-800/80">
            Menghapus akun, semua langganan, riwayat pembayaran, dan pengaturan. Kamu akan langsung keluar dan tidak
            bisa masuk kembali.
          </p>
          <div className="mt-3">
            <button type="button" className="btn-danger" onClick={() => setDeleteOpen(true)}>
              Hapus akun saya
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeletePassword('');
          setDeleteText('');
        }}
        title="Hapus akun permanen?"
        description="Tindakan ini tidak dapat dibatalkan."
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setDeleteOpen(false);
                setDeletePassword('');
                setDeleteText('');
              }}
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={deleteAccount}
              disabled={busy || !deletePassword || deleteText !== 'HAPUS PERMANEN'}
            >
              {busy ? 'Menghapus…' : 'Hapus akun permanen'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Password akun" htmlFor="dz-password" required>
            <input
              id="dz-password"
              type="password"
              className="input"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field
            label="Ketik HAPUS PERMANEN"
            htmlFor="dz-confirm"
            required
            hint="Konfirmasi ini mencegah penghapusan yang tidak disengaja."
          >
            <input
              id="dz-confirm"
              className="input"
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              placeholder="HAPUS PERMANEN"
            />
          </Field>
          <InfoBanner tone="danger">Data yang dihapus tidak dapat dipulihkan.</InfoBanner>
        </div>
      </Modal>
    </Card>
  );
}
