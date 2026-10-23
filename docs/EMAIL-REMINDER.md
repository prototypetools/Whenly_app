# Pengingat Email (Resend + Vercel Cron)

Fitur ini mengirim email otomatis beberapa hari sebelum langganan diperbarui,
supaya pengguna tidak kaget saat saldo terpotong.

## Bagian yang terlibat

| File | Fungsi |
|---|---|
| `src/lib/email.ts` | Pengirim email + template HTML |
| `src/lib/reminders.ts` | Logika pemindaian, ambang H-, anti-duplikat |
| `src/app/api/cron/reminders/route.ts` | Endpoint yang dipanggil cron |
| `src/app/api/reminders/test/route.ts` | Kirim email uji dari halaman Renewal |
| `src/app/api/reminders/route.ts` | Simpan preferensi `emailEnabled` |
| `src/components/forms/ReminderSettingsForm.tsx` | Toggle email + tombol uji |
| `prisma/schema.prisma` → `ReminderLog` | Riwayat + pencegah email dobel |
| `vercel.json` → `crons` | Jadwal harian 01:00 UTC (08:00 WIB) |

## Cara kerja

1. Cron harian memanggil `/api/cron/reminders`.
2. Server mengambil langganan aktif yang tanggal renewal-nya dalam 60 hari.
3. Hanya pengguna dengan `ReminderSetting.emailEnabled = true` yang diproses.
4. Email dikirim pada ambang: **H-{defaultDaysBefore}**, **H-1**, dan **H-0**.
   Untuk langganan trial, acuannya `trialEndDate` (jenis `trial`).
5. Setiap pengiriman dicatat di `ReminderLog`. Kombinasi
   (langganan + jenis + tanggal + H-) yang sudah pernah diproses tidak dikirim lagi.
6. Bila `RESEND_API_KEY` kosong, status log adalah `skipped` — bukan `sent`.
   Artinya sistem tidak pernah berpura-pura berhasil.

## Setup

### 1. Buat akun Resend

1. Buka https://resend.com → daftar (gratis: 3.000 email/bulan, 100/hari).
2. **API Keys → Create API Key** → simpan nilainya (`re_...`).

### 2. Pilih alamat pengirim

**Pilihan A — tanpa domain (paling cepat untuk demo):**

```env
REMINDER_FROM_EMAIL="Whenly <onboarding@resend.dev>"
```

Keterbatasan: Resend **hanya mengizinkan pengiriman ke email pemilik akun
Resend** (email yang kamu pakai saat daftar). Jadi untuk demo, login ke Whenly
memakai email pribadi tersebut, bukan `demo@subscriptly.id`.

**Pilihan B — dengan domain sendiri:**

1. Resend → **Domains → Add Domain** → ikuti instruksi DNS (SPF/DKIM).
2. Setelah terverifikasi:

```env
REMINDER_FROM_EMAIL="Whenly <pengingat@domainmu.com>"
```

Dengan cara ini email bisa dikirim ke alamat mana pun.

### 3. Isi environment

Lokal (`.env`) dan Vercel (Production + Preview):

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
REMINDER_FROM_EMAIL="Whenly <onboarding@resend.dev>"
NEXT_PUBLIC_APP_URL="https://whenly-app.vercel.app"
CRON_SECRET=<string acak 64 karakter>
```

Buat `CRON_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Vercel Cron otomatis mengirim header `Authorization: Bearer <CRON_SECRET>`
bila variabel tersebut ada.

### 4. Deploy

```bash
npx vercel deploy --prod --scope whenly-project
```

Cron terdaftar otomatis dari `vercel.json`. Di paket Hobby, cron hanya boleh
**sekali sehari** — cukup untuk pengingat H-3/H-1/H-0.

## Uji manual

### Lewat aplikasi
1. Login → **Renewal & Reminder**
2. Centang **Pengingat email** → **Simpan pengaturan**
3. Klik **Kirim email uji** → cek kotak masuk

### Lewat terminal

```bash
# Pratinjau tanpa mengirim
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://whenly-app.vercel.app/api/cron/reminders?dry=1"

# Jalankan sungguhan
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://whenly-app.vercel.app/api/cron/reminders"
```

Respons berisi `scanned`, `sent`, `skipped`, `failed`, `duplicates`, dan
daftar `items` per langganan.

## Cara menjelaskan saat presentasi

> "Pengingat berjalan otomatis lewat cron harian di Vercel. Server memeriksa
> langganan yang akan diperbarui, lalu mengirim email pada H-3, H-1, dan hari-H.
> Setiap pengiriman dicatat di tabel `ReminderLog`, jadi satu tagihan tidak
> mungkin dikirimi email yang sama dua kali. Kalau layanan email belum
> dikonfigurasi, sistem menandainya 'dilewati' — tidak berpura-pura terkirim."

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Status `skipped` | `RESEND_API_KEY` kosong | Isi key, lalu redeploy |
| Resend error 403 | Kirim ke alamat selain email pemilik akun pada mode `onboarding@resend.dev` | Pakai email pemilik akun, atau verifikasi domain |
| Email masuk spam | Domain belum terverifikasi | Verifikasi domain + SPF/DKIM |
| Cron tidak jalan | Deploy belum setelah `vercel.json` diubah | Redeploy |
| Tidak ada email padahal H-3 | `emailEnabled` belum dicentang | Aktifkan di halaman Renewal |
| Email dobel | Seharusnya tidak terjadi | Cek `ReminderLog`; kombinasi unik dicek sebelum kirim |

## Batasan yang jujur

- Belum ada pengingat push (browser/HP).
- Belum ada halaman berhenti berlangganan email (unsubscribe) — untuk produksi
  wajib ditambahkan.
- Belum ada antrean/retry otomatis; email gagal akan dicoba lagi pada cron
  berikutnya karena status `failed` tidak dianggap duplikat.
