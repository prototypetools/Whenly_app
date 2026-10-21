import Link from 'next/link';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card, InfoBanner } from '@/components/ui/primitives';
import { isDemoBuild } from '@/lib/demo/constants';

export const metadata: Metadata = { title: 'Masuk' };
export const dynamic = 'force-dynamic';

/**
 * ============================================================
 * Catatan penting: /login pada build demo
 * ============================================================
 * Halaman `(app)` memakai `requireUser()` — cek cookie sesi di
 * database. Pada build ini tidak ada database (deployment 500 saat
 * login), sehingga pengunjung tidak akan pernah bisa melewati
 * halaman itu lewat form biasa.
 *
 * Solusinya: halaman ini menampilkan tautan "masuk sebagai tamu".
 * Tautan itu menuju route yang membuat sesi demo di sisi klien lalu
 * masuk ke /dashboard. Sesi demo ditulis oleh `startDemoSession()`
 * (localStorage + cookie `Whenly_session`) tepat sebelum navigasi.
 */
export default function LoginPage() {
  const demoBuild = isDemoBuild();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-violet-700 via-violet-800 to-blue-900 p-10 text-violet-50 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/images/whenly-logo.png" alt="Whenly" className="h-9 w-9 rounded-xl object-contain" />
          <span className="text-lg font-bold text-white">Whenly</span>
        </Link>
        <div>
          <h1 className="text-3xl font-bold leading-tight text-white">
            Langganan yang rapi,
            <br />
            uang bulanan yang lebih aman.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-violet-100">
            Catat semua langgananmu, pantau free trial, dan lihat total pengeluaran bulanan serta tahunan dalam Rupiah —
            dihitung dari data aslimu, bukan angka dekoratif.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-violet-100">
            <li>✓ Pengingat renewal &amp; hitung mundur</li>
            <li>✓ Analitik pengeluaran &amp; anggaran bulanan</li>
            <li>✓ Harga khusus pelajar dengan verifikasi</li>
          </ul>
        </div>
        <p className="text-xs text-violet-200">Zona waktu Asia/Jakarta · Mata uang Rupiah</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 flex items-center gap-2.5 lg:hidden">
            <img src="/images/whenly-logo.png" alt="Whenly" className="h-9 w-9 rounded-xl object-contain" />
            <span className="text-lg font-bold text-brand-ink">Whenly</span>
          </Link>

          {demoBuild ? (
            <div className="mb-5">
              <InfoBanner tone="warn" title="Build ini berjalan pada mode demo">
                Backend database belum dikonfigurasi, jadi <strong>form masuk dengan email tidak akan berhasil</strong>{' '}
                (server mengembalikan error). Gunakan tombol <em>Masuk sebagai tamu</em> di bawah untuk mencoba aplikasi
                dengan data contoh. Semua data disimpan di peramban kamu.
              </InfoBanner>
            </div>
          ) : null}

          <Card className="card-pad">
            <h2 className="text-xl font-bold text-brand-ink">{demoBuild ? 'Coba Whenly (demo)' : 'Masuk ke akunmu'}</h2>
            <p className="mt-1 mb-5 text-sm text-brand-muted">
              {demoBuild
                ? 'Masuk cepat sebagai tamu, atau coba akun contoh lain di bawah.'
                : 'Gunakan akunmu, atau pilih salah satu akun demo di bawah.'}
            </p>
            <LoginForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
