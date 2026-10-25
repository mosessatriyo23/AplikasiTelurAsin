# Panduan singkat pengelola

## Masuk dashboard

Buka `/admin/login`, isi email dan kata sandi pengelola. Jangan membagikan kata sandi kepada pembeli.

## Menerima pesanan

1. Buka daftar pesanan. Dashboard menyegarkan data otomatis setiap 30 detik.
2. Periksa tanggal terima, jumlah, dan cara pengambilan.
3. Jika perlu menghubungi pembeli, tekan nomor WhatsApp.
4. Pesanan bertanda **Menunggu stok** belum memiliki kepastian tanggal. Pastikan kembali setelah stok tersedia.

## Mencatat stok

1. Buka bagian **Stok telur**.
2. Pilih jenis telur, isi jumlah dan tanggal stok masuk.
3. Tekan **Tambah stok**.

Telur bebek mentah siap pada tanggal masuk. Telur asin mentah dan matang siap dua hari setelah tanggal masuk. Stok siap jual dan stok dalam pembuatan ditampilkan terpisah. Stok siap yang lama tetap dapat dijual saat produksi baru ditambahkan. Jika stok siap benar-benar habis, pembeli tidak dapat memesan produk tersebut sampai batch berikutnya siap.

## Mencatat pembayaran COD

1. Terima uang dari pembeli terlebih dahulu.
2. Tekan **Sudah dibayar** pada pesanan yang benar.
3. Baca konfirmasi lalu setujui.

Jangan menekan tombol ini hanya karena pesanan sudah dibuat. Pembayaran Bank/QRIS dicatat otomatis setelah server mendapatkan konfirmasi Midtrans, bukan lewat tombol COD.

## Menyelesaikan pesanan

Tekan **Pesanan selesai** setelah telur sudah diserahkan atau diantar. Tombol ini tidak sama dengan pencatatan uang. Pesanan COD boleh sudah diserahkan tetapi belum dibayar; pastikan tetap menagih dan mencatat pembayarannya.

## Masih tahap uji

Bank/QRIS menggunakan lingkungan Sandbox. Jangan meminta pembeli membayar uang sungguhan sampai integrasi produksi, stok, dan pengamanan sudah diuji. Alamat lokasi pengambilan akan ditambahkan kemudian.
