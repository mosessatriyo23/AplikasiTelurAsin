# Telur Asinnya Asin Nganenin

Aplikasi pemesanan telur yang ramah pengguna dan dashboard sederhana untuk pengelola.

## Menjalankan secara lokal

1. Salin `.env.example` menjadi `.env` dan ganti nilai rahasianya.
2. Jalankan `npm install`.
3. **Hanya untuk database baru kosong yang terisolasi:** tinjau `prisma/migrations`, lalu `npx prisma migrate deploy` dan `npx prisma generate`. Jangan jalankan pada `prisma/dev.db` existing; upgrade existing masih menunggu review (lihat `prisma/migrations/EXISTING_DATABASE_UPGRADE.md`).
4. Jangan seed database existing. Bootstrap produk/admin pada database baru harus dilakukan operator setelah review konfigurasi.
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000`.

## Notifikasi web push dan status siap

- Generate pasangan VAPID satu kali: `node -e "console.log(require('web-push').generateVAPIDKeys())"`, lalu set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` (misalnya `mailto:admin@example.com`) di `.env`. Jangan bocorkan private key.
- Gunakan migration versi yang telah ditinjau dan backup terverifikasi; jangan gunakan `db:push` pada database existing/produksi. Enum `DELIVERY` tetap untuk pesanan historis; pesanan baru hanya `PICKUP`/`GOSEND` tanpa alamat pembeli maupun tip.
- `GET /api/push/config` mengembalikan `{ publicKey }`. `POST /api/orders/[token]/push-subscription` menerima `{ action: "subscribe", subscription: { endpoint, keys: { p256dh, auth } } }` atau `{ action: "unsubscribe", endpoint }`. Token pesanan adalah otorisasi; browser harus mengirim Origin yang diizinkan. Maksimal lima endpoint HTTPS unik per pesanan.
- Admin memanggil `POST /api/admin/orders/[id]/ready` (cookie sesi + Origin) sebelum `POST /api/admin/orders/[id]/complete`. Semua item harus siap dan pembayaran Midtrans harus PAID (COD boleh). Respons berisi `readyNotifiedAt` dan `notification: { sent, failed, noSubscriptions }`; pemanggilan berikutnya hanya mencoba subscription yang belum diterima layanan push; subscription sukses tidak dikirim ganda. Payload push berupa `{ title, body, url: "/pesanan/<token>" }`. Push 404/410 dibersihkan; kegagalan lain dihitung dan dicatat. Kegagalan dapat dicoba kembali; penerimaan layanan push bukan bukti tampil di perangkat. Status READY dibatalkan setelah cancellation/refund/review/restoration.

## Keamanan

- Jangan memasukkan `.env` ke Git.
- Ganti kata sandi admin awal sebelum digunakan.
- Midtrans memakai hosted checkout dengan verifikasi server; mulai dengan Sandbox, jangan gunakan kunci Production saat pengembangan. Browser checkout/webhook eksternal tetap harus diuji operator sebelum live.
- Username admin: lowercase ASCII `a-z`, angka, `.`, `_`, `-`, 3–40 karakter tanpa spasi; kata sandi minimal 12 karakter. Gunakan `npm run admin:set-login` via stdin JSON pribadi, bukan argumen CLI. Skrip hanya untuk tepat satu admin.
- Validasi konfigurasi tanpa mencetak nilai: `npx tsx scripts/validate-environment.ts` (variabel harus dimuat ke environment shell terlebih dahulu; skrip tidak memuat `.env` otomatis).
- Lihat [runbook operator](docs/RUNBOOK.md) untuk backup/restore terverifikasi, migrasi/rollback, rekonsiliasi stok/tanggal berbasis manifest, worker, dan retensi PII. Order baru dengan stok siap kurang ditolak HTTP 409 sebelum order/reservasi/checkout dibuat; alokasi legacy waitlist adalah operasi terpisah yang membutuhkan pemeriksaan manual. `db:push`/seed bukan prosedur upgrade produksi. Kebijakan 24 jam untuk reservasi unpaid perlu persetujuan pemilik.
