# Hasil perbaikan dan verifikasi 23 Oktober 2026

## Perlindungan database

Database asli `prisma/dev.db` tidak dimigrasi, di-seed, di-backfill, atau direkonsiliasi. Server produksi lokal tidak dinyalakan kembali karena kode sekarang memerlukan schema baru.

SHA256 baseline dan hasil pemeriksaan akhir sama:
`0B299E7DA9D9E1AA6697496D2B0F648031D56C27C52BFE2E1F1BC2B1305196C5`

Integration memakai file SQLite OS-temp dengan guard dan `DATABASE_URL` override; migration hanya diterapkan ke file sementara. E2E menyalin source ke workspace sementara tanpa `.env`/database asli, mock API browser, dan menggunakan path database terisolasi. Tidak ada pembayaran nyata/Sandbox atau push perangkat dipanggil.

## Command terverifikasi

- `npm run typecheck`: lulus.
- `npm run lint`: lulus menggunakan oxlint; lint terpisah dari build.
- `npm test`: 21 test lulus.
- `npm run test:integration`: 16 test lulus (termasuk parent test), 0 gagal.
- `npm run test:e2e`: 6 test Chromium lulus dengan API mocked.
- `npm run test:coverage`: lulus; scope eksplisit semua `lib/**/*.ts` dan `app/api/**/*.ts`; unit-only line coverage 23,63%. Ini bukan coverage gabungan integration/E2E dan bukan coverage yang cukup untuk mengklaim semua jalur teruji.
- `npm run build`: lulus; typecheck aktif, lint dijalankan terpisah.
- `npx prisma validate`: lulus.
- `npm audit`: 0 vulnerability.

## File implementasi

Backend: `lib/rate-limit.ts`, `lib/reservation.ts`, `lib/payment-sync.ts`, `lib/payment-fulfillment.ts`, `lib/orders.ts`, `lib/midtrans.ts`, `lib/stock-allocation.ts`, `lib/push-delivery.ts`, `lib/api.ts`; routes login/orders/checkout/order status/webhook/admin paid-ready-complete-sync/summary/orders; `prisma/schema.prisma`.

Frontend: `app/pesan/OrderForm.tsx`, `app/pesanan/HistoryList.tsx`, `app/pesanan/[token]/page.tsx`, storefront/admin page wrappers dan CSS, `components/AdminShell.tsx`, `AdminData.tsx`, `StoreHeader.tsx`, `LocationMap.tsx`, `StoreLocationCard.tsx`, `PaymentPanel.tsx`, `OrderReadyStatus.tsx`; `lib/format.ts`, `lib/order-status.ts`.

Operasional: script expiry/sync/environment/admin/backfill/reconciliation/test runners, `next.config.ts`, `package.json`, lockfile, `playwright.config.ts`, CI `.github/workflows/quality.yml`, regression tests unit/integration/E2E, README dan runbook.

Migration belum diterapkan pada database asli: `prisma/migrations/20261023000000_production_safety_baseline/migration.sql` (fresh DB only), `migration_lock.toml`. Upgrade existing masih BLOCKED; baca `prisma/migrations/EXISTING_DATABASE_UPGRADE.md`.

## Risiko dan pekerjaan yang belum dibuktikan

1. **Belum izin launch produksi**: schema upgrade existing dan review data historis belum dilakukan. Jangan jalankan baseline CREATE TABLE terhadap database existing.
2. Reservasi unpaid 24 jam (termasuk COD) memerlukan persetujuan pemilik. Pickup lebih jauh memerlukan pembayaran/konfirmasi sebelum expiry. Snap ambigu tetap ditahan sampai authoritative terminal; operator harus menyelesaikan backlog. Ini sengaja fail-closed, bukan janji semua reservasi akan lepas otomatis.
3. Refund tidak otomatis restock fisik: menjadi REFUNDED/REVIEW, readiness dicabut, operator menilai telur benar-benar kembali sebelum menambah stok.
4. Rate limit mengurangi abuse tetapi bukan identitas terverifikasi. Serangan terdistribusi dan order palsu terkoordinasi masih memerlukan edge controls/monitoring. Shared fallback dapat memblokir pengguna lain; trusted identity header hanya aman di ingress yang menghapus header palsu dan menutup akses langsung origin.
5. SQLite hanya didukung satu file persisten bersama. Multi-instance dengan salinan SQLite berbeda tidak didukung.
6. CSP source policy diuji statis dan UI mocked di Chromium. Checkout Midtrans aktual, semua metode pembayaran, callback domain, Safari/iPhone/Android, CSP live, dan push perangkat belum diuji pada fase ini.
7. Backup restore pelanggan belum dilakukan; test rollback hanya pada database sintetis.
8. Retensi PII butuh angka kebijakan pemilik/hukum; runbook menetapkan kewajiban, belum ada job penghapusan otomatis.
9. Pagination API tersedia; UI menggabungkan halaman. Ini menghindari order hilang dari batas 200 tetapi bukan virtualized pagination untuk volume sangat besar.
10. CI workflow disiapkan tetapi belum dijalankan pada layanan CI remote.
