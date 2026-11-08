# Whenly: Materi Belajar & Bank Soal (versi guru Ekonomi)

Dokumen ini untuk **kamu**, bukan untuk guru. Isinya:
1. Cara aplikasi dibuat, dijelaskan tanpa jargon.
2. Konsep ekonomi yang ada di dalam aplikasi.
3. Angka-angka nyata dari Whenly untuk latihan hitung.
4. 30 soal + kunci jawaban.
5. Pertanyaan yang mungkin ditanya guru Ekonomi + jawaban singkat.
6. Tips presentasi.

---

# BAGIAN 1 — Cara aplikasi ini dibuat (bahasa manusia)

## 1.1 Analogi restoran

| Bagian aplikasi | Analogi | Fungsi |
| --- | --- | --- |
| **Next.js** | Etalase + pelayan | Menampilkan halaman dan menerima permintaan pengguna |
| **Supabase (PostgreSQL)** | Gudang | Menyimpan data: user, langganan, tagihan, riwayat |
| **Prisma** | Juru tulis gudang | Menerjemahkan perintah aplikasi menjadi query database |
| **Vercel** | Lokasi restoran | Menjalankan aplikasi di internet (hosting) |
| **Midtrans** | Kasir bank | Memproses pembayaran |
| **Resend** | Kantor pos | Mengirim email pengingat |
| **Web Push** | Kurir ke rumah | Mengirim notifikasi ke HP/laptop |

## 1.2 Alur satu klik pengguna

Contoh: pengguna menekan **"Tambah langganan Netflix"**.

```
Browser (React)
   │  POST /api/subscriptions  { nama, harga, tanggal }
   ▼
Server (Next.js di Vercel)
   │  1. cek login (cookie sesi)
   │  2. validasi input (Zod)
   │  3. cek batas paket (Free maksimal 5 langganan)
   ▼
Prisma → Supabase
   │  INSERT INTO "Subscription" ...
   ▼
Server membalas 201 Created
   ▼
Browser memperbarui tampilan (tanpa reload)
```

Yang penting dipahami saat presentasi: **data tidak disimpan di browser**. Data
disimpan di database PostgreSQL milik Supabase. Browser hanya menampilkan.

## 1.3 Kenapa perlu database, bukan file Excel?

- Banyak pengguna mengakses bersamaan.
- Butuh aturan (mis. satu email hanya boleh satu akun).
- Butuh query cepat (mis. total tagihan 30 hari ke depan).
- Butuh cadangan dan keamanan.

## 1.4 Kenapa perlu payment gateway?

Memindahkan uang secara langsung dari aplikasi sendiri berisiko dan butuh izin.
Payment gateway (Midtrans) menangani:
- berbagai metode bayar (kartu, QRIS, GoPay, virtual account),
- verifikasi pembayaran,
- notifikasi otomatis (webhook),
- kepatuhan keamanan data kartu.

Whenly **tidak pernah menyimpan nomor kartu**. Yang disimpan hanya status dan
nomor referensi transaksi.

## 1.5 Istilah teknis yang cukup kamu tahu

| Istilah | Arti sederhana |
| --- | --- |
| API | Pintu tempat dua aplikasi saling bicara |
| Endpoint | Alamat pintu tersebut, mis. `/api/subscriptions` |
| Webhook | Telepon balik dari Midtrans: "pembayaran sudah beres" |
| Cron | Alarm harian yang menjalankan tugas otomatis |
| Sandbox | Lingkungan uji, uangnya palsu |
| Idempotent | Dijalankan berkali-kali, hasilnya tetap sama (tidak dobel) |
| Deploy | Menerbitkan versi aplikasi ke internet |

---

# BAGIAN 2 — Konsep ekonomi di dalam Whenly

## 2.1 Masalah ekonomi yang diselesaikan

Pengguna mengalami **kelangkaan**: uang terbatas, kebutuhan banyak. Langganan
digital mudah terlupakan, lalu uang terpotong otomatis. Whenly mengurangi
**biaya informasi** (mengingat tanggal) dan **biaya peluang** (uang terpakai
untuk hal yang tidak disadari).

## 2.2 Whenly sebagai jasa

- **Barang**: berwujud, dapat dipindahkan (buku, makanan).
- **Jasa**: tidak berwujud, dinikmati saat dipakai (Whenly, Netflix, ojek online).

Whenly adalah **jasa digital** dengan biaya marginal sangat rendah: menambah
satu pengguna hampir tidak menambah biaya produksi.

## 2.3 Struktur biaya

| Jenis biaya | Contoh di Whenly | Sifat |
| --- | --- | --- |
| Biaya tetap (FC) | Domain, server minimum, langganan alat | Tidak berubah walau pengguna naik |
| Biaya variabel (VC) | Komisi payment gateway, biaya email per pesan | Naik seiring jumlah transaksi |
| Biaya eksplisit | Tagihan Vercel/Supabase | Uang benar-benar keluar |
| Biaya implisit | Waktu kamu membangun aplikasi | Tidak berbentuk uang, tetap bernilai |

Pada prototipe, biaya tetap bisa **nol rupiah** karena memakai paket gratis.
Itu bukan berarti biayanya tidak ada — hanya ditanggung pihak lain (Vercel,
Supabase) sebagai strategi akuisisi mereka.

## 2.4 Model pendapatan

Whenly memakai **freemium + tiered pricing**:

| Paket | Harga bulanan | Harga tahunan | Target |
| --- | ---: | ---: | --- |
| Free | Rp0 | Rp0 | Akuisisi pengguna |
| Student | Rp4.900 | Rp49.000 | Mahasiswa (elastis harga) |
| Premium | Rp9.900 | Rp99.000 | Pengguna umum |

Pendapatan berulang disebut **MRR** (Monthly Recurring Revenue) dan **ARR**
(Annual Recurring Revenue).

```
MRR = jumlah pelanggan aktif × harga bulanan (rata-rata)
ARR = MRR × 12
ARPU = total pendapatan / jumlah pengguna
```

## 2.5 Diskon tahunan = diskriminasi harga tingkat dua

Harga tahunan Rp99.000 vs 12 × Rp9.900 = Rp118.800.

```
Hemat = 118.800 - 99.000 = Rp19.800
Persentase = 19.800 / 118.800 = 16,7%
```

Artinya pengguna "dihargai" karena mau membayar di muka. Manfaat bagi bisnis:
- kas masuk lebih awal (cash flow),
- churn lebih rendah (sudah terikat 12 bulan),
- biaya penagihan lebih sedikit (1 transaksi vs 12 transaksi).

## 2.6 Unit economics

```
Margin kontribusi = harga - biaya variabel per pengguna
BEP (unit)        = biaya tetap / margin kontribusi
LTV               = ARPU × margin / churn
LTV/CAC           = nilai seumur hidup / biaya akuisisi
Payback (bulan)   = CAC / (ARPU × margin)
```

Contoh dengan asumsi:
- Harga Premium Rp9.900
- Biaya variabel Rp1.200 (komisi gateway + email)
- Biaya tetap Rp500.000/bulan
- Churn 5%/bulan
- CAC Rp35.000

```
Margin      = 9.900 - 1.200 = 8.700
BEP         = 500.000 / 8.700 = 57,5 → 58 pelanggan
LTV         = 9.900 × (8.700/9.900) / 0,05 = 174.040
LTV/CAC     = 174.040 / 35.000 = 4,97  (sehat jika > 3)
Payback     = 35.000 / 8.700 = 4,02 bulan
```

## 2.7 Pendapatan vs arus kas (penting!)

Pengguna membayar tahunan Rp99.000 pada Januari.

- **Kas** Januari naik Rp99.000.
- **Pendapatan** Januari hanya Rp8.250 (99.000 ÷ 12).
- Sisa Rp90.750 adalah **pendapatan diterima di muka** (*deferred revenue*),
  diakui sebagai pendapatan di bulan-bulan berikutnya.

Ini sebabnya perusahaan bisa "banyak kas" tetapi "rugi" secara akuntansi, atau
sebaliknya.

## 2.8 Elastisitas permintaan

Jika harga naik 10% dan jumlah pembeli turun 15%:

```
Perubahan penerimaan = 1,10 × 0,85 = 0,935
Penerimaan turun 6,5%
```

Permintaan disebut **elastis** (|%Q| > |%P|). Untuk produk elastis, menaikkan
harga justru menurunkan penerimaan. Karena itu Whenly menyediakan paket Student
yang lebih murah untuk segmen sensitif harga.

## 2.9 Eksternalitas dan kepercayaan

- **Eksternalitas positif**: pengguna lebih sadar pengeluaran, mengurangi
  penagihan tak terduga.
- **Kepercayaan** adalah modal: tanpa kepercayaan, orang tidak mau menyerahkan
  data langganan dan pembayaran. Karena itu aplikasi menampilkan status
  "sandbox" secara jujur, bukan mengklaim pembayaran nyata.

---

# BAGIAN 3 — Angka Whenly untuk latihan

Gunakan angka ini untuk semua soal hitungan.

| Data | Nilai |
| --- | ---: |
| Premium bulanan | Rp9.900 |
| Premium tahunan | Rp99.000 |
| Student bulanan | Rp4.900 |
| Student tahunan | Rp49.000 |
| Harga 12× Premium bulanan | Rp118.800 |
| Harga 12× Student bulanan | Rp58.800 |
| Biaya variabel per transaksi (asumsi) | Rp1.200 |
| Biaya tetap per bulan (asumsi) | Rp500.000 |
| Churn bulanan (asumsi) | 5% |
| CAC (asumsi) | Rp35.000 |

---

# BAGIAN 4 — Bank soal (30 soal + kunci)

## A. Pilihan ganda (1–10)

**1.** Whenly termasuk kategori…
a. barang konsumsi
b. jasa digital
c. barang modal
d. sumber daya alam

**2.** Bagi pengguna, biaya langganan bulanan yang rutin termasuk…
a. biaya variabel
b. biaya tetap dalam anggaran bulanan
c. biaya implisit
d. biaya marginal

**3.** Hukum permintaan menyatakan, ceteris paribus, jika harga naik maka…
a. jumlah diminta naik
b. jumlah diminta turun
c. jumlah ditawarkan turun
d. kualitas naik

**4.** Diskon tahunan Whenly paling tepat disebut…
a. diskon kuantitas (diskriminasi harga tingkat dua)
b. dumping
c. subsidi pemerintah
d. penetapan harga predatory

**5.** Fungsi utama payment gateway adalah…
a. menyimpan dana pengguna selamanya
b. memproses dan memverifikasi pembayaran
c. membuat iklan
d. menghitung pajak otomatis

**6.** Biaya yang tidak berubah ketika jumlah pengguna bertambah disebut…
a. biaya variabel
b. biaya tetap
c. biaya marginal
d. biaya peluang

**7.** ARPU adalah singkatan dari…
a. Average Revenue Per User
b. Annual Rate Per Unit
c. Average Return Per Utility
d. Automatic Revenue Payment Unit

**8.** Jika churn meningkat, maka LTV…
a. naik
b. turun
c. tetap
d. tidak berhubungan

**9.** Paket Student yang lebih murah untuk mahasiswa merupakan contoh…
a. diskriminasi harga berdasarkan segmen
b. kartel
c. monopsoni
d. inflasi

**10.** Pendapatan tahunan yang diterima di muka, di akuntansi diakui…
a. seluruhnya pada bulan pertama
b. bertahap selama 12 bulan
c. tidak pernah diakui
d. sebagai utang pajak

## B. Isian singkat (11–20)

**11.** Berapa hemat biaya Premium tahunan dibanding 12 bulan bulanan?

**12.** Berapa persen hemat pada soal 11?

**13.** Jika harga Rp9.900 dan biaya variabel Rp1.200, berapa margin kontribusi?

**14.** Dengan biaya tetap Rp500.000 dan margin kontribusi Rp8.700, berapa BEP unit?

**15.** Dengan ARPU Rp9.900, margin 87,9%, dan churn 5%, berapa LTV?

**16.** Jika CAC Rp35.000, berapa rasio LTV/CAC?

**17.** Berapa bulan payback period-nya?

**18.** Jika ada 700 pelanggan Premium bulanan dan 200 pelanggan Student bulanan,
berapa MRR?

**19.** Berapa ARR dari MRR soal 18?

**20.** Jika 300 pelanggan Premium berpindah ke tahunan, berapa tambahan kas masuk
pada bulan itu dibandingkan jika mereka tetap bulanan?

## C. Esai / hitungan (21–30)

**21.** Jelaskan mengapa model freemium dapat meningkatkan laba, dan sebutkan
dua risikonya.

**22.** Hitung laba bulanan dengan skenario: 700 Premium, 200 Student, 100 Free.
Gunakan biaya variabel Rp1.200 per pelanggan berbayar dan biaya tetap Rp2.500.000.

**23.** Harga naik 10%, jumlah pembeli turun 15%. Hitung perubahan penerimaan dan
simpulkan apakah permintaan elastis.

**24.** Bedakan pendapatan (revenue) dan arus kas (cash flow) pada langganan tahunan.

**25.** Jelaskan peran webhook dalam pembayaran dan mengapa sistem harus
"idempotent".

**26.** Mengapa bisnis memberi diskon tahunan? Sebutkan tiga alasan ekonomis.

**27.** Seorang mahasiswa berlangganan 5 layanan masing-masing Rp50.000/bulan.
Hitung pengeluaran setahun dan jelaskan konsep biaya peluangnya.

**28.** Rancang strategi harga untuk mahasiswa yang sensitif harga tetapi
jumlahnya besar. Jelaskan kaitannya dengan elastisitas.

**29.** Sebutkan tiga risiko bisnis Whenly dan cara menguranginya.

**30.** Buat proyeksi sederhana 12 bulan: 100 pelanggan awal, tumbuh 15% per bulan,
churn 5% per bulan, ARPU Rp8.000. Hitung perkiraan pelanggan dan MRR pada bulan
ke-12 (boleh dengan asumsi tambahan yang wajar).

---

# KUNCI JAWABAN

## Pilihan ganda

1. **b** — jasa digital
2. **b** — biaya tetap dalam anggaran bulanan
3. **b** — jumlah diminta turun
4. **a** — diskon kuantitas / diskriminasi harga tingkat dua
5. **b** — memproses dan memverifikasi pembayaran
6. **b** — biaya tetap
7. **a** — Average Revenue Per User
8. **b** — turun (umur pelanggan lebih pendek)
9. **a** — diskriminasi harga berdasarkan segmen
10. **b** — bertahap 12 bulan (deferred revenue)

## Isian

11. `118.800 - 99.000 = Rp19.800`
12. `19.800 / 118.800 × 100% ≈ 16,7%`
13. `9.900 - 1.200 = Rp8.700`
14. `500.000 / 8.700 ≈ 57,5 → 58 pelanggan`
15. `9.900 × 0,879 / 0,05 ≈ Rp174.040`
16. `174.040 / 35.000 ≈ 4,97`
17. `35.000 / 8.700 ≈ 4,02 bulan`
18. `700×9.900 + 200×4.900 = 6.930.000 + 980.000 = Rp7.910.000`
19. `7.910.000 × 12 = Rp94.920.000`
20. Bulanan: `300 × 9.900 = Rp2.970.000`. Tahunan: `300 × 99.000 = Rp29.700.000`.
    Tambahan kas = **Rp26.730.000**. (Pendapatan yang diakui tetap Rp8.250 per
    pelanggan per bulan.)

## Esai (poin kunci)

**21. Freemium**
- Akuisisi murah: pengguna mencoba tanpa risiko, word of mouth.
- Konversi sebagian ke berbayar; biaya marginal melayani Free rendah.
- Risiko: banyak *free rider* (biaya server naik tanpa pendapatan), kanibalisasi
  paket berbayar, dan biaya dukungan meningkat.

**22. Laba**
```
Pendapatan = 700×9.900 + 200×4.900 = 7.910.000
Biaya variabel = 900 × 1.200 = 1.080.000
Margin kontribusi = 6.830.000
Laba = 6.830.000 - 2.500.000 = Rp4.330.000
```

**23. Elastisitas**
```
1,10 × 0,85 = 0,935 → penerimaan turun 6,5%
```
Permintaan **elastis** karena perubahan jumlah (%) lebih besar dari perubahan
harga (%). Menaikkan harga tidak tepat; lebih baik menahan harga atau menambah
nilai.

**24. Revenue vs cash flow**
- Kas: uang benar-benar masuk Januari Rp99.000.
- Pendapatan: diakui Rp8.250/bulan; sisa Rp90.750 menjadi kewajiban layanan
  (deferred revenue).
- Kas bisa tinggi tetapi laba bulan itu kecil; sebaliknya, kas bisa negatif
  walau pendapatan diakui.

**25. Webhook & idempotent**
- Webhook adalah notifikasi otomatis dari Midtrans bahwa status pembayaran berubah.
- Harus diverifikasi signature dan nominalnya agar tidak bisa dipalsukan.
- Idempotent: satu pesanan hanya boleh mengaktifkan satu keanggotaan. Jika webhook
  dikirim ulang, sistem mengenali status "sudah dibayar" dan tidak memperpanjang
  dua kali. Caranya: kunci unik pesanan + perubahan status bersyarat.

**26. Diskon tahunan**
1. Arus kas lebih awal (modal kerja).
2. Retensi lebih tinggi / churn lebih rendah.
3. Biaya transaksi dan penagihan lebih rendah (1× vs 12×).
Tambahan: mengurangi beban dukungan dan memudahkan perencanaan.

**27. Biaya peluang**
```
5 × 50.000 × 12 = Rp3.000.000/tahun
```
Biaya peluang = nilai alternatif terbaik yang dikorbankan, mis. uang pangkal,
kursus, atau tabungan darurat. Biaya peluang tidak selalu muncul di catatan
keuangan, tetapi memengaruhi kesejahteraan.

**28. Strategi mahasiswa**
- Tier Student dengan verifikasi (mencegah penyalahgunaan).
- Harga lebih rendah, volume lebih besar, margin per unit lebih kecil.
- Diskon tahunan dan bundling kampus.
- Karena permintaan mahasiswa elastis, penurunan harga dapat menaikkan penerimaan
  total; tetapi harus dijaga agar tidak mengkanibalisasi Premium.

**29. Risiko**
- Ketergantungan pihak ketiga (Supabase/Vercel/Midtrans) → mitigasi: cadangan,
  pemantauan, dokumentasi, siap migrasi.
- Kebocoran data → mitigasi: enkripsi, akses minimum, audit, patuh UU PDP.
- Kegagalan pembayaran/refund → mitigasi: verifikasi webhook, kebijakan refund
  jelas, rekonsiliasi harian.
- Persaingan → diferensiasi pada pengingat dan fokus pelajar Indonesia.

**30. Proyeksi (contoh)**
Asumsi: pertumbuhan kotor 15%/bulan, churn 5%/bulan.
```
Bulan 1  : 100
Bulan 2  : 100×1,15×0,95 = 109,25
Bulan n  : 100 × (1,15×0,95)^(n-1) = 100 × (1,0925)^(n-1)
Bulan 12 : 100 × 1,0925^11 ≈ 100 × 2,64 ≈ 264 pelanggan
MRR      : 264 × 8.000 ≈ Rp2.112.000
ARR      : ≈ Rp25.344.000
```
Angka ini proyeksi kasar; dalam presentasi sebutkan asumsinya secara terbuka.

---

# BAGIAN 5 — Pertanyaan yang mungkin ditanya guru Ekonomi

**1. "Apa masalah ekonomi yang diselesaikan aplikasi ini?"**
Kelangkaan waktu dan uang. Pengguna lupa tanggal langganan sehingga uang
terpotong tanpa disadari. Whenly menurunkan biaya informasi dan biaya peluang.

**2. "Siapa target pasarnya?"**
Pelajar dan mahasiswa Indonesia pengguna langganan digital, lalu pengguna umum
yang ingin mengontrol pengeluaran berulang.

**3. "Dari mana pendapatannya?"**
Freemium: paket Free, Student Rp4.900/bulan, Premium Rp9.900/bulan, dengan opsi
tahunan. Pendapatan berulang (MRR).

**4. "Kenapa ada paket gratis?"**
Untuk akuisisi dan efek jaringan. Biaya marginal pengguna gratis rendah, dan
sebagian akan konversi ke berbayar.

**5. "Apa biaya terbesar?"**
Pada prototipe hampir nol (paket gratis). Jika tumbuh: biaya server, email,
komisi pembayaran, dan akuisisi pengguna (CAC).

**6. "Kenapa harganya Rp9.900, bukan Rp50.000?"**
Menyesuaikan daya beli pelajar, menurunkan hambatan masuk, dan memanfaatkan
volume. Harga terlalu tinggi pada permintaan elastis justru menurunkan penerimaan.

**7. "Bagaimana kamu membuktikan pembayaran benar-benar terjadi?"**
Lewat webhook Midtrans yang diverifikasi signature SHA512 dan nominalnya, lalu
status disimpan di database. Tidak ada tombol "pembayaran berhasil" manual.

**8. "Apa itu sandbox?"**
Lingkungan uji dengan uang dan kartu palsu. Cocok untuk demonstrasi tanpa risiko.

**9. "Kenapa memakai Midtrans, bukan transfer langsung?"**
Midtrans menangani berbagai metode bayar, verifikasi, keamanan data kartu, dan
notifikasi otomatis. Transfer langsung sulit direkonsiliasi dan rawan fraud.

**10. "Bagaimana data pengguna dilindungi?"**
Password di-hash (bcrypt), sesi memakai cookie, akses database dibatasi, dan
data kartu tidak pernah disimpan. Untuk produksi perlu kebijakan privasi dan
kepatuhan UU PDP.

**11. "Apa kelemahan prototype ini?"**
Pembayaran berulang belum otomatis, notifikasi email butuh layanan pihak ketiga,
dan belum ada verifikasi mahasiswa resmi. Semua keterbatasan ditampilkan jujur
di aplikasi.

**12. "Apa rencana ke depan?"**
Penagihan berulang, integrasi verifikasi kampus, analitik prediktif, dan kanal
pengingat tambahan (WhatsApp/push).

---

# BAGIAN 6 — Tips presentasi

1. **Mulai dari masalah, bukan teknologi.** "Mahasiswa punya 5 langganan dan
   sering lupa tanggal potong." Baru setelah itu tunjukkan aplikasi.
2. **Tunjukkan satu alur utuh**: tambah langganan → lihat tagihan → dapat
   pengingat → upgrade paket → bayar di sandbox.
3. **Sebutkan angka.** "Premium Rp9.900/bulan, hemat 16,7% jika tahunan,
   BEP 58 pelanggan dengan asumsi biaya tetap Rp500.000."
4. **Jujur soal batasan.** Guru menghargai kejujuran: "Pembayaran masih sandbox,
   ini buktinya statusnya ditandai demo."
5. **Siapkan satu hitungan di papan** (BEP atau LTV) agar terlihat menguasai
   ekonomi, bukan hanya UI.

---

## Lampiran: peta istilah teknis ke ekonomi

| Teknis | Ekonomi |
| --- | --- |
| Database | Gudang persediaan informasi |
| API | Saluran distribusi jasa |
| Cron | Otomatisasi yang menurunkan biaya tenaga kerja |
| Webhook | Verifikasi transaksi (mengurangi risiko moral hazard) |
| Idempotent | Mencegah duplikasi biaya/transaksi |
| Sandbox | Simulasi sebelum produksi (mengurangi risiko) |
| Cache | Persediaan penyangga untuk mempercepat layanan |
