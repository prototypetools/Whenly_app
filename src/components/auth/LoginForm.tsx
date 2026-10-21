'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field, InfoBanner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPost } from '@/lib/client';
import { demoLogin, isDemoMode } from '@/lib/demo/client';
import { startDemoSession } from '@/lib/demo/bootstrap';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo/constants';

const DEMO_REDIRECT = '/dashboard';

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demoBuild = demoMode;

  /**
   * Setelah sesi demo dibuat, cookie-nya hanya terkirim pada request
   * berikutnya. Karena itu navigasi harus memuat dokumen baru
   * (`location.assign`), bukan navigasi SPA (`router.push`).
   */
  function goToDashboard() {
    window.location.assign(DEMO_REDIRECT);
  }

  async function guestLogin() {
    setBusy(true);
    setError(null);
    try {
      const ok = await startDemoSession();
      if (!ok) throw new Error('Sesi demo tidak bisa dibuat.');
      goToDashboard();
    } catch {
      setBusy(false);
      setError('Gagal menyiapkan sesi demo. Muat ulang halaman lalu coba lagi.');
    }
  }

  async function submit(nextEmail = email, nextPassword = password) {
    setBusy(true);
    setError(null);
    try {
      if (isDemoMode()) {
        try {
          await demoLogin(nextEmail, nextPassword);
          toast.success('Berhasil masuk. Selamat datang kembali!');
          goToDashboard();
          return;
        } catch (e: any) {
          const message = e.message === 'INVALID_CREDENTIALS' ? 'Email atau password salah.' : e.message || 'Gagal masuk.';
          setError(message);
          toast.error(message);
          setBusy(false);
          return;
        }
      }
      await apiPost('/api/auth/login', { email: nextEmail, password: nextPassword });
      toast.success('Berhasil masuk. Selamat datang kembali!');
      router.push(DEMO_REDIRECT);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal masuk.';
      setError(message);
      toast.error(message);
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {error ? <InfoBanner tone="danger" title="Tidak bisa masuk">{error}</InfoBanner> : null}

      {demoBuild ? (
        <button type="button" className="btn-primary w-full" onClick={guestLogin} disabled={busy}>
          {busy ? 'Menyiapkan sesi…' : '🚀 Masuk sebagai tamu (paket Premium)'}
        </button>
      ) : null}

      <Field label="Email" htmlFor="email" required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          placeholder="nama@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <button type="submit" className="btn-secondary w-full" disabled={busy}>
        {busy ? 'Memeriksa…' : 'Masuk'}
      </button>

      {demoBuild ? null : (
        <p className="text-center text-sm text-brand-muted">
          Belum punya akun?{' '}
          <Link href="/register" className="link">
            Daftar gratis
          </Link>
        </p>
      )}

      <div className="rounded-xl border border-brand-line bg-violet-50/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Akun demo (siap pakai)</p>
        <ul className="mt-2 space-y-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                  void submit(account.email, DEMO_PASSWORD);
                }}
                className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-left text-sm hover:border-violet-300 hover:bg-violet-50 disabled:opacity-60"
              >
                <span className="block font-semibold text-brand-ink">{account.email}</span>
                <span className="block text-xs text-brand-muted">{account.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-brand-muted">Password akun demo: {DEMO_PASSWORD}</p>
      </div>

      {demoBuild ? (
        <p className="text-center text-xs text-brand-muted">
          Mode demo: data disimpan sementara di server (tanpa database) dan bisa direset kapan saja.
        </p>
      ) : null}
    </form>
  );
}
