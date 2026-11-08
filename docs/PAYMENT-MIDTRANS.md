# Pembayaran dengan Midtrans (Snap)

Dokumen ini menjelaskan cara kerja pembayaran Whenly, cara mengaktifkan Midtrans
sandbox, dan batasannya. Kode integrasi sudah terpasang; **produksi masih memakai
mode sandbox internal** sampai kunci Midtrans diisi.

---

## 1. Dua mode pembayaran

| Mode | `BILLING_PROVIDER` | Uang nyata? | Dipakai untuk |
| --- | --- | --- | --- |
| Sandbox internal | `mock` (default) | Tidak | Demo presentasi tanpa akun Midtrans |
| Midtrans Snap | `midtrans` | Tergantung `MIDTRANS_IS_PRODUCTION` | Uji sandbox atau produksi |

Kalau `BILLING_PROVIDER=midtrans` tetapi `MIDTRANS_SERVER_KEY` kosong, aplikasi
**menolak checkout** dengan pesan jelas. Tidak ada pembayaran palsu yang diklaim berhasil.

---

## 2. Alur pembayaran

```
Pengguna                Whenly                         Midtrans
   |                       |                              |
   | klik "Upgrade"        |                              |
   |---------------------->| buat BillingEvent (pending)   |
   |                       |------------------------------>| POST /snap/v1/transactions
   |                       |<------------------------------| token + redirect_url
   |<----------------------| redirect                     |
   |  pilih metode bayar   |                              |
   |----------------------------------------------------->|
   |                       |<------------------------------| webhook (status)
   |                       | verifikasi signature SHA512  |
   |                       | nominal cocok?               |
   |                       | aktifkan paket (idempotent)  |
   |<----------------------| halaman /billing             |
```

Yang disimpan Whenly hanya:
- `BillingEvent` (order id, nominal, status, referensi transaksi)
- `Membership` (paket aktif, periode)
- Status pembayaran di `User`

**Tidak ada nomor kartu/rekening yang pernah menyentuh server Whenly.**

---

## 3. Mengaktifkan Midtrans sandbox

### Langkah 1 — Buat akun
1. Daftar di <https://dashboard.sandbox.midtrans.com>.
2. Masuk ke **Settings → Access Keys**.
3. Salin **Server Key** (diawali `SB-Mid-server-...`).

### Langkah 2 — Isi environment

Lokal (`.env`):
```env
BILLING_PROVIDER=midtrans
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
```

Vercel (Production + Preview), lalu **redeploy**:
```bash
vercel env add MIDTRANS_SERVER_KEY production
vercel env add MIDTRANS_IS_PRODUCTION production
vercel env add BILLING_PROVIDER production
```
Nilai `MIDTRANS_IS_PRODUCTION` = `false` untuk sandbox.

> Jangan pernah menaruh Server Key di kode atau di variabel `NEXT_PUBLIC_*`.
> Kunci itu hanya boleh ada di server.

### Langkah 3 — Daftarkan webhook
Di dashboard Midtrans: **Settings → Payment → Notification URL**

```
https://whenly-app.vercel.app/api/billing/webhook
```

Midtrans akan mengirim POST setiap status berubah. Endpoint membalas HTTP 200
agar tidak dikirim ulang terus-menerus.

### Langkah 4 — Uji

1. Login sebagai pengguna (bukan mode demo browser).
2. Buka **Paket & Harga** → pilih Premium → **Lanjut ke pembayaran**.
3. Kamu diarahkan ke halaman Snap.
4. Gunakan kartu uji sandbox:
   - `4811 1111 1111 1114` (berhasil)
   - `4911 1111 1111 1113` (ditolak bank)
   - CVV `123`, masa berlaku bebas (mis. `01/30`), OTP `112233`
5. Setelah berhasil, kembali ke `/billing`. Paket harus sudah aktif.

Kalau webhook tidak sampai (mis. saat develop lokal), status tetap *pending*.
Itu benar: **paket tidak boleh aktif tanpa bukti pembayaran**.

### Uji webhook manual (tanpa membayar)

```bash
# Ganti nilai sesuai data di database. Signature dihitung dari:
# SHA512(order_id + status_code + gross_amount + server_key)
curl -X POST https://whenly-app.vercel.app/api/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "<id BillingEvent>",
    "status_code": "200",
    "gross_amount": "99000.00",
    "signature_key": "<sha512>",
    "transaction_status": "settlement",
    "transaction_id": "trx-manual-1"
  }'
```

Signature salah → `401`. Nominal tidak cocok → `400`.

---

## 4. Keamanan yang sudah diterapkan

1. **Signature SHA512** diverifikasi dengan `timingSafeEqual`.
2. **Nominal dicek** terhadap nilai yang tercatat saat checkout.
3. **Idempotensi**: perubahan status memakai `updateMany` bersyarat
   (`status = pending`). Webhook yang dikirim dua kali tidak membuat dua
   keanggotaan atau memperpanjang masa aktif dua kali.
4. **Tidak ada aktivasi manual** saat provider Midtrans: tombol konfirmasi
   manual ditolak (`CONFIRM_NOT_ALLOWED`).
5. **Server Key hanya di server**, tidak pernah dikirim ke browser.
6. **Mode sandbox ditandai** di UI dan di database (`paymentStatus = paid`,
   tetapi `sandbox = true` pada tampilan).

---

## 5. Batasan penting (jujur)

- **Belum ada penagihan berulang otomatis.** Midtrans Snap di sini adalah
  pembayaran satu kali per periode. Saat masa aktif habis, pengguna harus
  membayar lagi. Untuk auto-recurring perlu Midtrans Subscription/recurring API
  atau cron yang menagih tersimpan token — belum diimplementasikan.
- **Refund tidak otomatis mencabut paket.** Webhook refund hanya menandai
  `BillingEvent` sebagai `refunded`; keputusan mencabut akses masih manual.
- **Midtrans sandbox dan production memakai kunci berbeda.** Jangan campur.
- **Webhook butuh URL publik.** `localhost` tidak bisa menerima webhook Midtrans
  kecuali memakai tunnel (ngrok/Cloudflare Tunnel).
- **PPN/harga:** harga di aplikasi belum memisahkan PPN. Jika kelak berjualan
  resmi, tentukan apakah harga sudah termasuk PPN dan catat kewajiban pajaknya.

---

## 6. Berkas terkait

| Berkas | Peran |
| --- | --- |
| `src/lib/midtrans.ts` | Panggil Snap API, verifikasi signature, mapping status |
| `src/lib/billing.ts` | `createCheckout`, aktivasi idempotent, `handleMidtransNotification` |
| `src/app/api/billing/checkout/route.ts` | Membuat transaksi |
| `src/app/api/billing/webhook/route.ts` | Menerima notifikasi Midtrans |
| `src/app/api/billing/confirm/route.ts` | Konfirmasi manual (hanya mode mock) |
| `src/components/billing/PlanSelector.tsx` | Redirect ke halaman Snap |
| `prisma/test-midtrans.ts` | Uji signature, nominal, idempotensi tanpa internet |

Jalankan uji logika:
```bash
npx tsx prisma/test-midtrans.ts
```

---

## 7. Troubleshooting

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| Checkout 501/503 | Kunci belum diisi | Isi env, redeploy |
| "Midtrans menolak transaksi" | Server key salah / akun sandbox vs production | Cocokkan kunci dan `MIDTRANS_IS_PRODUCTION` |
| Pembayaran sukses tapi paket belum aktif | Webhook belum terdaftar / gagal diverifikasi | Cek Notification URL dan log Vercel |
| Webhook 401 | Signature tidak cocok | Pastikan Server Key benar dan body tidak diubah proxy |
| Webhook 400 | Nominal berbeda | Cek amount di `BillingEvent` vs `gross_amount` |
| Paket aktif dua kali | Seharusnya tidak terjadi (idempotensi) | Periksa apakah ada dua order berbeda |

---

## 8. Skrip presentasi (30 detik)

> "Whenly memakai Midtrans Snap. Saat pengguna memilih paket, server membuat
> transaksi dan mengarahkan ke halaman pembayaran Midtrans — kartu, QRIS, GoPay,
> atau virtual account. Setelah pembayaran, Midtrans mengirim webhook. Server
> memverifikasi signature SHA512 dan nominalnya, lalu mengaktifkan paket secara
> idempotent, jadi notifikasi ganda tidak mungkin memperpanjang langganan dua kali.
> Aplikasi tidak pernah menyimpan data kartu; itu semua di Midtrans."
