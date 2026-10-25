# Ganti username dan kata sandi admin (pengujian lokal)

Login memakai **username**, bukan email. Untuk mengganti akun yang sudah ada, buka PowerShell di folder proyek dan jalankan:

```powershell
cd D:\AplikasiTelurAsin
$u = Read-Host 'Username baru (3-40 karakter)'
$s = Read-Host 'Frasa kata sandi baru (minimal 12 karakter)' -AsSecureString
$p = [System.Net.NetworkCredential]::new('', $s).Password
@{ username = $u; password = $p } | ConvertTo-Json -Compress | npm run admin:set-login
Remove-Variable p,s -ErrorAction SilentlyContinue
```

Perintah ini memperbarui satu akun admin yang sudah ada. Password tidak perlu dikirim lewat chat atau ditulis di `.env`. Kata sandi minimal 12 karakter karena dashboard dapat diakses lewat tunnel publik. Gunakan frasa yang mudah diingat, bukan `123456`.

**Jangan menjalankan `npm run db:seed` untuk mengganti login**: seed hanya membuat akun pertama dan memperbarui katalog produk; login yang telah diatur tidak akan diubah.

Catatan: sesi yang sudah login dengan cookie lama masih bisa aktif hingga 8 jam. Tekan **Keluar** pada dashboard dan tutup sesi perangkat lain. Pengaturan sesi aktif akan diperketat sebelum produksi.
