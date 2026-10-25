<div align="center">

# 🥚 Telur Asinnya Asin Nganenin

**Aplikasi pemesanan telur rumahan yang sederhana untuk pelanggan, lengkap untuk pengelola.**

Pesan tanpa membuat akun, pilih tanggal penerimaan, pantau status pesanan, dan kelola stok serta pembayaran dari satu dashboard.

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)

[Mulai Cepat](#-menjalankan-secara-lokal) · [Fitur](#-fitur-utama) · [Dokumentasi](#-dokumentasi) · [Keamanan](#-keamanan)

</div>

---

## ✨ Fitur utama

### Untuk pelanggan

- 🛒 Memesan telur tanpa registrasi akun.
- 🥚 Memilih jenis dan jumlah telur dengan harga yang jelas.
- 📅 Menentukan tanggal penerimaan pesanan.
- 📍 Memilih ambil di lokasi toko atau pengiriman GoSend.
- 💵 Membayar dengan COD atau checkout Midtrans.
- 🔎 Melihat status dan riwayat pesanan yang tersimpan di perangkat.
- 🔔 Menerima notifikasi web push ketika pesanan siap.

### Untuk pengelola

- 📋 Melihat dan memproses daftar pesanan.
- 📦 Mengelola stok siap jual dan batch stok mendatang.
- ✅ Menandai pesanan siap serta selesai.
- 💳 Memantau dan menyinkronkan status pembayaran.
- 📊 Melihat ringkasan pemasukan dan aktivitas toko.
- ⚙️ Mengatur lokasi pengambilan pesanan.
- 🔐 Mengakses dashboard melalui autentikasi admin yang aman.

## 🧰 Teknologi

| Bagian | Teknologi |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Antarmuka | React 19, TypeScript, CSS |
| Database | SQLite dan Prisma ORM |
| Validasi | Zod |
| Autentikasi | JWT (`jose`) dan `bcryptjs` |
| Pembayaran | Midtrans Snap dan webhook server-to-server |
| Peta | Leaflet |
| Notifikasi | Web Push / VAPID |
| Pengujian | Node Test Runner, Playwright, dan C8 |
| Kualitas kode | TypeScript dan Oxlint |

## 🚀 Menjalankan secara lokal

### Prasyarat

Pastikan perangkat sudah memiliki:

- [Node.js](https://nodejs.org/) versi 20 atau lebih baru
- npm
- Git

### Instalasi

```bash
git clone https://github.com/mosessatriyo23/AplikasiTelurAsin.git
cd AplikasiTelurAsin
npm install
```

Salin konfigurasi contoh menjadi konfigurasi lokal:

```bash
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# Linux atau macOS
cp .env.example .env
```

Isi nilai yang diperlukan di `.env`, lalu siapkan **database baru yang kosong**:

```bash
npx prisma migrate deploy
npx prisma generate
```

> [!NOTE]
> Pembuatan produk dan akun admin awal pada database baru perlu dilakukan operator setelah konfigurasi ditinjau. Migrasi tidak otomatis membuat akun admin; jangan menjalankan seed pada database existing.

Jalankan aplikasi:

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) untuk halaman pelanggan atau [http://localhost:3000/admin/login](http://localhost:3000/admin/login) untuk halaman pengelola.

> [!CAUTION]
> Perintah migrasi di atas hanya untuk database baru dan terisolasi. Jangan menjalankan `prisma migrate deploy`, `prisma migrate resolve`, `prisma db push`, maupun seed terhadap database lama yang belum ditinjau. Baca [panduan upgrade database existing](prisma/migrations/EXISTING_DATABASE_UPGRADE.md) terlebih dahulu.

## 🔧 Konfigurasi lingkungan

Gunakan `.env.example` sebagai acuan. Jangan pernah mengunggah `.env` atau nilai rahasia ke Git.

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Lokasi database SQLite |
| `ADMIN_SESSION_SECRET` | Rahasia sesi admin, minimal 32 karakter acak |
| `ADMIN_INITIAL_EMAIL` | Email admin awal untuk bootstrap database baru |
| `ADMIN_INITIAL_PASSWORD` | Kata sandi admin awal, minimal 12 karakter |
| `MIDTRANS_IS_PRODUCTION` | Gunakan `false` saat pengembangan atau Sandbox |
| `MIDTRANS_SERVER_KEY` | Server Key Midtrans; hanya digunakan di server |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Client Key Midtrans untuk checkout browser |
| `APP_URL` | Origin utama aplikasi dan callback server |
| `NEXT_PUBLIC_APP_URL` | Origin publik aplikasi |
| `ALLOWED_ORIGINS` | Origin tambahan yang diizinkan, dipisahkan koma |
| `VAPID_PUBLIC_KEY` | Public key untuk web push |
| `VAPID_PRIVATE_KEY` | Private key web push; wajib dirahasiakan |
| `VAPID_SUBJECT` | Kontak pemilik push, misalnya alamat email |

Buat pasangan VAPID satu kali dengan:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Validasi konfigurasi tanpa mencetak nilainya:

```bash
npx tsx scripts/validate-environment.ts
```

> Skrip validasi membaca environment proses dan tidak memuat `.env` secara otomatis.

## 📜 Perintah yang tersedia

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan server pengembangan |
| `npm run build` | Membuat build produksi |
| `npm start` | Menjalankan build produksi |
| `npm run typecheck` | Memeriksa tipe TypeScript |
| `npm run lint` | Memeriksa kualitas kode dengan Oxlint |
| `npm test` | Menjalankan unit test |
| `npm run test:integration` | Menjalankan integration test terisolasi |
| `npm run test:e2e` | Menjalankan end-to-end test Playwright |
| `npm run test:coverage` | Membuat laporan cakupan pengujian |
| `npm run quality` | Menjalankan seluruh pemeriksaan kualitas |
| `npm run admin:set-login` | Mengganti login admin melalui stdin pribadi |

## 🗂️ Struktur proyek

```text
AplikasiTelurAsin/
├── app/                 # Halaman dan API routes Next.js
│   ├── admin/           # Dashboard pengelola
│   ├── api/             # Endpoint aplikasi
│   ├── pesan/           # Alur pembuatan pesanan
│   └── pesanan/         # Status dan riwayat pesanan
├── components/          # Komponen antarmuka
├── docs/                # Panduan operasional dan keputusan desain
├── lib/                 # Logika bisnis, autentikasi, stok, dan pembayaran
├── prisma/              # Skema serta migrasi database
├── public/              # Ikon PWA dan service worker
├── scripts/             # Skrip operasional
└── tests/               # Unit, integration, dan end-to-end test
```

## 🔔 Notifikasi pesanan

Pelanggan dapat berlangganan notifikasi dari halaman status pesanan. Ketika seluruh item siap dan persyaratan pembayaran terpenuhi, pengelola dapat menandai pesanan sebagai **siap**. Sistem kemudian mencoba mengirim notifikasi web push ke perangkat yang terdaftar.

- Token pesanan berfungsi sebagai kredensial akses dan tidak boleh dibagikan secara publik.
- Maksimal lima endpoint HTTPS unik dapat tersimpan untuk satu pesanan.
- Subscription yang menerima notifikasi tidak dikirim ulang.
- Endpoint push yang sudah tidak aktif (`404`/`410`) dibersihkan otomatis.
- Penerimaan oleh layanan push bukan jaminan notifikasi tampil di perangkat.

## 🛡️ Keamanan

- `.env`, database lokal, hasil build, laporan tes, dan kredensial dikecualikan dari Git.
- Rahasia sesi admin wajib berisi minimal 32 karakter acak.
- Kata sandi admin disimpan dalam bentuk hash dan minimal terdiri dari 12 karakter.
- Cookie sesi menggunakan `HttpOnly`, `SameSite=Strict`, dan `Secure` di production.
- Pembayaran diverifikasi melalui komunikasi server-to-server dan signature Midtrans.
- Respons publik tidak mengungkap nama, nomor telepon, alamat, atau koordinat pelanggan.
- Token pesanan, endpoint push, dan data pelanggan harus diperlakukan sebagai data sensitif.
- Gunakan Midtrans Sandbox selama pengembangan dan uji callback sebelum beralih ke Production.

Untuk mengganti login admin secara aman, ikuti [panduan penggantian login](docs/GANTI-LOGIN-ADMIN.md). Jangan menaruh kata sandi pada argumen CLI, riwayat shell, dokumentasi, atau commit Git.

## 📚 Dokumentasi

- [Runbook operasional](docs/RUNBOOK.md)
- [Panduan penggunaan untuk pengelola](docs/PANDUAN-IBU.md)
- [Konfigurasi Midtrans Sandbox](docs/MIDTRANS-SANDBOX.md)
- [Status pembayaran dan pemenuhan](docs/PAYMENT-FULFILLMENT-STATES.md)
- [Integrasi backend Midtrans](MIDTRANS-BACKEND.md)
- [Panduan upgrade database existing](prisma/migrations/EXISTING_DATABASE_UPGRADE.md)
- [Keputusan desain](docs/KEPUTUSAN-DESAIN.md)

## ✅ Pemeriksaan sebelum deployment

```bash
npm run quality
```

Selain pemeriksaan otomatis, operator tetap perlu menguji secara manual:

- checkout Midtrans Sandbox dan webhook dari domain deployment;
- callback serta CSP pada HTTPS;
- notifikasi push pada perangkat yang ditargetkan;
- backup dan restore database;
- migrasi menggunakan salinan database yang dapat dibuang;
- alur stok, pembatalan, refund, dan penyelesaian pesanan.

---

<div align="center">

Dibuat untuk membantu usaha telur rumahan menerima dan mengelola pesanan dengan lebih mudah. 🥚

</div>
