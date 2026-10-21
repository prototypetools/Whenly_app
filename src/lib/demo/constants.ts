/**
 * ============================================================
 * Konstanta mode demo — aman untuk Server & Client Component
 * ============================================================
 * File ini TIDAK memakai `'use client'`, sehingga nilainya boleh
 * dibaca dari Server Component (mis. halaman /login dan landing page).
 */

/**
 * Apakah build ini adalah build demo.
 * `NEXT_PUBLIC_*` di-inline oleh Next.js saat build, jadi nilainya
 * sama di server maupun di browser.
 */
export function isDemoBuild(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

export const DEMO_EMAIL = 'demo@subscriptly.id';
export const DEMO_PASSWORD = 'demo12345';

/** Akun demo yang tersedia untuk tombol cepat di halaman masuk. */
export const DEMO_ACCOUNTS = [
  { email: 'demo@subscriptly.id', label: 'Premium · data lengkap' },
  { email: 'gratis@subscriptly.id', label: 'Free · 5 langganan (batas kuota)' },
  { email: 'pelajar@subscriptly.id', label: 'Free · verifikasi pelajar pending' },
] as const;
