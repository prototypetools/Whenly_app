import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { isDemoBuild } from '@/lib/demo/constants';

export const dynamic = 'force-dynamic';

/**
 * Pada mode demo tidak ada database, sehingga pendaftaran akun baru
 * tidak mungkin. Pengunjung diarahkan ke halaman masuk (yang otomatis
 * memakai akun demo).
 */
export default function RegisterPage() {
  if (isDemoBuild()) redirect('/login');
  return <RegisterForm />;
}
