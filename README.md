# Whenly — Subscription Management Platform (Prototype)

Whenly adalah aplikasi full-stack untuk mengelola langganan digital, dirancang khusus untuk pelajar & mahasiswa Indonesia. Fokusnya: bersih, responsif, jujur tentang batasan (terutama alur billing dan verifikasi pelajar), dan **seluruh batas paket ditegakkan di sisi server**.

## Highlights

- **UI Indonesia**: bahasa, tanggal (YYYY-MM-DD + `formatDateID`), dan mata uang IDR (Rp).
- **Waktu & perhitungan**: zona waktu Asia/Jakarta; validasi kalender (termasuk akhir bulan/leap years); biaya dihitung secara ketat dengan estimasi (`estimate`).
- **Paket & batasan server-side**: Free (maks 5 langganan aktif), Premium (unlimited fair-use soft cap 500), Student (dengan status verifikasi demo). Semua pengecekan dilakukan di server routes.
- **Billing sandbox**: tidak ada gateway nyata; `BILLING_PROVIDER=mock` menandai semua aktivitas sebagai demo dan aplikasi menolak menjalankan checkout dengan provider nyata yang belum dikonfigurasi (501).
- **Verifikasi pelajar demo**: pengajuan `pending` → `approved/rejected` via tombol demo; **tidak klaim verifikasi resmi**.
- **Analitik nyata**: proyeksi berdasarkan jadwal langganan + riwayat pembayaran nyata; value checker memberi saran, tidak auto-membatalkan.
- **Reminders in-app**: hari ini/3/7/30 hari; email dinyatakan **disabled by technical constraint** (belum terhubung ke scheduler/pengirim).
- **Trial tracker**: countdown, tanggal tagihan pertama, peringatan habis; tidak menjanjikan auto-cancel tanpa integrasi.

## Tech Stack

- **Framework**: Next.js 14.2.35 (App Router, TypeScript 5.6.3)
- **UI/Styling**: Tailwind CSS 3.4.13
- **Charts**: Recharts 2.13.0
- **DB ORM**: Prisma 5.22.0
- **Auth**: email + password (bcryptjs), token acak (SHA-256 disimpan), cookie httpOnly (30 hari), in-memory rate limiting
- **Validation**: zod 3.23.8
- **Data**: SQLite (dev) / PostgreSQL (prod-ready)

## Quick Start (Portable Node v24)

Proyek ini dikembangkan dengan Node v24.20.0 + npm 11.19.0. Jika menggunakan portable Node, prepend PATH terlebih dahulu.

```powershell
# PowerShell (Windows)
$env:PATH = "C:\Users\user\AppData\Local\Temp\opencode\node-v24.20.0-win-x64;" + $env:PATH

cd "C:\Users\user\Documents\Default Project\Whenly"

# 1. Install (npm 11 blocks scripts — approved)
npm install

# 2. Setup (generate + migrate + seed)
npm run setup

# 3. Run dev server
npm run dev
```

Buka: [http://localhost:3000](http://localhost:3000)

## Demo Accounts

| Email | Password | Keterangan |
|---|---|---|
| demo@Whenly.id | demo12345 | Premium. Data lengkap (12 langganan, trial, budget Rp500.000, kategori kustom). |
| gratis@Whenly.id | demo12345 | Free. Persis 5 langganan aktif (kuota penuh). |
| pelajar@Whenly.id | demo12345 | Free. Verifikasi pelajar berstatus `pending` (demo), 3 langganan termasuk trial. |

> Semua akun demo memiliki `isDemo=true` dan data dapat dimodifikasi; gunakan `npm run db:seed` untuk reset ke kondisi awal.

## Scripts

| Script | Keterangan |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack tidak dipakai di 14.2.35) |
| `npm run build` | Build produksi (linting dilewati) |
| `npm run start` | Start server produksi |
| `npm run typecheck` | Type check murni (`tsc --noEmit`) |
| `npm run lint` | Lint (tersedia tapi belum dikonfigurasi penuh) |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset & reseed |
| `npm run setup` | `prisma generate` + `prisma migrate deploy` + `npm run db:seed` |
| `npm run test` | Smoke test (cek berkas penting) |

## Environment

Salin `.env.example` ke `.env` (sudah ada `.env` untuk dev lokal). Konfigurasi utama:

```env
DATABASE_URL="file:./dev.db"
APP_URL="http://localhost:3000"
TIMEZONE="Asia/Jakarta"
CURRENCY="IDR"
SESSION_COOKIE_NAME="Whenly_session"
SESSION_TTL_DAYS="30"
SEED_DEMO_DATA="true"
BILLING_PROVIDER="mock"
STUDENT_VERIFICATION_PROVIDER="demo"
```

- **BILLING_PROVIDER=mock**: sandbox. Jika diubah ke provider nyata tanpa konfigurasi, API akan menolak dengan `501` (tidak pernah menampilkan "pembayaran berhasil" palsu).
- **STUDENT_VERIFICATION_PROVIDER=demo**: alur demo. Di produksi, gunakan mekanisme terotentikasi (admin role / webhook signed).

## Struktur Kunci

- `src/config/plans.ts` — satu sumber kebenaran (harga, batas, fitur, comparison). Dibaca server.
- `src/lib/plans.ts` — `getEntitlements`, `assertQuota`, `assertFeature`, enforcement server-side.
- `src/lib/billing.ts` — alur checkout/confirm, downgrade, overview. Selalu tandai demo/sandbox.
- `src/lib/analytics.ts` — bangun ringkasan analitik dari data nyata.
- `src/lib/subscriptions.ts` — kalkulasi siklus, renewal item, `monthlyEquivalent`/`yearlyEquivalent`, `effectivePrice`, `occurrencesInWindow`.
- `src/components/billing/PlanSelector.tsx` — pemilih paket + modal checkout (sandbox) + downgrade.
- `src/components/renewals/RenewalCalendar.tsx` — kalender 3 bulan (local grid), mark paid in-app.
- `src/components/analytics/ValueChecker.tsx` — flag nilai tapi tidak auto-cancel.
- `prisma/` — schema SQLite + postgresql variant + migrasi + seed.

## Transisi ke PostgreSQL (Supabase)

1. Copy `prisma/schema.postgresql.prisma` ke `prisma/schema.prisma` (atau sesuaikan provider).
2. Atur `DATABASE_URL` & `DIRECT_URL` di `.env` sesuai Supabase (pooling + direct).
3. Jalankan migrasi: `npx prisma migrate deploy` / `prisma db push` sesuai workflow.
4. Seed: `npm run db:seed` (dengan `SEED_DEMO_DATA=true`).

Lihat `prisma/postgresql/init.sql` untuk referensi DDL jika migrasi gagal.

## Batasan Prototype (Jujur)

- **Pembayaran nyata**: belum terintegrasi. Status pembayaran selalu `demo` di sandbox.
- **Email/push**: pengingat hanya **in-app**. Tidak ada koneksi ke SMTP/provider push, sehingga fitur email dinyatakan non-aktif.
- **Verifikasi pelajar**: hanya simulasi demo (tidak menghubungi PDDikti/dll).
- **Auto-cancel**: tidak ada (meski trial muncul); perilaku "batal otomatis" hanya bisa dijanjikan setelah integrasi dengan payment gateway + scheduler.
- **Fair use**: Premium ditulis "tanpa batas" namun memiliki batas lunak **500** (ditampilkan & ditegakkan).
- **Upload berkas**: tidak ada upload/attachment; hanya data teks.

## Testing yang Sudah Dilakukan

- `npm run typecheck` → sukses
- `npm run build` → sukses (16 halaman)
- Login/logout + semua 3 akun demo
- Dashboard Premium menampilkan data lengkap
- Akses fitur terkunci untuk Free (UI + server enforcement terverifikasi)
- Subscriptions CRUD, mark-paid, extend (UI terhubung ke API)

## Lisensi

Prototipe edukasi — bebas digunakan untuk pembelajaran.