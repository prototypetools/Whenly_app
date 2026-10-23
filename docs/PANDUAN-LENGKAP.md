# Panduan Lengkap Whenly — Dari Nol Sampai Presentasi

Dokumen ini menjelaskan **cara aplikasi ini dibuat**, **cara kodenya bekerja**, dan
**khususnya cara uang dihitung**. Ditulis untuk kamu yang akan mempresentasikannya.

---

## Daftar Isi

1. [Gambaran Besar](#1-gambaran-besar)
2. [Cara Membuat Aplikasi (dari nol)](#2-cara-membuat-aplikasi-dari-nol)
3. [Struktur Folder](#3-struktur-folder)
4. [Cara Kerja Tiap Bagian](#4-cara-kerja-tiap-bagian)
5. [PENGHITUNGAN UANG (bagian inti presentasi)](#5-penghitungan-uang)
6. [Cara Mempresentasikan](#6-cara-mempresentasikan)
7. [Pertanyaan yang Mungkin Ditanya](#7-pertanyaan-yang-mungkin-ditanya)

---

## 1. Gambaran Besar

**Whenly** = aplikasi untuk mencatat langganan digital (Netflix, Spotify, dsb),
khusus pelajar Indonesia.

**Masalah yang dipecahkan:**
- Orang lupa langganan apa saja yang masih aktif → uang terus terpotong
- Free trial berakhir tanpa sadar → tiba-tiba ditagih
- Tidak tahu total pengeluaran bulanan/tahunan

**Teknologi yang dipakai:**

| Bagian | Teknologi | Kenapa dipilih |
|---|---|---|
| Bahasa | TypeScript | Ada pengecekan tipe, error ketahuan saat menulis kode |
| Framework | Next.js 14 | Bisa render di server + client sekaligus |
| Tampilan | Tailwind CSS | Tulis gaya langsung di HTML, cepat |
| Database | Prisma + SQLite/PostgreSQL | Cara tulis database yang aman dari error |
| Grafik | Recharts | Untuk grafik pengeluaran |
| Validasi | Zod | Memastikan data dari user benar |

---

## 2. Cara Membuat Aplikasi (dari nol)

### Langkah 1 — Siapkan alat

```bash
# Cek Node.js sudah terpasang
node --version    # harus 18 atau lebih

# Buat project Next.js
npx create-next-app@latest whenly --typescript --tailwind --app
```

Perintah di atas membuat kerangka aplikasi. Ini seperti membeli rumah kosong
yang sudah ada dindingnya.

### Langkah 2 — Pasang library tambahan

```bash
npm install prisma @prisma/client    # database
npm install zod                      # validasi
npm install bcryptjs                 # enkripsi password
npm install recharts                 # grafik
```

### Langkah 3 — Tentukan bentuk data (skema database)

File: `prisma/schema.prisma`

```prisma
model User {
  id       String   @id @default(cuid())
  email    String   @unique
  name     String
  plan     String   @default("free")   // free | premium | student
  ...
}

model Subscription {
  id          String   @id @default(cuid())
  userId      String
  name        String
  price       Int                        // ← harga dalam Rupiah PENUH (integer)
  billingCycle String                    // weekly | monthly | yearly | custom
  startDate   DateTime
  nextRenewalDate DateTime
  ...
}
```

**Poin penting untuk presentasi:** perhatikan `price Int`. Harga disimpan
sebagai **bilangan bulat Rupiah**, bukan desimal. Ini keputusan penting
(bahas di [bagian 5](#5-penghitungan-uang)).

### Langkah 4 — Buat tampilan dan logika

Setelah skema jadi, kamu buat:
- Halaman (`src/app/`) → apa yang dilihat user
- Fungsi perhitungan (`src/lib/`) → otak aplikasi
- API (`src/app/api/`) → jembatan tampilan ↔ database

### Langkah 5 — Jalankan

```bash
npm run dev     # mode pengembangan (bisa ubah kode langsung terlihat)
npm run build   # siapkan versi final
npm run start   # jalankan versi final
```

---

## 3. Struktur Folder

```
subscriptly/
├── prisma/
│   ├── schema.prisma              ← bentuk data (SQLite)
│   ├── schema.postgresql.prisma   ← bentuk data (PostgreSQL)
│   └── seed.ts                    ← pengisi data contoh
│
├── src/
│   ├── app/                       ← HALAMAN
│   │   ├── (app)/                 ← halaman yang butuh login
│   │   │   ├── dashboard/
│   │   │   ├── subscriptions/
│   │   │   ├── renewals/
│   │   │   ├── trials/
│   │   │   ├── analytics/
│   │   │   ├── budget/
│   │   │   ├── billing/
│   │   │   ├── student/
│   │   │   └── profile/
│   │   ├── api/                   ← endpoint (jembatan ke database)
│   │   └── login/ register/ guest/
│   │
│   ├── lib/                       ← OTAK APLIKASI
│   │   ├── money.ts               ⭐ format uang
│   │   ├── subscriptions.ts       ⭐⭐ HITUNG UANG (paling penting!)
│   │   ├── dates.ts               ⭐ hitung tanggal (akhir bulan, kabisat)
│   │   ├── analytics.ts           ⭐ ringkasan pengeluaran
│   │   ├── plans.ts               ← batas paket Free/Premium
│   │   ├── billing.ts             ← alur pembayaran
│   │   ├── auth.ts                ← login & sesi
│   │   ├── queries.ts             ← ambil data
│   │   └── validation.ts          ← cek data dari user
│   │
│   └── components/                ← POTONGAN TAMPILAN
│       ├── ui/primitives.tsx      ← tombol, kartu, dsb
│       ├── subscriptions/
│       ├── analytics/
│       └── layout/AppShell.tsx    ← kerangka (sidebar + header)
│
└── .env                           ← pengaturan rahasia
```

---

## 4. Cara Kerja Tiap Bagian

### 4.1 Bagaimana satu halaman ditampilkan

Contoh: user buka `/dashboard`.

```
1. User klik "/dashboard"
2. Next.js jalankan src/app/(app)/layout.tsx di SERVER
   → cek user sudah login? (requireUser)
   → kalau belum, lempar ke /login
3. Jalankan src/app/(app)/dashboard/page.tsx di SERVER
   → ambil data dari database via src/lib/queries.ts
   → hitung ringkasan via src/lib/analytics.ts
4. Kirim HTML jadi ke browser (user langsung lihat isi, bukan layar kosong)
5. Browser jalankan JavaScript → halaman jadi interaktif
```

Ini disebut **Server-Side Rendering (SSR)**. Kelebihannya:
- Cepat terlihat (isi sudah ada di HTML)
- Data sensitif tidak perlu dikirim ke browser

### 4.2 Bagaimana data diubah (contoh: tambah langganan)

```
User isi form → klik "Simpan"
  ↓
Browser kirim ke POST /api/subscriptions
  ↓
Server:
  1. Cek user login (requireApiUser)
  2. Cek data valid (zod)
  3. Cek kuota paket (assertCanConsumeSlot)  ← PENEGAKAN DI SERVER
  4. Simpan ke database (prisma.subscription.create)
  ↓
Kirim balik: berhasil / pesan error
```

**Poin presentasi:** langkah 3 dilakukan di **server**, bukan di browser.
Artinya user tidak bisa curang dengan mengubah kode di browser mereka.

### 4.3 Bagaimana login bekerja

```
1. User kirim email + password
2. Server cari user berdasarkan email
3. Server bandingkan password dengan hash tersimpan (bcryptjs)
   → password asli TIDAK PERNAH disimpan, hanya "sidik jari"-nya
4. Kalau cocok: buat token acak, simpan di database
5. Kirim token ke browser sebagai cookie (httpOnly)
   → httpOnly = JavaScript tidak bisa membacanya (aman dari pencurian)
6. Setiap request berikutnya, browser otomatis kirim cookie itu
```

---

## 5. Penghitungan Uang

> **Ini bagian terpenting untuk presentasi kamu.**

### 5.1 Prinsip Dasar: Jangan pernah pakai angka desimal untuk uang

**Masalah yang sering terjadi:**

```javascript
0.1 + 0.2          // hasilnya 0.30000000000000004  ← SALAH!
0.1 + 0.2 === 0.3  // hasilnya false               ← BAHAYA!
```

Ini bukan bug JavaScript — semua bahasa pemrograman begitu. Komputer
menyimpan angka desimal dalam bentuk biner, dan beberapa angka tidak bisa
disimpan dengan tepat.

**Bahaya nyata:** kalau kamu hitung uang 1 juta kali, kesalahan kecil ini
menumpuk dan laporan keuanganmu bisa selisih ribuan rupiah.

**Solusi yang dipakai Whenly:**

```typescript
// src/lib/money.ts
/** 'Rp9.900' */
export function formatIDR(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return 'Rp0';
  return idrFormatter.format(Math.round(value)).replace(/\u00A0/g, ' ');
}
```

Perhatikan `Math.round(value)`. **Semua uang dibulatkan jadi bilangan bulat
Rupiah.** Tidak ada sen, tidak ada desimal. Karena Rupiah memang tidak pakai
sen dalam praktik sehari-hari.

Di database pun `price Int` (bilangan bulat), bukan `Float` atau `Decimal`.

> **Kalimat untuk presentasi:**
> "Kami menyimpan harga sebagai bilangan bulat Rupiah, bukan desimal.
> Alasannya: komputer tidak bisa menyimpan angka desimal dengan tepat —
> 0,1 + 0,2 hasilnya bukan 0,3. Kalau dipakai untuk uang, kesalahan itu
> menumpuk. Jadi kami hindari sepenuhnya."

### 5.2 Masalah Utama: Langganan punya siklus berbeda-beda

Ini tantangan terbesarnya. Bagaimana cara membandingkan:

- Netflix: Rp 120.000 / **bulan**
- Spotify: Rp 54.900 / **bulan**
- Canva Pro: Rp 1.200.000 / **tahun**
- Langganan mingguan: Rp 15.000 / **minggu**
- Langganan kustom: Rp 50.000 / **45 hari**

Mana yang lebih mahal? Tidak bisa dibandingkan langsung!

**Solusinya: ubah semuanya ke satuan yang sama.**

### 5.3 Kunci: Satu Tahun = 365,2425 Hari

```typescript
// src/lib/subscriptions.ts
const DAYS_PER_YEAR = 365.2425;
```

**Kenapa 365,2425 dan bukan 365?**

Karena satu tahun kalender sebenarnya **tidak** 365 hari.
- Tahun biasa = 365 hari
- Tahun kabisat = 366 hari (setiap 4 tahun)

Rata-rata: dalam 400 tahun ada 97 tahun kabisat.

```
(400 × 365 + 97) ÷ 400 = 146.097 ÷ 400 = 365,2425 hari
```

Kalau kamu pakai 365 saja, langganan tahunan akan terlihat sedikit lebih
mahal dari seharusnya, dan kesalahan itu konsisten setiap tahun.

> **Kalimat untuk presentasi:**
> "Kami pakai satu tahun = 365,2425 hari, bukan 365. Karena kalender
> Gregorian punya tahun kabisat. Angka ini didapat dari 400 tahun dibagi 400.
> Kalau pakai 365 biasa, perhitungan tahunan jadi melenceng."

### 5.4 Rumus Utama (JANTUNG APLIKASI)

```typescript
// src/lib/subscriptions.ts

/** Berapa hari dalam satu siklus? */
export function normalizePeriodDays(cycle: string, customPeriodDays?: number | null): number {
  switch (cycle) {
    case 'weekly':   return 7;
    case 'monthly':  return 30.436875;      // 365,2425 ÷ 12
    case 'yearly':   return 365.2425;
    case 'custom':   return Math.max(1, Number(customPeriodDays) || 30);
    default:         return 30.436875;
  }
}

/** Biaya per TAHUN */
export function yearlyEquivalent(sub): number {
  const price = Math.max(0, Number(sub.price) || 0);
  const days = normalizePeriodDays(sub.billingCycle, sub.customPeriodDays);
  return (price * DAYS_PER_YEAR) / days;
}

/** Biaya per BULAN */
export function monthlyEquivalent(sub): number {
  return yearlyEquivalent(sub) / 12;
}
```

**Terjemahan rumusnya ke bahasa manusia:**

```
                        Harga × 365,2425
Biaya per tahun  =  ─────────────────────────
                    Jumlah hari dalam siklus
```

**Mengapa rumus ini bekerja untuk semua siklus?**

Karena semuanya diubah ke "harga per hari" dulu, lalu dikali jumlah hari setahun.

```
Harga per hari = Harga ÷ jumlah hari siklus
Harga per tahun = Harga per hari × 365,2425
```

Digabung jadi satu rumus seperti di atas.

**Mari kita buktikan dengan contoh nyata:**

| Langganan | Harga | Siklus | Hari | Hitungan | Per tahun | Per bulan |
|---|---|---|---|---|---|---|
| Netflix | Rp 120.000 | bulanan | 30,436875 | 120.000 × 365,2425 ÷ 30,436875 | **Rp 1.440.000** | **Rp 120.000** |
| Spotify | Rp 54.900 | bulanan | 30,436875 | 54.900 × 365,2425 ÷ 30,436875 | Rp 658.800 | Rp 54.900 |
| Canva Pro | Rp 1.200.000 | tahunan | 365,2425 | 1.200.000 × 365,2425 ÷ 365,2425 | **Rp 1.200.000** | **Rp 100.000** |
| Mingguan | Rp 15.000 | mingguan | 7 | 15.000 × 365,2425 ÷ 7 | **Rp 782.662** | **Rp 65.222** |

**Lihat keajaibannya:**
- Netflix bulanan → per bulan hasilnya **tepat** Rp 120.000 ✓
- Canva tahunan → per bulan jadi Rp 100.000 (lebih murah dari Netflix!) ✓

Ini yang bikin analisis jadi masuk akal.

> **Kalimat untuk presentasi:**
> "Rumusnya satu saja untuk semua siklus: harga dikali 365,2425 dibagi
> jumlah hari siklus. Jadi langganan tahunan Rp 1,2 juta bisa dibandingkan
> langsung dengan langganan bulanan Rp 120 ribu — ternyata tahunan lebih
> murah Rp 20 ribu per bulan."

### 5.5 Harga Setelah Free Trial

Ini penting karena free trial adalah jebakan paling umum.

```typescript
/** Harga yang benar-benar akan ditagih (bukan harga trial Rp 0) */
export function effectivePrice(sub: SubscriptionLike): number {
  if (sub.isFreeTrial && sub.priceAfterTrial != null && sub.priceAfterTrial > 0) {
    return sub.priceAfterTrial;
  }
  return Math.max(0, Number(sub.price) || 0);
}
```

Logikanya:
```
Kalau sedang free trial DAN ada harga setelah trial?
  → pakai harga setelah trial (itu yang akan benar-benar dibayar)
Selain itu:
  → pakai harga biasa
```

**Kenapa ini penting:** saat menghitung proyeksi tahunan, kita harus pakai
harga yang **akan** dibayar, bukan Rp 0 selama trial. Kalau tidak, proyeksi
kita bohong.

> **Kalimat untuk presentasi:**
> "Saat menghitung proyeksi tahunan, kami pakai harga setelah trial, bukan
> Rp 0. Karena kalau tidak, laporan kami akan bilang 'gratis' padahal bulan
> depan user ditagih Rp 120 ribu."

### 5.6 Harga Efektif dengan Diskon (jika ada)

Kalau langganan punya harga normal dan harga diskon:

```typescript
// Membandingkan harga diskon vs harga normal
// yang dipakai untuk analisis adalah harga yang benar-benar dibayar
```

### 5.7 Kapan Langganan Masuk Hitungan Pengeluaran?

```typescript
/** Apakah langganan ini sedang menagih uang sekarang? */
export function isBillableNow(sub: SubscriptionLike, today = todayISO()): boolean {
  if (sub.status !== 'active') return false;   // dijeda/dibatalkan → tidak dihitung
  return !isTrialActive(sub, today);            // sedang trial → tidak dihitung
}

/** Apakah trial masih berjalan? */
export function isTrialActive(sub: SubscriptionLike, today = todayISO()): boolean {
  if (!sub.isFreeTrial || !sub.trialEndDate) return false;
  return daysBetweenISO(today, isoOf(sub.trialEndDate)) >= 0;
}
```

Logikanya:
```
Langganan dihitung sebagai pengeluaran JIKA:
  - statusnya "aktif"          (bukan dijeda/dibatalkan)
  DAN
  - tidak sedang free trial    (karena belum bayar)
```

**Kenapa ini penting:** kalau trial ikut dihitung, total pengeluaran user
akan terlihat lebih besar dari kenyataan. Itu menyesatkan.

> **Kalimat untuk presentasi:**
> "Kami pisahkan mana yang sudah benar-benar ditagih dan mana yang masih
> trial. Kalau digabung, user akan panik melihat total padahal belum tentu
> ditagih."

### 5.8 Perhitungan Tanggal yang Rumit

Ada masalah matematika tanggal yang sering diabaikan orang.

**Masalah 1: Akhir bulan**

Langganan mulai 31 Januari. Bulan depan jatuh tempo kapan?

```
Naif  : 31 Februari  ← TANGGAL INI TIDAK ADA!
Benar : 28 Februari (atau 29 di tahun kabisat)
```

```typescript
// src/lib/dates.ts
export function addMonthsClamped(iso: string, months: number): string {
  const base = parseISODate(iso);
  const day = base.getUTCDate();
  const targetYear = base.getUTCFullYear();
  const targetMonth = base.getUTCMonth() + months;
  const normalized = new Date(Date.UTC(targetYear, targetMonth, 1));
  const y = normalized.getUTCFullYear();
  const m = normalized.getUTCMonth();
  const day_ = Math.min(day, lastDayOfMonth(y, m));   // ← KUNCI: jangan lewat batas
  return toISODate(new Date(Date.UTC(y, m, day_)));
}
```

Perhatikan `Math.min(day, lastDayOfMonth(y, m))`. Kalau tanggal 31 jatuh di
bulan yang cuma 28 hari, dipakai 28. Kalau tidak diklem, hasilnya jadi
3 Maret (melewati bulan) — dan itu **salah**.

**Masalah 2: Tahun kabisat**

```typescript
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
```

Aturannya:
- Habis dibagi 4 → kabisat (2024 ✓)
- **KECUALI** habis dibagi 100 → bukan kabisat (1900 ✗)
- **KECUALI** habis dibagi 400 → kabisat lagi (2000 ✓)

> **Kalimat untuk presentasi:**
> "Langganan tanggal 31 kalau ditambah satu bulan tidak boleh jadi 31
> Februari — tanggal itu tidak ada. Kami klem ke hari terakhir bulan.
> Dan tahun kabisat kami hitung pakai aturan penuh: 4, 100, 400."

### 5.9 Kenapa Semua Dihitung dengan UTC

```typescript
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));   // ← UTC, bukan lokal
}
```

**Masalah:** Indonesia itu UTC+7. Kalau kamu pakai waktu lokal:
- Laptop kamu (Jakarta): 1 Januari 2026, 00:30
- Server di Amerika: 31 Desember 2025, 17:30 (masih hari sebelumnya!)

Akibatnya user bisa lihat "jatuh tempo besok" di HP, tapi server bilang
"hari ini". Bingung.

**Solusi:** semua perhitungan tanggal pakai UTC (patokan global), hanya
**tampilan** yang diubah ke Asia/Jakarta.

> **Kalimat untuk presentasi:**
> "Kami hitung semua tanggal dalam UTC supaya server di mana pun
> menghasilkan angka yang sama. Konversi ke waktu Jakarta hanya untuk
> ditampilkan."

### 5.10 Ringkasan Alur Perhitungan

```
User punya langganan:
  Netflix, Rp 120.000/bulan

               ↓ normalizePeriodDays('monthly')
          30,436875 hari

               ↓ yearlyEquivalent()
  120.000 × 365,2425 ÷ 30,436875 = 1.440.000 per tahun

               ↓ monthlyEquivalent()
       1.440.000 ÷ 12 = 120.000 per bulan

               ↓ jumlahkan semua langganan
        Total pengeluaran bulanan user

               ↓ kalikan 12 (atau pakai yearlyEquivalent)
        Proyeksi tahunan
```

### 5.11 Total Pengeluaran (Analytics)

```typescript
// src/lib/analytics.ts — menyusun ringkasan
// 1. Ambil semua langganan aktif
// 2. Saring: mana yang benar-benar ditagih (isBillableNow)
// 3. Ubah semuanya ke bulanan (monthlyEquivalent)
// 4. Jumlahkan
// 5. Bandingkan dengan anggaran user
```

**Pertanyaan penting:** kenapa tidak langsung jumlahkan harga saja?

Karena harga punya satuan berbeda! Rp 1.200.000/tahun terlihat lebih besar
dari Rp 120.000/bulan, padahal tahunan itu cuma Rp 100.000/bulan. Kalau
dijumlah mentah, hasilnya **salah total**.

---

## 6. Cara Mempresentasikan

### Susunan presentasi (10 menit)

**Menit 1–2: Masalah**
> "Berapa banyak langganan digital Anda? Netflix, Spotify, Canva, iCloud...
> Coba tebak total per bulan. Kebanyakan orang salah tebak 2–3 kali lipat.
> Dan free trial yang lupa dibatalkan itu uang hilang tanpa disadari."

**Menit 3–4: Solusi**
> "Whenly mencatat semuanya, menghitung total sebenarnya, dan mengingatkan
> sebelum uang terpotong."

**Menit 5–7: Demo langsung**
- Buka aplikasi
- Klik "Masuk sebagai tamu"
- Tunjukkan dashboard
- Tambah satu langganan baru → tunjukkan total langsung berubah
- Buka halaman Analytics → tunjukkan grafik

**Menit 8–9: Bagian teknis (yang bikin terkesan)**
> "Bagian tersulitnya bukan tampilan, tapi perhitungan uangnya.
> Ada tiga masalah yang harus dipecahkan..."

Lalu jelaskan (pilih 2–3 saja):
1. Bilangan desimal tidak akurat untuk uang
2. Siklus berbeda-beda harus disamakan
3. Tahun tidak selalu 365 hari

**Menit 10: Penutup**
> "Yang sudah jadi: [sebutkan]. Yang belum: pembayaran nyata, email
> pengingat, dan database permanen. Prototipe ini fokus membuktikan
> perhitungannya benar."

### Kalimat pembuka yang kuat

> "Aplikasi ini kelihatannya sederhana — cuma mencatat langganan.
> Tapi di dalamnya ada tiga masalah matematika yang kalau salah sedikit
> saja, laporan keuangannya bisa bohong. Saya akan tunjukkan bagaimana
> saya menyelesaikannya."

### Yang PALING meyakinkan penguji

Tunjukkan bagian ini di kode:

```typescript
const DAYS_PER_YEAR = 365.2425;
```

Lalu jelaskan kenapa bukan 365. Ini membuktikan kamu **memahami** masalahnya,
bukan cuma menyalin kode.

---

## 7. Pertanyaan yang Mungkin Ditanya

**T: Kenapa pakai Next.js, bukan yang lain?**
> Karena bisa jalankan kode di server dan browser sekaligus. Halaman cepat
> terlihat karena isinya sudah dirender di server, tapi tetap interaktif.

**T: Kenapa uang tidak disimpan sebagai desimal?**
> Karena komputer tidak bisa menyimpan desimal dengan tepat. 0,1 + 0,2
> hasilnya 0,30000000000000004. Untuk uang, kesalahan itu menumpuk.
> Kami pakai bilangan bulat Rupiah.

**T: Kenapa satu tahun 365,2425 hari?**
> Karena ada tahun kabisat. Dalam 400 tahun ada 97 tahun kabisat, jadi
> rata-ratanya 365,2425. Kalau pakai 365, perhitungan tahunan melenceng.

**T: Bagaimana kalau langganan mulai tanggal 31?**
> Kami klem ke hari terakhir bulan berikutnya. 31 Januari + 1 bulan =
> 28/29 Februari, bukan 31 Februari (yang tidak ada).

**T: Bagaimana mencegah user mencurangi kuota paket?**
> Semua pengecekan kuota dilakukan di server, bukan di browser. User tidak
> bisa mengubahnya.

**T: Apakah data saya aman?**
> Password tidak pernah disimpan — hanya "sidik jari"-nya (hash bcrypt).
> Sesi disimpan di cookie httpOnly yang tidak bisa dibaca JavaScript.

**T: Yang belum jadi apa?**
> Jujur: pembayaran masih simulasi, email pengingat belum ada, dan database
> untuk produksi belum disiapkan. Prototipe ini fokus membuktikan
> perhitungan dan alurnya benar dulu.

**T: Kenapa tidak ada fitur X?**
> [Jawab jujur. Sebutkan apakah itu direncanakan atau di luar cakupan.]

---

## 8. Latihan untuk Memahami Lebih Dalam

Coba hitung sendiri, lalu bandingkan dengan aplikasi:

1. **Langganan Rp 99.000/bulan selama setahun.** Berapa totalnya?
   <details>Jawab: 99.000 × 12 = **Rp 1.188.000**</details>

2. **Langganan Rp 900.000/tahun.** Berapa per bulannya?
   <details>Jawab: 900.000 ÷ 12 = **Rp 75.000**</details>

3. **Langganan Rp 20.000/minggu.** Berapa per bulan?
   <details>Jawab: per tahun = 20.000 × 365,2425 ÷ 7 = 1.043.550.
   Per bulan = 1.043.550 ÷ 12 = **Rp 86.963**. Jauh lebih mahal dari
   kelihatannya!</details>

4. **Langganan mulai 31 Januari 2026, bulanan.** Jatuh tempo berikutnya?
   <details>Jawab: 28 Februari 2026 (2026 bukan kabisat).</details>

5. **Langganan mulai 31 Januari 2024, bulanan.** Jatuh tempo berikutnya?
   <details>Jawab: 29 Februari 2024 (2024 kabisat).</details>

---

## 9. Tips Presentasi

1. **Jangan baca kode baris per baris.** Jelaskan **maksudnya**, bukan
   sintaksnya.
2. **Pakai contoh angka nyata.** Rp 120.000/bulan jauh lebih meyakinkan
   dari `price = 120000`.
3. **Akui batasannya.** Juri lebih menghargai kejujuran daripada klaim
   berlebihan.
4. **Siapkan demo cadangan.** Screenshot halaman, kalau-kalau internet mati.
5. **Latihan 3 kali.** Sekali sendiri, sekali di depan cermin, sekali
   di depan teman.

---

*Dokumen ini dibuat untuk project Whenly.*
