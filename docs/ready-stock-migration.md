# Ready-stock deployment and reconciliation

## Migration status

The checked-in Prisma migration is a **fresh-database baseline only**. Fresh deployments use `npx prisma migrate deploy`; running it twice is safe and is exercised against disposable SQLite files. **Existing-database upgrade is BLOCKED pending operator review of a schema-only legacy dump.** See `prisma/migrations/EXISTING_DATABASE_UPGRADE.md`. Never use `prisma db push` or mark the baseline resolved on production. The repository's `prisma/dev.db` is not an upgrade fixture and must never be used by migration tests.

## Existing database procedure (only after a reviewed delta exists)

1. Stop every API, worker, cron, and other writer. Back up the **entire SQLite DB** with SQLite's online backup API/`.backup` (or correctly capture DB, WAL, and SHM), store it separately, and test restoration.
2. Verify the deployed application revision and schema against the approved schema-only legacy fixture. If they differ, stop.
3. Apply the reviewed versioned delta to a disposable restored copy first. Require `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, row-count checks, and application smoke tests. A failed migration must roll back completely.
4. Apply it in the maintenance window. Legacy fulfillment remains `REVIEW`, `OrderItem.readyAt` remains nullable, and `Product.readyStockReconciled` remains false. Do not resume writers yet.
5. Reconcile stock using the separately reviewed stock manifest and `scripts/reconcile-ready-stock.ts`. Legacy `Product.stock` is net stock: existing reservations were already deducted. Never infer ready/pending quantities from `availableAt`, and never deduct outstanding orders again.
6. Create a readiness manifest covering exactly all unknown order items: `{ "items": [{ "id": "...", "productId": "...", "orderCreatedAt": "2026-10-23T00:00:00.000Z", "readyDate": "2026-10-25" }] }`. IDs/product/order timestamps are optimistic-concurrency guards. `readyDate` is the WIB calendar date supported by reviewed records; do not infer it from today's batch, requested date, or creation date.
7. Set an explicit SQLite URL and dry-run: `DATABASE_URL=file:/absolute/path/to/copy.db npx tsx scripts/backfill-order-item-readiness.ts manifest.json`. The command checks exact coverage and creates a private local snapshot; this snapshot is **not** a database backup and contains identifiers.
8. After review, run the same command with `--apply`. It is transactional and safely replayable only when the same manifest exactly matches already-written values. Any unknown extra item, changed identity/timestamp, or conflicting readiness aborts without updates. Output intentionally never prints row/customer data.
9. Verify all reconciliation and fulfillment review queues, then resume traffic. Preserve approvals, hashes, migration output, integrity results, and rollback evidence.

Do not run `scripts/migrate-two-day-stock.ts`; it mutates legacy dates using obsolete assumptions. If historical evidence is insufficient, keep nullable fields and `REVIEW`, and stop for operator adjudication.
