'use client';

/**
 * ============================================================
 * Mode demo (server-backed)
 * ============================================================
 * Saat `NEXT_PUBLIC_DEMO_MODE=true`:
 *  - Tidak ada database: autentikasi & data disimpan di memori proses
 *    server (lihat `lib/demo/dataset.ts`).
 *  - Cookie sesi memakai format stateless `tok_<userId>`, sehingga Server
 *    Component (`requireUser()`) dapat mengenali pengguna demo.
 *
 * PENTING: modul ini TIDAK diekspor ke Server Component. Nilai yang
 * dipakai server (`isDemoBuild`, `DEMO_*`) ada di `./constants` —
 * memakai modul `'use client'` dari Server Component pernah memicu
 * `TypeError: (0, i.sW) is not a function` pada build produksi.
 */

import { demoLogin } from './client';
import { DEMO_EMAIL, DEMO_PASSWORD } from './constants';

export { DEMO_ACCOUNTS, DEMO_EMAIL, DEMO_PASSWORD } from './constants';

/**
 * Membuat sesi demo (cookie stateless + localStorage). Mengembalikan false
 * bila mode demo tidak aktif.
 */
export async function startDemoSession(
  email: string = DEMO_EMAIL,
  password: string = DEMO_PASSWORD,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return false;
  await demoLogin(email, password);
  return true;
}
