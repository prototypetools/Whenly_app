# Notifikasi Perangkat (Web Push) — Whenly

Dokumen ini menjelaskan fitur pengingat yang **muncul sebagai pop-up di HP/laptop**,
cara kerja teknisnya, cara mengaktifkan, dan cara mendemonstrasikannya saat presentasi.

---

## 1. Tiga lapis pengingat

| Lapis | Kapan muncul | Butuh izin? | Butuh layanan luar? |
| --- | --- | --- | --- |
| **Pop-up dalam aplikasi** | Saat membuka Whenly, sekali per hari | Tidak | Tidak |
| **Notifikasi perangkat (push)** | Dikirim cron harian, muncul walau aplikasi ditutup | Ya (izin browser) | Tidak (memakai VAPID sendiri) |
| **Email** | Dikirim cron harian | Tidak | Ya (Resend) |

Ketiganya memakai **mesin pengingat yang sama** (`src/lib/reminders.ts`), sehingga
ambang waktu dan aturan anti-duplikatnya konsisten.

---

## 2. Cara kerja Web Push (versi singkat untuk presentasi)

1. Pengguna membuka halaman **Renewal** lalu menekan **Aktifkan notifikasi**.
2. Browser meminta izin notifikasi. Setelah diizinkan, browser membuat
   **PushSubscription** berisi `endpoint` unik + kunci enkripsi (`p256dh`, `auth`).
3. Subscription dikirim ke server dan disimpan di tabel **`PushSubscription`**
   (satu pengguna boleh punya beberapa perangkat).
4. Setiap hari, **Vercel Cron** memanggil `/api/cron/reminders`.
5. Untuk tagihan yang jatuh tempo, server mengirim payload terenkripsi ke endpoint
   perangkat memakai kunci **VAPID**.
6. **Service worker** (`public/sw.js`) menerima event `push` dan menampilkan
   notifikasi sistem. Saat diklik, aplikasi terbuka di halaman Renewal.

> Tidak ada layanan pihak ketiga yang membaca data langganan. Yang dikirim hanya
> judul, nominal, dan tanggal tagihan — dienkripsi end-to-end sesuai standar Web Push.

---

## 3. Konfigurasi (sudah dilakukan di produksi)

Variabel environment yang dibutuhkan:

| Variabel | Fungsi | Status |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | Kunci publik, dipakai browser untuk subscribe | ✅ Production + Preview |
| `VAPID_PRIVATE_KEY` | Kunci privat, dipakai server untuk menandatangani kiriman | ✅ Production + Preview |
| `VAPID_SUBJECT` | Kontak pengelola (`mailto:...`) | ✅ `mailto:halo@whenly.app` |
| `NEXT_PUBLIC_APP_URL` | URL absolut untuk tautan notifikasi | ✅ |
| `CRON_SECRET` | Mengamankan endpoint cron | ✅ |

Membuat kunci baru (jika perlu):

```bash
npx web-push generate-vapid-keys --json
```

Lalu simpan ke `.env` lokal dan ke Vercel (Production + Preview), kemudian redeploy.
**Mengganti kunci VAPID membuat semua subscription lama tidak valid** — pengguna
harus menekan "Aktifkan notifikasi" lagi.

---

## 4. Struktur berkas

| Berkas | Peran |
| --- | --- |
| `src/lib/push.ts` | Kirim push, bersihkan subscription kedaluwarsa (404/410), format pesan |
| `src/lib/reminders.ts` | Mesin pengingat: email + push, ambang H-N/H-1/H-0, anti-duplikat per kanal |
| `src/app/api/push/public-key/route.ts` | Memberi kunci publik VAPID ke browser |
| `src/app/api/push/subscribe/route.ts` | Menyimpan subscription (maks. 10 perangkat/pengguna) |
| `src/app/api/push/unsubscribe/route.ts` | Menghapus subscription |
| `src/app/api/push/test/route.ts` | Kirim notifikasi uji ke perangkat pengguna |
| `public/sw.js` | Service worker: tampilkan notifikasi & tangani klik |
| `src/components/notifications/PushSettings.tsx` | Panel aktivasi di halaman Renewal |
| `src/components/notifications/ReminderPopup.tsx` | Pop-up pengingat saat membuka aplikasi |
| `src/app/manifest.ts` | Manifest PWA (syarat push di iPhone) |
| `prisma/schema.prisma` | Model `PushSubscription` |

---

## 5. Cara menguji

### 5.1 Di laptop (Chrome/Edge)

1. Buka `https://whenly-app.vercel.app/renewals` dan login.
2. Klik **Aktifkan notifikasi**, pilih **Allow**.
3. Status berubah menjadi **Aktif di perangkat ini**.
4. Klik **Kirim notifikasi uji** → notifikasi muncul di pojok layar.
5. Tutup tab Whenly, lalu jalankan cron manual (lihat 5.4) untuk membuktikan
   notifikasi tetap masuk walau aplikasi ditutup.

### 5.2 Di Android (Chrome)

Sama seperti desktop. Tidak perlu instal aplikasi.

### 5.3 Di iPhone/iPad (Safari, iOS 16.4+)

1. Buka situs di Safari.
2. Tombol **Share** → **Add to Home Screen**.
3. Buka Whenly **dari ikon Home Screen** (bukan dari tab Safari).
4. Masuk, buka Renewal, aktifkan notifikasi. iOS akan meminta izin.

> Panel pengaturan otomatis menampilkan petunjuk ini saat mendeteksi iOS di luar mode
> standalone.

### 5.4 Menjalankan cron manual (uji pengingat nyata)

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  "https://whenly-app.vercel.app/api/cron/reminders?dry=1"
```

- `?dry=1` → hanya menghitung, tidak mengirim dan tidak menulis riwayat.
- Hapus `dry=1` untuk benar-benar mengirim (email + push).
- `?today=2026-10-26` memaksa tanggal acuan tertentu untuk simulasi.

### 5.5 Uji logika tanpa browser

```bash
npx tsx prisma/test-reminder.ts   # email + dedup + trial
npx tsx prisma/test-push.ts       # kanal push + endpoint palsu
```

---

## 6. Aturan pengiriman & anti-duplikat

- Ambang: `defaultDaysBefore` pengguna (default 3), **H-1**, dan **H-0**.
- Satu pesan per kombinasi:
  `(subscriptionId, kind, channel, dueDate, daysBefore)`.
- Dicatat di tabel `ReminderLog` dengan `status`:
  `sent` / `skipped` / `failed`.
- Jika tanggal trial == tanggal tagihan, hanya **satu** notifikasi trial yang dikirim.
- Kanal push hanya dipakai bila pengguna punya minimal satu `PushSubscription`.
- Kanal email hanya dipakai bila `emailEnabled = true` dan `RESEND_API_KEY` tersedia.
- Subscription yang sudah tidak valid (HTTP 404/410) otomatis dihapus.

---

## 7. Batasan yang perlu disebut jujur

1. **Vercel Hobby hanya mengizinkan cron sekali sehari.** Notifikasi dikirim sekitar
   pukul 08.00 WIB. Untuk pengiriman lebih sering perlu paket Pro atau scheduler lain.
2. **Perangkat harus online** saat notifikasi dikirim; jika offline, push disimpan
   sementara oleh layanan push browser (TTL 24 jam).
3. **iPhone butuh PWA** (Add to Home Screen) dan iOS 16.4+.
4. **Izin bisa dicabut** kapan saja oleh pengguna lewat pengaturan browser.
5. Push bukan WhatsApp/SMS. Untuk kanal itu perlu penyedia lain (mis. Twilio).

---

## 8. Skrip presentasi (30 detik)

> "Whenly tidak hanya mencatat langganan. Ada tiga lapis pengingat. Pertama, saat
> kamu membuka aplikasi, muncul pop-up tagihan yang mendekat. Kedua, kamu bisa
> mengaktifkan notifikasi perangkat — ini memakai Web Push standar, jadi tetap muncul
> walau aplikasi ditutup, tanpa biaya layanan pihak ketiga. Ketiga, email otomatis
> lewat Resend. Semuanya dijalankan oleh satu cron harian yang dilindungi secret,
> dan setiap pengiriman dicatat supaya tidak ada notifikasi dobel."

### Pertanyaan yang mungkin muncul

**"Apakah ini benar-benar push, bukan cuma pengingat di dalam web?"**
Ya. Service worker menerima push dari server lewat Push API, sehingga notifikasi
tetap tampil saat tab ditutup. Bisa dibuktikan dengan mengirim notifikasi uji lalu
menutup tab.

**"Kenapa iPhone harus di-add to home screen?"**
Itu kebijakan Apple: Web Push baru tersedia untuk PWA terpasang sejak iOS 16.4.

**"Apakah data saya aman?"**
Payload dienkripsi sesuai protokol Web Push. Server hanya menyimpan endpoint dan
kunci publik perangkat, bukan isi notifikasi. Kunci privat VAPID hanya ada di server.

**"Berapa biayanya?"**
Web Push tidak berbayar. Yang berbayar hanya email (Resend) di atas kuota gratis.

---

## 9. Troubleshooting

| Gejala | Penyebab umum | Solusi |
| --- | --- | --- |
| Tombol aktif tapi status tetap "Belum aktif" | Izin diblokir / subscription gagal | Buka pengaturan situs → Notifikasi → Allow, muat ulang |
| "Kunci VAPID belum diisi" | Env belum ada saat build | Tambahkan env di Vercel, **redeploy** |
| Notifikasi uji `sent: 0` | Belum ada perangkat terdaftar | Aktifkan dulu di perangkat tersebut |
| Notifikasi tidak masuk saat cron | `PushSubscription` kosong atau kedaluwarsa | Aktifkan ulang; cek tabel `PushSubscription` |
| iPhone tidak bisa aktivasi | Belum mode standalone | Add to Home Screen, buka dari ikon |
