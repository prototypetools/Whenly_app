import { redirect } from 'next/navigation';
import { GuestLogin } from '@/components/auth/GuestLogin';
import { isDemoBuild } from '@/lib/demo/constants';

export const metadata = { title: 'Masuk sebagai tamu' };
export const dynamic = 'force-dynamic';

/**
 * Route perantara untuk mode demo.
 *
 * Server selalu mengalihkan ke /login (di sana `GuestLogin` membuat
 * sesi demo di localStorage + cookie), lalu halaman masuk
 * mengarahkan pengunjung ke /dashboard dari sisi klien. Pola ini
 * dipakai karena cookie yang dibuat lewat JavaScript hanya terkirim
 * pada request berikutnya — bukan pada navigasi yang sedang berjalan.
 */
export default function GuestEntryPage() {
  if (!isDemoBuild()) redirect('/login');
  return <GuestLogin />;
}
