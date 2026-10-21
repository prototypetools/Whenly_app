'use client';

/**
 * Pembuat sesi demo + pengalih halaman.
 * Dirender oleh `/guest` dan `/login` pada build demo.
 */

import { useEffect, useRef, useState } from 'react';
import { startDemoSession, DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo/bootstrap';

export function GuestLogin({
  email = DEMO_EMAIL,
  password = DEMO_PASSWORD,
  redirectTo = '/dashboard',
}: {
  email?: string;
  password?: string;
  redirectTo?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void startDemoSession(email, password)
      .then((ok) => {
        if (!ok) {
          setError('Sesi demo tidak bisa dibuat. Muat ulang halaman ini.');
          return;
        }
        // `location.assign` (bukan router.push) memaksa request dokumen
        // baru, sehingga cookie sesi yang baru dibuat ikut terkirim.
        window.location.assign(redirectTo);
      })
      .catch(() => setError('Gagal membuat sesi demo.'));
  }, [email, password, redirectTo]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <img src="/images/whenly-logo.png" alt="Whenly" className="h-12 w-12 rounded-2xl object-contain" />
      <p className="text-sm font-semibold text-brand-ink">
        {error ? 'Tidak bisa masuk sebagai tamu' : 'Menyiapkan sesi demo…'}
      </p>
      <p className="text-xs text-brand-muted">
        {error ?? 'Kamu akan diarahkan ke dashboard dengan data contoh.'}
      </p>
      {error ? (
        <a href="/login" className="link text-sm">
          Kembali ke halaman masuk
        </a>
      ) : null}
    </div>
  );
}
