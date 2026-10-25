# Midtrans backend integration notes

## Contract for the UI

- `POST /api/orders` validates Midtrans configuration **before** saving a MIDTRANS order. Unconfigured returns HTTP 503, no reservation/order is created. Successful response remains `{ order }` (201).
- After creating a MIDTRANS order, call `POST /api/checkout` with `{ "token": order.token }`. Returns `{ order, snapToken, redirectUrl }`; open Snap with the token or navigate to the redirect URL. Retain the order token even if checkout fails so retry never creates another order.
- The public token is a 256-bit bearer credential, NOT an order number. Do not expose it to analytics/logs or third-party referrers. Public responses deliberately omit phone, address, and customer name. Snap payload also omits customer PII.
- A checkout in progress returns 409; retry shortly. COD, paid, and ended payments cannot start checkout.
- Waitlisted MIDTRANS orders **are allowed to pay**. UI must warn that payment does not guarantee stock/date and fulfillment needs admin confirmation.
- `POST /api/admin/orders/:id/paid` is authenticated/origin-checked and only confirms COD receipt. Completion no longer marks COD paid. UI should provide a separate explicit payment-confirmation action.

## Configuration/deployment (main session owns README/.env.example)

Use `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION=false` (default), and `NEXT_PUBLIC_APP_URL`. Both keys and base URL must be nonempty. Production deployments (`NODE_ENV=production` or live Midtrans mode) require an HTTPS app URL, including when using sandbox. Public env changes require rebuilding Next.js. Never expose the server key.

Configure Midtrans's payment notification URL to `https://<host>/api/midtrans/notification`. The server verifies SHA512 and independently fetches authenticated `/v2/:orderNumber/status`; browser callbacks never confirm payment. Settlement and capture with fraud `accept` are the only paid states. Refunds/chargebacks reverse revenue; verified partial refunds subtract the confirmed refund amount. Missing/invalid partial-refund totals are rejected for manual reconciliation rather than guessing.

Run `npx prisma db push` and `npx prisma generate` after stopping dev servers that hold Prisma's Windows engine DLL open. Added fields: `midtransTransactionId`, `snapToken`, `snapRedirectUrl`, `checkoutStartedAt`, `stockRestored`, `refundedAmount`.

## Operational/security caveats

- Fixed unique order number is reused on every Snap attempt; a database claim serializes concurrent checkout calls and completed Snap credentials are cached. This prevents duplicate charges on retries. If Midtrans accepted creation but the response/cache write was lost, its duplicate-order rejection must be reconciled manually in the dashboard; the backend deliberately never invents a new transaction/order ID and risks a second charge. Retry alone cannot recover a lost Snap token because Midtrans's status API does not return it.
- Failed/expired/cancelled unpaid orders release reservations once. Waitlisted orders never decrement stock until completion; late settlement after release goes to waitlist rather than making stock negative. Refunded completed orders do not automatically put shipped eggs back in inventory.
- Unpaid reservations need an operational expiry/reconciliation job if no webhook ever arrives (e.g. checkout was never opened); no automatic sweep is included.
- Deploy behind rate limiting for order creation/checkout/webhooks and enforce request size limits. Public token possession is the authorization boundary; do not share order URLs publicly.
- Notification/status errors are logged and return non-2xx so Midtrans can retry. No real credentials were used during implementation; live sandbox API/e2e delivery remains to be verified.

## Validation performed

`npm test`: 4 passing tests. `npx tsc --noEmit`: passes. `npm run build`: compile/typecheck passes, but page-data collection fails with `no direct app page entry found for /_not-found` in the concurrently edited workspace. Prisma generate/db push encounters a Windows engine DLL rename lock; database reports already in sync. Stop the active Next.js process and rerun generation/build.
