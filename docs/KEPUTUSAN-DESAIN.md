# Checkpoint: fondasi dan tampilan awal

## Keputusan yang sudah dikonfirmasi

- Nama: Telur Asinnya Asin Nganenin.
- Telur bebek mentah Rp2.000/butir; telur bebek mentah asin Rp2.500/butir; telur bebek matang asin Rp3.000/butir.
- Pemesanan tanpa akun; nama lengkap, WhatsApp, tanggal terima wajib; alamat wajib jika diantar.
- Opsi baru: ambil di toko atau pembeli memesan GoSend sendiri; keduanya mengambil telur dari toko. Tidak meminta alamat dan titik tujuan pembeli. Ongkir GoSend dibayar pembeli di Gojek dan bukan bagian dari pembayaran telur.
- Bayar saat menerima atau bank/QRIS via Midtrans.
- Notifikasi hanya di dashboard; tidak ada status produksi.
- Stok kosong boleh menerima pesanan berikutnya.

## Interpretasi yang harus dikonfirmasi

Telur bebek mentah langsung siap pada tanggal stok masuk. Telur asin mentah dan telur asin matang siap dua hari setelah tanggal stok masuk. Stok siap jual dipisahkan dari batch yang masih dalam pembuatan. Telur bebek mentah siap pada tanggal masuk; kedua jenis telur asin siap dua hari setelah tanggal masuk. Selama stok siap masih tersedia, penjualan tetap berjalan walaupun ada produksi baru. Jika stok siap habis, produk dibekukan: pembeli tidak dapat memesan atau membayar dan melihat keterangan “Sedang tahap pembuatan”. Pesanan lama yang sudah terlanjur masuk daftar tunggu tidak dihapus.

## Implementasi tahap awal

- Beranda, formulir empat bagian, rincian pesanan dengan tautan acak.
- Login admin, ringkasan, daftar pesanan, filter tanggal dan daftar tunggu, tambah stok.
- Penyimpanan SQLite lokal via Prisma; harga dihitung di server.
- Pembayaran Midtrans belum aktif; pilihan bank/QRIS ditampilkan nonaktif untuk transaksi.

## Belum untuk produksi

- Akun dan kunci Midtrans Sandbox belum tersedia; alur integrasi disiapkan tetapi belum dapat menerima pembayaran.
- Pencatatan pembayaran COD dibuat terpisah dari penyelesaian pesanan.
- Catat pesanan dari dashboard, pengaturan profil/alamat/harga dan ukuran huruf.
- Notifikasi dibaca/belum dibaca, riwayat pemberitahuan.
- Laporan pemasukan terbayar dan ekspor, lupa sandi admin.
- Batas laju, pemulihan cadangan, monitoring, pengujian perangkat dan uji aksesibilitas.
- Alamat pengambilan belum diberikan oleh pemilik.

Tidak boleh menganggap penjualan tercatat sebagai uang yang sudah diterima. Tidak boleh menganggap pesanan selesai sebagai otomatis lunas.
