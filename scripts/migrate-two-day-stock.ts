// Disabled: the old conversion inferred arrival dates from legacy availability,
// which is not reliable evidence and could shift dates twice after partial failure.
// Use scripts/reconcile-ready-stock.ts with a reviewed physical-stock manifest.
console.error("Migrasi tanggal otomatis dinonaktifkan. Jangan menebak tanggal historis; gunakan manifest stok yang ditinjau. Lihat docs/RUNBOOK.md.");
process.exitCode = 1;
export {};
