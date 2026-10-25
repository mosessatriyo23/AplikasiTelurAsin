# State pembayaran, reservasi, dan fulfillment

Ketiga konsep ini tidak boleh disimpulkan dari satu timestamp.

## Kebijakan reservasi

- Order baru mengurangi **stok siap** secara atomik. Midtrans tanpa checkout memiliki `reservationExpiresAt` 24 jam.
- COD (disetujui pemilik 25 Oktober 2026): deadline H-1 pukul 18.00 WIB dari requestedDate, atau 24 jam sejak dibuat—mana yang lebih akhir. COD `PAID` tidak kedaluwarsa.
- Midtrans yang belum pernah memulai checkout dapat dilepas setelah 24 jam.
- Midtrans yang pernah memulai permintaan Snap hanya boleh dilepas setelah status authoritative Midtrans menyatakan terminal. Error jaringan/404/unknown gagal secara tertutup dan stok tetap ditahan untuk tinjauan.
- `stockRestoredAt`/`stockRestored` adalah klaim compare-and-set; worker/webhook bersamaan hanya boleh mengembalikan stok sekali.
- Settlement terlambat sesudah stok dikembalikan menjadi `PAID + REVIEW + waitlisted`; tidak otomatis mengambil stok sehingga tidak menyebabkan stok negatif.

## Tabel transisi utama

| Sumber | Kondisi awal | Hasil payment | Hasil fulfillment | Stok |
|---|---|---|---|---|
| Admin COD paid | PENDING + RESERVED | PAID | tetap RESERVED | tetap dicadangkan |
| Midtrans settlement/capture accepted | PENDING + reserved | PAID | tetap RESERVED | tetap dicadangkan |
| Expire/cancel/deny/failure | PENDING normal | CANCELLED/FAILED | CANCELLED | kembali tepat sekali |
| Terminal API pada checkout ambigu/ditolak | AMBIGUOUS/DEFINITIVE_FAILURE | tetap PENDING sampai admin | REVIEW + TERMINAL_CONFIRMED | tetap ditahan |
| Resolusi admin setelah API terminal baru | TERMINAL_CONFIRMED | CANCELLED/FAILED | CANCELLED + RESOLVED | kembali tepat sekali |
| Settlement terlambat | stockRestored | PAID | REVIEW | tidak dikurangi otomatis |
| Partial refund/chargeback | PAID | PAID | REVIEW | tidak otomatis kembali |
| Full refund/chargeback | PAID | CANCELLED | REFUNDED | tidak otomatis kembali; audit fisik diperlukan |
| Admin ready | paid bila Midtrans, reservasi valid | tidak berubah | READY | tetap dicadangkan |
| Admin complete | READY valid | tidak berubah | COMPLETED | dianggap keluar secara fisik |

### Tabel transisi payment Midtrans

Tabel berikut eksplisit untuk respons non-refund yang sudah terautentikasi. Baris adalah status tersimpan dan kolom adalah hasil gateway.

| Status tersimpan | settlement/capture accepted (`PAID`) | failure (`FAILED`) | expire/cancel/deny (`CANCELLED`) |
|---|---|---|---|
| PENDING | PAID | FAILED | CANCELLED |
| PAID | PAID | PAID | PAID |
| FAILED | PAID | FAILED | CANCELLED |
| CANCELLED biasa | PAID | FAILED | CANCELLED |
| CANCELLED + full refund + REFUNDED | **CANCELLED + REFUNDED** | **CANCELLED + REFUNDED** | **CANCELLED + REFUNDED** |

Full refund/chargeback terverifikasi adalah terminal (absorbing): `refundedAmount=total`, `paymentStatus=CANCELLED`, dan `fulfillmentState=REFUNDED` tidak boleh dibalik oleh respons settlement/capture yang terlambat. Partial refund tetap `PAID + REVIEW`, dan jumlah refund hanya boleh bergerak naik. Karena ringkasan pendapatan menghitung order `PAID` dikurangi refund, full refund tidak menyumbang pendapatan.

Checkout ambigu dicatat dan diekskalasi di dashboard oleh worker; hanya admin login yang dapat mencoba resolusi. Aksi resolusi selalu meminta status API Midtrans yang baru. Kegagalan jaringan atau 404 menahan stok. Status gateway terminal adalah bukti yang disetujui pemilik, bukan klaim browser.

Refund, cancellation, restoration, dan REVIEW menghapus `readyNotifiedAt`. UI hanya menampilkan siap bila `fulfillmentState=READY`, timestamp ada, reservasi belum dikembalikan, dan order tidak waitlist/cancelled.

Semua status gateway diproses dari verifikasi server-to-server. Callback browser tidak berwenang mengubah pembayaran. Event transisi dicatat dengan kode terkendali tanpa payload gateway, token, kunci, atau PII.
