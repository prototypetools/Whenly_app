'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field, InfoBanner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { apiPost } from '@/lib/client';

export function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function update(key: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};

    if (form.name.trim().length < 2) errors.name = 'Nama minimal 2 karakter.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errors.email = 'Format email tidak valid.';
    if (form.password.length < 8) errors.password = 'Password minimal 8 karakter.';
    else if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password))
      errors.password = 'Password harus mengandung huruf dan angka.';
    if (form.password !== form.confirm) errors.confirm = 'Konfirmasi password tidak sama.';

    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setBusy(true);
    try {
      await apiPost('/api/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast.success('Akun dibuat. Selamat datang di Whenly!', 'Kamu memakai paket Free dengan kuota 5 langganan aktif.');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mendaftar.';
      setError(message);
      toast.error(message);
      setBusy(false);
    }
  }

  const strength = (() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1;
    if (/\d/.test(p)) score += 1;
    if (/[^a-zA-Z0-9]/.test(p)) score += 1;
    return score;
  })();

  const strengthLabel = ['Sangat lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][strength];

  return (
    <form className="space-y-4" onSubmit={submit}>
      {error ? <InfoBanner tone="danger" title="Pendaftaran gagal">{error}</InfoBanner> : null}

      <Field label="Nama lengkap" htmlFor="name" required error={fieldErrors.name}>
        <input id="name" className="input" autoComplete="name" placeholder="Nama kamu" value={form.name} onChange={update('name')} required />
      </Field>

      <Field label="Email" htmlFor="email" required error={fieldErrors.email}>
        <input id="email" type="email" className="input" autoComplete="email" placeholder="nama@email.com" value={form.email} onChange={update('email')} required />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={fieldErrors.password}
        hint="Minimal 8 karakter, mengandung huruf dan angka."
      >
        <input id="password" type="password" className="input" autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={update('password')} required />
      </Field>

      {form.password ? (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100">
            <div
              className={['h-full rounded-full transition-all', strength <= 1 ? 'bg-red-500' : strength === 2 ? 'bg-amber-500' : 'bg-emerald-500'].join(' ')}
              style={{ width: `${(strength / 4) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-brand-muted">{strengthLabel}</span>
        </div>
      ) : null}

      <Field label="Ulangi password" htmlFor="confirm" required error={fieldErrors.confirm}>
        <input id="confirm" type="password" className="input" autoComplete="new-password" placeholder="••••••••" value={form.confirm} onChange={update('confirm')} required />
      </Field>

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? 'Membuat akun…' : 'Daftar dan mulai gratis'}
      </button>

      <p className="text-center text-sm text-brand-muted">
        Sudah punya akun?{' '}
        <Link href="/login" className="link">
          Masuk
        </Link>
      </p>

      <p className="text-center text-xs text-brand-muted">
        Dengan mendaftar kamu langsung memakai paket <strong>Free</strong> (maksimal 5 langganan aktif). Tidak perlu data
        pembayaran.
      </p>
    </form>
  );
}
