# Whenly — Subscription Management Platform (Prototype)

Whenly adalah aplikasi full-stack untuk mengelola langganan digital, dirancang khusus untuk pelajar & mahasiswa Indonesia. Fokusnya: bersih, responsif, jujur tentang batasan (terutama alur billing dan verifikasi pelajar), dan **seluruh batas paket ditegakkan di sisi server**.

> Repo: https://github.com/prototypetools/Whenly_app

## Highlights

- **UI Indonesia**: bahasa, tanggal (`formatDateID`), dan mata uang IDR (Rp).
- **Waktu & perhitungan**: zona waktu Asia/Jakarta; validasi kalender (termasuk akhir bulan/leap years).
- **Paket & batasan server-side**: Free (maks 5 langganan aktif), Premium (unlimited fair-use soft cap 500), Student (dengan status verifikasi demo).
- **Billing sandbox**: tidak ada gateway nyata; `BILLING_PROVIDER=mock` menandai semua aktivitas sebagai demo dan aplikasi menolak checkout dengan provider nyata yang belum dikonfigurasi (501).
- **Verifikasi pelajar demo**: pengajuan `pending` → `approved/rejected` via tombol demo; **tidak klaim verifikasi resmi**.
- **Analitik nyata**: proyeksi berdasarkan jadwal langganan + riwayat pembayaran nyata; value checker memberi saran, tidak auto-membatalkan.
- **Reminders in-app**: hari ini/3/7/30 hari; email dinyatakan **disabled by technical constraint**.
- **Trial tracker**: countdown, tanggal tagihan pertama, peringatan habis.

## Dua Mode Operasi

Aplikasi ini bisa berjalan dalam dua mode:

| Mode | `NEXT_PUBLIC_DEMO_MODE` | Butuh database? | Keterangan |
|---|---|---|---|
| **Demo** | `true` | ❌ Tidak | Data demo disimpan di **memori proses server**. Cocok untuk preview/pameran tanpa setup database. |
| **Produksi** | `false` | ✅ Ya | Memakai Prisma + PostgreSQL (mis. Neon/Supabase). Fitur penuh & persisten. |

### Mode Demo

Saat `NEXT_PUBLIC_DEMO_MODE=true`:

- Tidak ada query Prisma sama sekali. Semua data dibaca/ditulis dari penyimpanan demo di server (`src/lib/demo/dataset.ts`) melalui endpoint `/api/demo/op`.
- Tersedia 1 tombol masuk cepat: **“Masuk sebagai tamu”** di `/login` (langsung masuk sebagai akun Premium berisi data contoh).
- Data demo **tidak persisten**: akan kembali ke kondisi awal saat proses server di-restart (Vercel serverless bisa me-reset kapan saja). Ini disengaja untuk demo.

## Tech Stack

- **Framework**: Next.js 14.2.35 (App Router, TypeScript 5.6.3)
- **UI/Styling**: Tailwind CSS 3.4.13
- **Charts**: Recharts 2.13.0
- **DB ORM**: Prisma 5.22.0
- **Auth**: email + password (bcryptjs), token acak (SHA-256 disimpan), cookie httpOnly (30 hari), in-memory rate limiting
- **Validation**: zod 3.23.8
- **Data**: tanpa DB (mode demo) / SQLite (dev) / PostgreSQL (prod)

## Quick Start

```powershell
# 1. Install dependency
npm install

# 2a. Mode demo (tanpa database — paling cepat)
#     Pastikan NEXT_PUBLIC_DEMO_MODE=true di .env, lalu:
npm run dev

# 2b. Mode produksi dengan database lokal (SQLite)
npm run setup   # prisma generate + migrate + seed
npm run dev
```

Buka: [http://localhost:3000](http://localhost:3000)

## Akun Demo

Tersedia di halaman `/login`. Password semua akun demo: `demo12345`.

| Email | Paket | Keterangan |
|---|---|---|
| `demo@subscriptly.id` | Premium | Data lengkap (beberapa langganan, trial, budget, kategori kustom). |
| `gratis@subscriptly.id` | Free | Mendekati batas kuota paket Free. |
| `pelajar@subscriptly.id` | Free | Verifikasi pelajar berstatus `pending` (demo). |

> Di mode demo, tombol **“Masuk sebagai tamu”** langsung memakai akun Premium.

## Scripts

| Script | Keterangan |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Build produksi |
| `npm run start` | Start server produksi |
| `npm run lint` | Lint |
| `npm run setup` | (Mode produksi) `prisma generate` + migrate + seed |
| `npm run db:seed` | Seed data demo ke database |
| `npm run db:reset` | Reset & reseed database |

## Environment

Salin `.env.example` menjadi `.env`. Lihat penjelasan lengkap di dalam file tersebut. Ringkasan:

```env
# true = tanpa database (memori server); false = pakai Prisma
NEXT_PUBLIC_DEMO_MODE=true

# Wajib hanya bila NEXT_PUBLIC_DEMO_MODE=false
DATABASE_URL="file:./dev.db"

SESSION_COOKIE_NAME=Whenly_session
SESSION_TTL_DAYS=30
NEXT_PUBLIC_APP_NAME=Whenly
TIMEZONE=Asia/Jakarta
BILLING_PROVIDER=mock
```

> **Penting:** `NEXT_PUBLIC_*` di-inline saat **build**. Jika mengubah nilainya, lakukan build/deploy ulang (push ke Vercel akan otomatis rebuild).

## Deploy ke Vercel

1. Import repo ini di Vercel (New Project → pilih `Whenly_app`).
2. **Root Directory**: biarkan default (`.`) karena `package.json` ada di root repo ini.
3. Tambahkan Environment Variable (Production & Preview):
   - `NEXT_PUBLIC_DEMO_MODE=true` (untuk demo tanpa database), atau
   - `NEXT_PUBLIC_DEMO_MODE=false` + `DATABASE_URL=<PostgreSQL>` (untuk produksi).
4. Deploy. `postinstall` menjalankan `prisma generate`; bila mode demo tanpa database pun ini aman karena schema tersedia di repo.
5. Setelah deploy, uji: buka `/`, klik **Masuk** → **Masuk sebagai tamu** → pastikan `/dashboard` terbuka.

### Catatan mode produksi (butuh database)

1. Siapkan PostgreSQL (Neon/Supabase) dan set `DATABASE_URL`.
2. Jalankan migrasi: `npx prisma migrate deploy` (gunakan `prisma/schema.postgresql.prisma` bila provider produksi adalah PostgreSQL — lihat bagian di bawah).
3. Seed (opsional): `npm run db:seed`.

## Struktur Kunci

- `src/config/plans.ts` — satu sumber kebenaran (harga, batas, fitur). Dibaca server.
- `src/lib/plans.ts` — `getEntitlements`, `assertCanConsumeSlot`, `assertFeature`, enforcement server-side.
- `src/lib/billing.ts` — alur checkout/confirm, downgrade, overview. Selalu menandai demo/sandbox.
- `src/lib/analytics.ts` — ringkasan analitik dari data nyata.
- `src/lib/subscriptions.ts` — kalkulasi siklus, renewal item, `monthlyEquivalent`/`yearlyEquivalent`.
- `src/lib/demo/` — dukungan mode demo:
  - `constants.ts` — konstanta aman untuk server & client (`isDemoBuild`, `DEMO_*`).
  - `dataset.ts` — penyimpanan demo di memori server.
  - `client.ts` — helper sisi klien (`demoOp`, sesi demo).
  - `bootstrap.tsx` — pembuat sesi demo.
- `src/app/api/demo/op/route.ts` — endpoint mutasi mode demo.
- `prisma/` — schema SQLite + varian PostgreSQL + migrasi + seed.

## Transisi ke PostgreSQL (Neon/Supabase)

1. Salin `prisma/schema.postgresql.prisma` menjadi `prisma/schema.prisma` (atau sesuaikan `provider`).
2. Atur `DATABASE_URL` sesuai provider.
3. Jalankan `npx prisma migrate deploy` / `prisma db push`.
4. Seed: `npm run db:seed`.

Lihat `prisma/postgresql/init.sql` untuk referensi DDL bila migrasi gagal.

## Batasan Prototype (Jujur)

- **Pembayaran nyata**: belum terintegrasi. Status pembayaran selalu `demo` di sandbox.
- **Email/push**: pengingat hanya **in-app**; belum ada koneksi SMTP/provider push.
- **Verifikasi pelajar**: hanya simulasi demo (tidak menghubungi PDDikti/dll).
- **Auto-cancel**: tidak ada.
- **Fair use**: Premium ditulis "tanpa batas" namun memiliki batas lunak **500**.
- **Persistensi demo**: pada mode demo, data dapat hilang saat proses server di-restart.

## Lisensi

Prototipe edukasi — bebas digunakan untuk pembelajaran.
