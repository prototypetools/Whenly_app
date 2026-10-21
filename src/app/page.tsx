import Link from 'next/link';
import { COMPARISON_ROWS, PLANS, getPlan, yearlySavings } from '@/config/plans';
import { formatIDR } from '@/lib/money';
import { Badge, Card, InfoBanner, LinkButton } from '@/components/ui/primitives';
import { getCurrentUser } from '@/lib/auth';
import { isDemoBuild } from '@/lib/demo/constants';

export const dynamic = 'force-dynamic';

const LANDING_FEATURES = [
  {
    emoji: '📊',
    title: 'Dashboard dari data nyata',
    body: 'Jumlah langganan aktif, total bulanan, estimasi tahunan, sisa anggaran, dan tagihan terdekat — semuanya dihitung dari catatanmu, bukan angka contoh.',
  },
  {
    emoji: '🧾',
    title: 'Kelola langganan lengkap',
    body: 'Tambah, ubah, hapus, cari, filter, dan urutkan. Mendukung siklus mingguan, bulanan, tahunan, dan interval kustom (mis. per 90 hari).',
  },
  {
    emoji: '📅',
    title: 'Renewal & pengingat dalam aplikasi',
    body: 'Kalender renewal, hitung mundur, prioritas pengingat, dan status sudah dibayar atau belum. Pengingat email belum tersedia — kami menyatakannya terbuka.',
  },
  {
    emoji: '⏳',
    title: 'Pelacak free trial',
    body: 'Catat tanggal mulai, tanggal berakhir, estimasi tagihan pertama, dan harga setelah trial. Peringatan sebelum trial berakhir, tanpa klaim pembatalan otomatis.',
  },
  {
    emoji: '📈',
    title: 'Analitik pengeluaran',
    body: 'Grafik garis tren, batang pengeluaran per bulan, dan donat breakdown kategori — diperbarui otomatis setiap data berubah.',
  },
  {
    emoji: '🎯',
    title: 'Budget planner & Value checker',
    body: 'Tetapkan batas bulanan, lihat persentase pemakaian, dan temukan langganan yang jarang dipakai untuk ditinjau. Tidak ada pembatalan otomatis.',
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const premium = getPlan('premium');
  const student = getPlan('student');
  const demoBuild = isDemoBuild();

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-brand-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/images/whenly-logo.png" alt="Whenly" className="h-9 w-9 rounded-xl object-contain" />
            <span className="text-lg font-bold text-brand-ink">Whenly</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="#fitur" className="btn-ghost btn-sm hidden sm:inline-flex">
              Fitur
            </Link>
            <Link href="#harga" className="btn-ghost btn-sm hidden sm:inline-flex">
              Harga
            </Link>
            {user ? (
              <LinkButton href="/dashboard">Buka dashboard</LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="secondary">
                  Masuk
                </LinkButton>
                <LinkButton href="/register">Coba gratis</LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        {/* ---- Hero ---- */}
        <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <Badge tone="violet" className="mb-4">
              Untuk pelajar &amp; mahasiswa Indonesia
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.1] text-brand-ink sm:text-5xl">
              Semua langgananmu, <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">rapi di satu tempat</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-muted">
              Netflix, Spotify, Canva, Google One, sampai langganan belajar. Whenly mencatat tanggal renewal,
              memantau free trial, menghitung pengeluaran bulanan dan tahunan, serta mengingatkan sebelum uangmu
              terpotong diam-diam.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <LinkButton href={demoBuild ? '/guest' : user ? '/dashboard' : '/register'} className="px-5 py-3">
                {demoBuild ? 'Coba demo — masuk sebagai tamu' : user ? 'Lanjut ke dashboard' : 'Mulai gratis — paket Free'}
              </LinkButton>
              <LinkButton href={demoBuild ? '/guest' : '/login'} variant="secondary" className="px-5 py-3">
                {demoBuild ? 'Masuk sebagai tamu' : 'Masuk dengan akun demo'}
              </LinkButton>
            </div>
            <p className="mt-3 text-xs text-brand-muted">
              {demoBuild
                ? 'Build ini memakai mode demo tanpa database: pengunjung masuk sebagai tamu dan data disimpan di peramban.'
                : 'Paket Free mencatat hingga 5 langganan aktif. Tanpa kartu kredit, tanpa unduhan.'}
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-brand-line bg-violet-50/60 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Contoh ringkasan bulanan</p>
              <p className="tnum mt-1 text-3xl font-bold text-brand-ink">{formatIDR(411_900)}</p>
              <p className="text-xs text-brand-muted">5 langganan aktif · data contoh di akun demo</p>
            </div>
            <dl className="divide-y divide-brand-line px-5">
              {[
                ['🎬 Netflix Basic', 'Bulanan', 120_000],
                ['🎵 Spotify Individual', 'Bulanan', 54_900],
                ['🎨 Canva Pro', 'Bulanan', 95_000],
                ['☁️ Google One 100 GB', 'Bulanan', 27_000],
                ['📚 Zenius Belajar', 'Bulanan', 45_000],
              ].map(([name, cycle, price]) => (
                <div key={String(name)} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium text-brand-ink">{name}</span>
                  <span className="text-brand-muted">{cycle}</span>
                  <span className="tnum font-semibold text-brand-ink">{formatIDR(Number(price))}</span>
                </div>
              ))}
            </dl>
            <div className="border-t border-brand-line bg-violet-50/40 px-5 py-3 text-xs text-brand-muted">
              Proyeksi tahunan {formatIDR(4_942_800)} · sisa anggaran dihitung otomatis
            </div>
          </Card>
        </section>

        {/* ---- Batasan prototype (jujur) ---- */}
        <section className="mb-14">
          <InfoBanner tone="warn" title="Yang perlu kamu tahu tentang prototype ini">
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Pembayaran masih sandbox.</strong> Belum ada payment gateway yang terintegrasi. Tombol
                pembayaran akan menandai transaksi sebagai <em>demo</em>, tidak pernah sebagai pembayaran nyata.
              </li>
              <li>
                <strong>Pengingat hanya di dalam aplikasi.</strong> Belum ada scheduler email atau push notification.
              </li>
              <li>
                <strong>Verifikasi pelajar memakai alur demo.</strong> Belum terhubung ke PDDikti atau penyedia
                verifikasi resmi.
              </li>
              <li>
                <strong>Data demo ditandai jelas.</strong> Semua akun contoh diberi label <em>DEMO</em>.
              </li>
              {demoBuild ? (
                <li>
                  <strong>Deploy ini berjalan tanpa database.</strong> Data disimpan di peramban (localStorage). Fitur
                  yang memerlukan server database — billing sandbox, kategori kustom, ekspor berkas, dan verifikasi
                  pelajar — belum aktif.
                </li>
              ) : null}
            </ul>
          </InfoBanner>
        </section>

        {/* ---- Fitur ---- */}
        <section id="fitur" className="scroll-mt-20 py-6">
          <h2 className="text-2xl font-bold text-brand-ink sm:text-3xl">Fitur yang benar-benar berfungsi</h2>
          <p className="mt-2 max-w-2xl text-sm text-brand-muted">
            Bukan tombol pajangan: setiap fitur di bawah ini tersambung ke database dan menghitung data milikmu sendiri.
          </p>
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_FEATURES.map((feature) => (
              <Card key={feature.title} className="card-pad">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-xl">{feature.emoji}</span>
                <h3 className="mt-4 text-base font-semibold text-brand-ink">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{feature.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ---- Harga ---- */}
        <section id="harga" className="scroll-mt-20 py-12">
          <h2 className="text-2xl font-bold text-brand-ink sm:text-3xl">Harga sederhana, bisa diubah</h2>
          <p className="mt-2 max-w-2xl text-sm text-brand-muted">
            Semua harga adalah contoh untuk prototype dan diatur pada satu file konfigurasi
            (<code className="rounded bg-violet-50 px-1.5 py-0.5 text-xs">src/config/plans.ts</code>).
          </p>

          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={plan.recommended ? 'relative border-violet-400 ring-2 ring-violet-200' : undefined}
              >
                {plan.recommended ? (
                  <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide ">
                    Paling populer
                  </span>
                ) : null}
                <div className="card-pad">
                  <h3 className="text-lg font-bold text-brand-ink">{plan.name}</h3>
                  <p className="mt-1 min-h-[2.5rem] text-sm text-brand-muted">{plan.tagline}</p>
                  <p className="tnum mt-4 text-3xl font-extrabold text-brand-ink">
                    {plan.priceMonthly === 0 ? 'Gratis' : formatIDR(plan.priceMonthly)}
                    {plan.priceMonthly === 0 ? null : <span className="text-sm font-medium text-brand-muted">/bulan</span>}
                  </p>
                  {plan.priceYearly ? (
                    <p className="mt-1 text-xs text-brand-muted">
                      atau {formatIDR(plan.priceYearly)}/tahun (hemat {formatIDR(yearlySavings(plan.id))})
                    </p>
                  ) : null}
                  <ul className="mt-5 space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature.key} className="flex gap-2 text-brand-ink">
                        <span aria-hidden className="text-emerald-600">✓</span>
                        <span>{feature.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    <LinkButton
                      href={demoBuild ? '/pricing' : user ? '/pricing' : '/register'}
                      variant={plan.recommended ? 'primary' : 'secondary'}
                      className="w-full"
                    >
                      {plan.id === 'free' ? 'Mulai dengan Free' : `Pilih ${plan.name}`}
                    </LinkButton>
                  </div>
                  {plan.caveats.length ? (
                    <ul className="mt-4 space-y-1 text-xs text-brand-muted">
                      {plan.caveats.map((caveat) => (
                        <li key={caveat}>• {caveat}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <caption className="sr-only">Perbandingan fitur antar paket</caption>
              <thead>
                <tr className="border-b border-brand-line">
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-muted">
                    Fitur
                  </th>
                  <th scope="col" className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-brand-muted">
                    Free
                  </th>
                  <th scope="col" className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-brand-muted">
                    Premium
                  </th>
                  <th scope="col" className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-brand-muted">
                    Student
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-brand-line/70">
                    <th scope="row" className="px-3 py-2.5 text-left font-medium text-brand-ink">
                      {row.label}
                    </th>
                    {(['free', 'premium', 'student'] as const).map((planId) => {
                      const value = row.values[planId];
                      return (
                        <td key={planId} className="px-3 py-2.5 text-center text-brand-muted">
                          {value === true ? <span className="text-emerald-600">✓</span> : value === false ? <span className="text-slate-300">—</span> : value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Akun demo ---- */}
        <section className="py-8">
          <Card className="card-pad bg-gradient-to-br from-violet-50 to-blue-50">
            <h2 className="text-xl font-bold text-brand-ink">Coba tanpa mendaftar</h2>
            <p className="mt-1.5 text-sm text-brand-muted">
              Tiga akun demo sudah terisi data. Password semuanya <code className="rounded bg-white px-1.5 py-0.5 text-xs">demo12345</code>.
            </p>            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { email: 'demo@subscriptly.id', label: 'Premium', body: '12 langganan, 2 free trial, riwayat pembayaran 6 bulan, anggaran Rp500.000, kategori kustom.' },
                { email: 'gratis@subscriptly.id', label: 'Free', body: '5 langganan aktif — persis di batas kuota paket Free, untuk mencoba pesan batas tercapai.' },
                { email: 'pelajar@subscriptly.id', label: 'Free + verifikasi', body: 'Pengajuan verifikasi pelajar berstatus pending untuk mencoba alur demo.' },
              ].map((account) => (
                <div key={account.email} className="rounded-xl border border-brand-line bg-white p-4">
                  <p className="text-sm font-semibold text-brand-ink">{account.email}</p>
                  <Badge tone="violet" className="mt-1">
                    {account.label}
                  </Badge>
                  <p className="mt-2 text-xs leading-relaxed text-brand-muted">{account.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <LinkButton href={demoBuild ? '/guest' : '/login'}>Masuk ke akun demo</LinkButton>
            </div>
            {demoBuild ? (
              <p className="mt-3 text-xs text-brand-muted">
                Tombol di atas membuka dashboard dengan akun Premium dan data contoh — tanpa perlu mengetik apa pun.
              </p>
            ) : null}
          </Card>
        </section>
      </main>

      <footer className="border-t border-brand-line bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-brand-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Whenly · prototype full-stack (Next.js + Prisma).</p>
          <p>
            Harga contoh: Premium {formatIDR(premium.priceMonthly)}/bulan · Student {formatIDR(student.priceMonthly)}/bulan.
            Zona waktu {process.env.TIMEZONE || 'Asia/Jakarta'}.
          </p>
        </div>
      </footer>
    </div>
  );
}
