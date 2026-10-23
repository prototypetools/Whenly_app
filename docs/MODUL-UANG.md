# Modul Khusus: Cara Menghitung Uang di Whenly

Dokumen ini **hanya** membahas perhitungan uang. Dibuat karena ini bagian
paling penting dan paling sering ditanya saat presentasi.

---

## Bagian A: Konsep Dasar

### A.1 Tiga Masalah Utama Uang di Aplikasi

Setiap aplikasi yang menyimpan uang akan menghadapi tiga masalah ini.
Whenly menyelesaikan ketiganya:

| # | Masalah | Solusi Whenly |
|---|---|---|
| 1 | Komputer tidak akurat menyimpan desimal | Simpan sebagai bilangan bulat Rupiah |
| 2 | Langganan punya satuan waktu berbeda | Ubah semua ke "per tahun" lalu "per bulan" |
| 3 | Tanggal tidak sesederhana kelihatannya | Klem akhir bulan + hitung kabisat + pakai UTC |

---

## Bagian B: Masalah 1 — Desimal Tidak Akurat

### B.1 Bukti Masalahnya

Jalankan ini di Node.js atau console browser:

```javascript
0.1 + 0.2
// Hasil: 0.30000000000000004   ← BUKAN 0.3!

0.1 + 0.2 === 0.3
// Hasil: false                ← PADAHAL seharusnya true

1.1 * 3
// Hasil: 3.3000000000000003

0.3 - 0.1
// Hasil: 0.19999999999999998
```

**Kenapa terjadi?**
Komputer menyimpan angka dalam biner (0 dan 1). Angka seperti `0.1` tidak
punya bentuk biner yang tepat — sama seperti `1/3` tidak bisa ditulis tepat
dalam desimal (0,3333... terus).

### B.2 Bahaya untuk Uang

```javascript
// Simulasi: 10.000 transaksi Rp 0,1
let total = 0;
for (let i = 0; i < 10000; i++) {
  total += 0.1;
}
console.log(total);
// Hasil: 1000.0000000000159   ← SALAH! Seharusnya tepat 1000
```

Bayangkan ini rekening bank. Selisihnya kecil di sini, tapi:
- Kalau ada pembagian dan pembulatan berulang, selisihnya bisa ribuan rupiah
- Dalam laporan keuangan, selisih Rp 1 saja bisa bikin laporan ditolak

### B.3 Solusi Whenly

```typescript
// src/lib/money.ts

// Semua nilai dibulatkan jadi bilangan bulat
export function roundRupiah(value: number): number {
  return Math.round(Number(value) || 0);
}

// Saat menampilkan, baru diformat
const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,     // ← tidak ada desimal
  maximumFractionDigits: 0,     // ← tidak ada desimal
});

export function formatIDR(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value)) return 'Rp0';
  return idrFormatter.format(Math.round(value)).replace(/\u00A0/g, ' ');
}
```

**Tiga lapis pertahanan:**

1. **Database** — kolom `price` bertipe `Int` (bilangan bulat), bukan `Float`
2. **Perhitungan** — semua hasil akhir dibulatkan dengan `Math.round()`
3. **Tampilan** — formatter dikonfigurasi tanpa desimal

### B.4 Bacaan Input dari User

```typescript
/** Menerima 'Rp 12.500', '12500', '12,5' → 12500 */
export function parseIDRInput(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Math.max(0, Math.round(input));
  if (!input) return 0;
  const cleaned = String(input).replace(/[^\d]/g, '');  // buang semua non-angka
  if (!cleaned) return 0;
  return Math.max(0, parseInt(cleaned, 10));
}
```

**Cara kerjanya:**

```
Input user          → buang non-angka → hasil
"Rp 12.500"         → "12500"         → 12500
"12500"             → "12500"         → 12500
"12.500"            → "12500"         → 12500
"Rp 1.200.000"      → "1200000"       → 1200000
""                  → ""              → 0
```

Perhatikan `Math.max(0, ...)` — mencegah harga negatif.

> **Kalimat presentasi:**
> "User boleh mengetik 'Rp 12.500' atau '12500' — kami bersihkan dulu
> semua karakter selain angka, baru diubah jadi bilangan bulat. Jadi
> tidak ada cara user memasukkan angka desimal."

---

## Bagian C: Masalah 2 — Siklus Waktu Berbeda

### C.1 Contoh Masalah Nyata

User punya 4 langganan:

| Langganan | Harga | Siklus |
|---|---|---|
| Netflix | Rp 120.000 | per bulan |
| Canva Pro | Rp 1.200.000 | per tahun |
| Langganan belajar | Rp 20.000 | per minggu |
| Gym | Rp 350.000 | per 45 hari (kustom) |

**Pertanyaan: mana yang paling mahal per bulan?**

Kalau kamu lihat angkanya sekilas, jawabannya "Canva Pro" (Rp 1.200.000).
Tapi itu **SALAH BESAR**. Mari hitung dengan benar.

### C.2 Rumus yang Dipakai

```
                        Harga × 365,2425
Biaya per tahun  =  ─────────────────────────
                    Jumlah hari dalam siklus
```

Kenapa rumus ini bekerja: ia mengubah segalanya ke **"harga per hari"** dulu,
lalu dikali jumlah hari setahun.

```
Langkah 1: Harga per hari  = Harga ÷ jumlah hari siklus
Langkah 2: Harga per tahun = Harga per hari × 365,2425
Langkah 3: Harga per bulan = Harga per tahun ÷ 12
```

### C.3 Berapa Hari per Siklus?

```typescript
export function normalizePeriodDays(cycle: string, customPeriodDays?: number | null): number {
  switch (cycle) {
    case 'weekly':   return 7;              // jelas: 7 hari
    case 'monthly':  return 30.436875;      // 365,2425 ÷ 12
    case 'yearly':   return 365.2425;       // satu tahun penuh
    case 'custom':   return Math.max(1, Number(customPeriodDays) || 30);
    default:         return 30.436875;
  }
}
```

**Kenapa bulan = 30,436875 dan bukan 30?**

Karena 12 bulan = 365,2425 hari. Jadi satu bulan rata-rata:
```
365,2425 ÷ 12 = 30,436875 hari
```

Kalau pakai 30, maka 12 × 30 = 360 hari — **kurang 5,24 hari** dari
setahun sebenarnya. Kesalahan itu muncul setiap tahun.

### C.4 Hitungan Lengkap Keempat Langganan

**Netflix — Rp 120.000/bulan (30,436875 hari):**
```
Per tahun = 120.000 × 365,2425 ÷ 30,436875
          = 120.000 × 12                      ← karena 365,2425 ÷ 30,436875 = 12
          = Rp 1.440.000

Per bulan = 1.440.000 ÷ 12 = Rp 120.000
```

**Canva Pro — Rp 1.200.000/tahun (365,2425 hari):**
```
Per tahun = 1.200.000 × 365,2425 ÷ 365,2425
          = 1.200.000 × 1
          = Rp 1.200.000

Per bulan = 1.200.000 ÷ 12 = Rp 100.000
```

**Langganan belajar — Rp 20.000/minggu (7 hari):**
```
Per tahun = 20.000 × 365,2425 ÷ 7
          = 20.000 × 52,1775
          = Rp 1.043.550

Per bulan = 1.043.550 ÷ 12 = Rp 86.963
```

**Gym — Rp 350.000/45 hari (kustom):**
```
Per tahun = 350.000 × 365,2425 ÷ 45
          = 350.000 × 8,1165
          = Rp 2.840.775

Per bulan = 2.840.775 ÷ 12 = Rp 236.731
```

### C.5 Hasil Akhir — Urutan Sebenarnya

| Peringkat | Langganan | Terlihat (harga mentah) | **Sebenarnya per bulan** |
|---|---|---|---|
| 1 | Gym | Rp 350.000 | **Rp 236.731** |
| 2 | Netflix | Rp 120.000 | **Rp 120.000** |
| 3 | Canva Pro | Rp 1.200.000 | **Rp 100.000** |
| 4 | Belajar | Rp 20.000 | **Rp 86.963** |

**KESIMPULAN YANG MENGEJUTKAN:**
- Canva Pro **terlihat termahal** (Rp 1.200.000) tapi sebenarnya **peringkat 3**
- Gym terlihat cuma Rp 350.000 tapi **paling mahal per bulan**
- Belajar Rp 20.000 (paling kecil) ternyata **hampir Rp 87.000/bulan**

**Inilah nilai jual Whenly.**

> **Kalimat presentasi (ini yang paling mengesankan):**
> "Perhatikan: Canva Pro harganya Rp 1,2 juta — terlihat paling mahal.
> Tapi setelah dinormalisasi, ternyata cuma Rp 100 ribu per bulan.
> Yang benar-benar paling mahal justru gym Rp 350 ribu yang dibayar
> per 45 hari — itu Rp 236 ribu per bulan. Tanpa normalisasi, user
> akan salah mengambil keputusan."

### C.6 Kode Lengkapnya

```typescript
const DAYS_PER_YEAR = 365.2425;

/** Berapa hari dalam satu siklus */
export function normalizePeriodDays(cycle: string, customPeriodDays?: number | null): number {
  switch (cycle) {
    case 'weekly':   return 7;
    case 'monthly':  return 30.436875;
    case 'yearly':   return DAYS_PER_YEAR;
    case 'custom':   return Math.max(1, Number(customPeriodDays) || 30);
    default:         return 30.436875;
  }
}

/** Biaya per TAHUN (belum dibulatkan) */
export function yearlyEquivalent(sub): number {
  const price = Math.max(0, Number(sub.price) || 0);
  const days = normalizePeriodDays(sub.billingCycle, sub.customPeriodDays);
  return (price * DAYS_PER_YEAR) / days;
}

/** Biaya per BULAN (belum dibulatkan) */
export function monthlyEquivalent(sub): number {
  return yearlyEquivalent(sub) / 12;
}
```

**Catatan desain:** fungsi ini sengaja **tidak** membulatkan hasil akhirnya.
Pembulatan baru dilakukan saat ditampilkan. Kalau dibulatkan di tengah
perhitungan, kesalahan bisa menumpuk.

---

## Bagian D: Masalah 3 — Tanggal

### D.1 Akhir Bulan

**Kasus:** Langganan mulai 31 Januari, siklus bulanan. Kapan jatuh tempo?

```javascript
// Cara NAIF (salah):
new Date(2026, 0, 31);        // 31 Jan 2026
// tambah 1 bulan →
new Date(2026, 1, 31);        // JavaScript otomatis jadi 3 Maret 2026!
```

Ini **bug klasik**. JavaScript "membetulkan" tanggal yang tidak ada dengan
menggeser ke bulan berikutnya. Akibatnya jatuh tempo melompat dari Februari
ke Maret.

```typescript
// Cara Whenly (benar):
export function addMonthsClamped(iso: string, months: number): string {
  const base = parseISODate(iso);
  const day = base.getUTCDate();                    // ambil tanggalnya (31)
  const targetMonth = base.getUTCMonth() + months;
  const normalized = new Date(Date.UTC(base.getUTCFullYear(), targetMonth, 1));
  const y = normalized.getUTCFullYear();
  const m = normalized.getUTCMonth();
  const day_ = Math.min(day, lastDayOfMonth(y, m)); // ← KUNCI!
  return toISODate(new Date(Date.UTC(y, m, day_)));
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}
```

**`Math.min(31, 28)` = 28.** Jadi hasilnya 28 Februari — benar.

### D.2 Tabel Hasil Clamping

| Tanggal mulai | + bulan | Hasil | Catatan |
|---|---|---|---|
| 15 Jan 2026 | 1 | 15 Feb 2026 | Normal |
| 31 Jan 2026 | 1 | **28 Feb 2026** | 2026 bukan kabisat |
| 31 Jan 2024 | 1 | **29 Feb 2024** | 2024 kabisat |
| 31 Mar 2026 | 1 | **30 Apr 2026** | April cuma 30 hari |
| 29 Feb 2024 | 12 | **28 Feb 2025** | Tahun berikutnya bukan kabisat |

### D.3 Aturan Tahun Kabisat

```typescript
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
```

**Aturan lengkap Gregorian:**

| Aturan | Contoh | Kabisat? |
|---|---|---|
| Habis dibagi 4 | 2024 | ✓ Ya |
| Habis dibagi 4, tapi juga 100 | 1900 | ✗ Tidak |
| Habis dibagi 400 | 2000 | ✓ Ya |

Kenapa aturan ini penting? Karena kalender Gregorian menyesuaikan diri dengan
rotasi bumi. Tanpa aturan 100 dan 400, kalender akan melenceng ~3 hari setiap
400 tahun.

### D.4 Masalah Zona Waktu

**Kasus nyata:**

```
Laptop user di Jakarta (UTC+7):
  Waktu lokal: 1 Januari 2026, 00:30

Server di Amerika (UTC-5):
  Waktu lokal: 31 Desember 2025, 17:30
```

Kalau pakai waktu **lokal**, user dan server **berbeda hari**. User lihat
"jatuh tempo besok", server bilang "hari ini". Aplikasi jadi tidak konsisten.

**Solusi Whenly: pakai UTC untuk perhitungan.**

```typescript
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));  // ← UTC
}

export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Jarak hari antara dua tanggal ISO */
export function daysBetweenISO(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);
}
```

Hanya untuk **tampilan** kita konversi ke Asia/Jakarta:

```typescript
export const TZ = process.env.TIMEZONE || 'Asia/Jakarta';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,        // ← konversi ke Jakarta hanya di sini
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayISO(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}
```

> **Kalimat presentasi:**
> "Semua perhitungan tanggal pakai UTC supaya server di mana pun
> menghasilkan angka yang sama. Konversi ke waktu Jakarta hanya untuk
> tampilan. Kalau tidak, user di Jakarta dan server di Amerika bisa
> berbeda hari."

---

## Bagian E: Menghitung Proyeksi (Analytics)

### E.1 Dari Mana Angka "Proyeksi Tahunan" Datang?

1. Ambil semua langganan yang **statusnya aktif**
2. Saring: mana yang **benar-benar ditagih** (bukan trial)
3. Ubah semuanya ke **per bulan** dengan `monthlyEquivalent()`
4. Jumlahkan
5. Kalikan 12 untuk proyeksi tahunan (atau jumlahkan `yearlyEquivalent()`)

### E.2 Free Trial Tidak Dihitung

```typescript
export function isBillableNow(sub: SubscriptionLike, today = todayISO()): boolean {
  if (sub.status !== 'active') return false;   // dijeda/dibatalkan → tidak
  return !isTrialActive(sub, today);            // trial → tidak
}
```

**Kenapa?** Karena selama trial, user belum bayar apa pun. Kalau dihitung,
total pengeluaran jadi terlihat lebih besar dari kenyataan — menyesatkan.

**TAPI** untuk **proyeksi ke depan**, kita harus pakai harga setelah trial:

```typescript
export function effectivePrice(sub: SubscriptionLike): number {
  if (sub.isFreeTrial && sub.priceAfterTrial != null && sub.priceAfterTrial > 0) {
    return sub.priceAfterTrial;   // ← harga yang AKAN dibayar
  }
  return Math.max(0, Number(sub.price) || 0);
}
```

**Jadi ada dua angka berbeda:**

| Pertanyaan | Fungsi | Contoh hasil |
|---|---|---|
| "Berapa yang saya bayar bulan ini?" | `isBillableNow` + `price` | Rp 0 (masih trial) |
| "Berapa yang akan saya bayar terus?" | `effectivePrice` | Rp 120.000 |

> **Kalimat presentasi:**
> "Kami pisahkan dua hal: pengeluaran yang sudah terjadi vs proyeksi ke
> depan. Untuk proyeksi, kami pakai harga setelah trial — karena itu yang
> akan benar-benar dibayar."

### E.3 Anggaran (Budget Planner)

```
Anggaran bulanan user: Rp 500.000
Total pengeluaran bulanan: Rp 411.900

Sisa       = 500.000 − 411.900 = Rp 88.100
Terpakai % = 411.900 ÷ 500.000 × 100 = 82,38%
```

```typescript
/** Persentase yang aman (hindari bagi nol) */
export function safePercent(part: number, total: number, digits = 1): number {
  if (!total) return 0;                 // ← JANGAN bagi nol!
  const raw = (part / total) * 100;
  const factor = 10 ** digits;
  return Math.round(raw * factor) / factor;
}
```

Perhatikan `if (!total) return 0`. Kalau user belum set anggaran (nilainya 0),
pembagian langsung akan menghasilkan `Infinity` — yang bikin tampilan rusak.
Ini **defensive programming**.

---

## Bagian F: Latihan Praktis

Coba hitung dulu, baru lihat jawabannya.

### Latihan 1 — Dasar

Langganan Rp 79.000/bulan. Berapa total setahun?

<details>
<summary>Jawaban</summary>

Karena bulanan, per tahun = 79.000 × 12 = **Rp 948.000**

</details>

### Latihan 2 — Tahunan ke Bulanan

Langganan Rp 1.500.000/tahun. Berapa per bulan?

<details>
<summary>Jawaban</summary>

1.500.000 ÷ 12 = **Rp 125.000**

</details>

### Latihan 3 — Mingguan (yang menjebak)

Langganan Rp 25.000/minggu. Berapa per bulan? Bandingkan dengan
langganan Rp 100.000/bulan — mana lebih mahal?

<details>
<summary>Jawaban</summary>

Mingguan:
- per tahun = 25.000 × 365,2425 ÷ 7 = 25.000 × 52,1775 = Rp 1.304.437
- per bulan = 1.304.437 ÷ 12 = **Rp 108.703**

Pembanding: Rp 100.000/bulan

**Mingguan Rp 25.000 LEBIH MAHAL** dari Rp 100.000/bulan!
Padahal angkanya terlihat lebih kecil. Inilah kenapa normalisasi penting.

</details>

### Latihan 4 — Kustom

Langganan Rp 600.000 per 90 hari. Berapa per bulan?

<details>
<summary>Jawaban</summary>

- per tahun = 600.000 × 365,2425 ÷ 90 = 600.000 × 4,0582 = Rp 2.434.950
- per bulan = 2.434.950 ÷ 12 = **Rp 202.912**

</details>

### Latihan 5 — Clamping

Langganan mulai 30 April 2026, bulanan. Jatuh tempo berikutnya?

<details>
<summary>Jawaban</summary>

Mei punya 31 hari. Tanggal 30 ada di Mei.
Jadi jawabannya **30 Mei 2026**.

Sekarang: dari 30 Mei + 1 bulan?
Juni cuma 30 hari, tanggal 30 ada. Jawabannya **30 Juni 2026**.

</details>

### Latihan 6 — Clamping (yang benar-benar kena)

Langganan mulai 31 Desember 2026, bulanan. Jatuh tempo berikutnya?

<details>
<summary>Jawaban</summary>

Januari 2027 punya 31 hari. Tanggal 31 ada.
Jawabannya **31 Januari 2027**.

Lalu dari 31 Januari + 1 bulan? Februari 2027 cuma 28 hari.
Jawabannya **28 Februari 2027** ← ini yang kena clamping.

</details>

### Latihan 7 — Kabisat

Langganan mulai 31 Januari 2024, bulanan. Jatuh tempo berikutnya?
Dan setelah itu?

<details>
<summary>Jawaban</summary>

31 Jan 2024 + 1 bulan:
2024 **kabisat**, Februari ada 29 hari.
→ **29 Februari 2024**

29 Feb 2024 + 1 bulan:
Maret ada 31 hari, tanggal 29 ada.
→ **29 Maret 2024**

</details>

### Latihan 8 — Bilangan Desimal

Mengapa `0.1 + 0.2` bukan `0.3`? Kaitkan dengan uang.

<details>
<summary>Jawaban</summary>

Komputer menyimpan angka dalam biner. Angka 0,1 tidak punya bentuk biner
yang tepat (seperti 1/3 dalam desimal: 0,3333... tak berujung). Jadi
disimpan sebagai angka terdekat, dan penjumlahannya menghasilkan selisih
kecil.

Untuk uang, selisih ini berbahaya karena menumpuk. Karena itu Whenly
menyimpan harga sebagai bilangan bulat Rupiah dan membulatkan semua hasil.

</details>

---

## Bagian G: Ringkasan Satu Halaman

**Untuk ditempel di meja saat presentasi:**

```
╔══════════════════════════════════════════════════════════════════╗
║  RUMUS UTAMA WHENLY                                              ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  SATU TAHUN = 365,2425 hari   (bukan 365! ada kabisat)          ║
║                                                                  ║
║                         Harga × 365,2425                         ║
║  Biaya per tahun  =  ───────────────────────                     ║
║                       Jumlah hari dalam siklus                   ║
║                                                                  ║
║  Biaya per bulan  =  Biaya per tahun ÷ 12                        ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  JUMLAH HARI PER SIKLUS                                          ║
║    mingguan  →  7                                                ║
║    bulanan   →  30,436875   (= 365,2425 ÷ 12)                    ║
║    tahunan   →  365,2425                                         ║
║    kustom    →  sesuai input user                                ║
╠══════════════════════════════════════════════════════════════════╣
║  TIGA PRINSIP UANG                                               ║
║    1. Simpan sebagai BILANGAN BULAT (hindari 0,1+0,2≠0,3)       ║
║    2. NORMALISASI ke periode sama sebelum dibandingkan          ║
║    3. Tanggal: KLEM akhir bulan + hitung KABISAT + pakai UTC    ║
╠══════════════════════════════════════════════════════════════════╣
║  CONTOH YANG MENGEJUTKAN                                         ║
║    Rp 1.200.000/tahun  →  Rp 100.000/bulan  (murah!)            ║
║    Rp 350.000/45 hari  →  Rp 236.731/bulan  (mahal!)            ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Bagian H: Cara Menjelaskan ke Orang Non-Teknis

Kalau penguji bukan orang teknis, jangan sebut "biner" atau "float".
Pakai analogi:

**Soal desimal:**
> "Bayangkan kamu mengukur dengan penggaris yang garisnya tidak pas.
> Setiap kali mengukur, salahnya sedikit. Kalau mengukur 1.000 kali,
> salahnya jadi besar. Komputer begitu kalau dipaksa menghitung uang
> pakai angka berkoma. Jadi kami pakai angka bulat."

**Soal siklus berbeda:**
> "Membandingkan Rp 1 juta/tahun dengan Rp 100 ribu/bulan itu seperti
> membandingkan 1 kilogram dengan 1 meter. Harus disamakan satuannya
> dulu. Kami samakan semuanya jadi 'per bulan'."

**Soal tanggal:**
> "Kalau langgananmu dimulai tanggal 31, bulan depan jatuh temponya
> kapan? Tidak ada 31 Februari. Jadi kami pilih hari terakhir bulan itu
> — 28 atau 29. Kalau tidak diatur, tagihannya bisa melompat ke Maret."

---

*Dokumen ini bagian dari project Whenly.*
