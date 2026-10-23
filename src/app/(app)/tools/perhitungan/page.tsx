import Link from 'next/link';
import { PerhitunganBukti } from '@/components/tools/PerhitunganBukti';

export const metadata = {
  title: 'Bukti Perhitungan | Whenly',
  description: 'Uji rumus normalisasi biaya, clamping tanggal, dan proyeksi pengeluaran langsung dari fungsi asli aplikasi.',
};

export default function PerhitunganPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Alat Uji</p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Bukti Perhitungan Whenly</h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Kembali ke Dashboard
          </Link>
        </div>
        <p className="max-w-3xl text-sm text-slate-600">
          Halaman ini memakai <span className="font-medium text-slate-900">fungsi perhitungan asli</span> dari aplikasi (
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/lib/subscriptions.ts</code>,{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/lib/dates.ts</code>,{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">src/lib/money.ts</code>). Hasilnya persis sama dengan yang dipakai di Dashboard &amp; Analitik.
        </p>
      </header>

      <PerhitunganBukti />
    </div>
  );
}
