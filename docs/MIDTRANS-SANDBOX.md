# Menyiapkan pembayaran uji Midtrans

Sandbox adalah lingkungan percobaan, bukan transaksi uang sungguhan.

## Langkah pemilik toko

1. Buat akun Midtrans melalui situs resmi https://midtrans.com/.
2. Masuk Merchant Administration Portal dan pilih lingkungan **Sandbox**.
3. Temukan bagian Access Keys / kunci API. Nama menu dapat berubah.
4. Salin Server Key dan Client Key Sandbox ke `.env` lokal. Jangan kirim kunci melalui percakapan, screenshot publik, atau Git.
5. Pastikan `MIDTRANS_IS_PRODUCTION="false"` selama pengujian.
6. Mulai ulang aplikasi setelah mengubah `.env`.

## Webhook / notifikasi pembayaran

Midtrans perlu menghubungi endpoint server aplikasi. `localhost` tidak dapat diakses oleh Midtrans. Saat pengujian pembayaran, gunakan deployment uji atau tunnel HTTPS terpercaya, kemudian atur URL notifikasi menjadi:

`https://alamat-uji-anda/api/midtrans/notification`

Atur `NEXT_PUBLIC_APP_URL` ke alamat aplikasi uji yang sama. Jangan membagikan dashboard admin melalui tunnel tanpa kata sandi yang aman.

## Skenario yang wajib diuji sebelum produksi

- Buat pesanan COD; selesaikan tanpa bayar: pembayaran harus tetap belum dibayar.
- Klik Sudah Dibayar untuk COD dua kali: total pemasukan tidak boleh berlipat.
- Bayar pesanan Bank/QRIS memakai simulator Sandbox resmi.
- Tutup halaman setelah membayar: webhook tetap harus mencatat lunas.
- Pesan saat stok habis: peringatan terlihat, pembayaran diizinkan, tanggal tidak dijanjikan pasti.
- Kirim notifikasi ganda: tidak boleh melipatgandakan pembayaran atau pengurangan stok.
- Pembayaran gagal atau kedaluwarsa tidak boleh ditandai lunas.
- Signature palsu atau nominal berbeda harus ditolak.

Jangan gunakan bukti layar “berhasil” sebagai dasar otomatis untuk menandai lunas. Gunakan verifikasi server.
