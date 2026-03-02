# Shopify Integration Plan

Jose Madrid Salsa now delegates order management, fulfillment, and inventory synchronization to Shopify. The Next.js storefront remains the customer-facing experience, but all back-office operations (shipping events, cancellations, tracking numbers, and status changes) flow through Shopify's Admin API and webhook platform.

## Architecture Overview

1. **Next.js Storefront** – collects orders/payments (Stripe) and stores transactional data in Postgres/Prisma.
2. **Shopify Admin** – acts as the system of record for fulfillment, shipping labels, inventory adjustments, and order status management.
3. **Sync + Webhooks** – `lib/shopify` contains the client, sync helpers, and webhook utilities that keep Prisma orders aligned with Shopify orders.

```
Checkout (Next.js)
  → Prisma order created
  → queueShopifySync(order.id)
  → Shopify Admin order created via Admin API

Shopify updates (paid, fulfilled, cancelled)
  → POST /api/webhooks/shopify
  → Prisma order/payment/tracking updated
```

## Environment Variables

Add the following to `.env.local` (and deploy targets):

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxx # Admin API access token
SHOPIFY_API_VERSION=2024-10       # Optional override, defaults to 2024-10
SHOPIFY_WEBHOOK_SECRET=app-shared-secret

# Optional, used for “View in Shopify” links inside the admin UI
NEXT_PUBLIC_SHOPIFY_ADMIN_URL=https://your-store.myshopify.com/admin
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
```

After changing environment variables run `npm run db:generate` to refresh the Prisma client.

## Database Additions

`prisma/migrations/20250216090000_shopify_integration` introduces Shopify metadata on the `Order` model:

- `shopifyOrderId`, `shopifyOrderName` – reference to the Admin order.
- `shopifyFinancialStatus`, `shopifyFulfillmentStatus` – raw Shopify status mirrors.
- `shopifySyncedAt`, `shopifySyncError` – diagnostics for background sync jobs.

These fields are automatically populated during sync/webhook execution and exposed to the admin UI for troubleshooting.

## Sync Flow (Next.js → Shopify)

- `lib/shopify/client.ts` transforms Prisma orders into Shopify order payloads and wraps Admin API calls.
- `lib/shopify/sync.ts` exports `queueShopifySync(orderId)` which is invoked after checkout/gift certificate purchases.
- `/api/shopify/sync-order` provides manual sync/status endpoints for admin tools.

When a Prisma order is created, the sync helper:

1. Fetches the order, shipping/billing addresses, and line items.
2. Calls Shopify `POST /admin/api/{version}/orders.json` with custom line items.
3. Persists `shopifyOrderId`, `shopifyOrderName`, status mirrors, and clears prior sync errors.

Failures store the API error message in `shopifySyncError` so operators can retry via the admin endpoint.

## Webhooks (Shopify → Next.js)

All Shopify webhook topics target `POST /api/webhooks/shopify`. Important headers:

- `X-Shopify-Hmac-Sha256` – verified using `SHOPIFY_WEBHOOK_SECRET`.
- `X-Shopify-Topic` – routes the payload to the right handler.

Mapped topics:

- `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`
  - Updates Prisma payment + fulfillment statuses, tracking numbers, and timestamps.
- `fulfillments/create`, `fulfillments/update`
  - Tracks shipment events, sets `trackingNumber`, and stamps `shippedAt`/`deliveredAt` when appropriate.

Unknown topics are logged and acknowledged (Shopify expects 200 responses within 10 seconds).

## Admin + Operational Tools

- Admin order detail page links directly to Shopify when `shopifyOrderId` is present. Configure `NEXT_PUBLIC_SHOPIFY_ADMIN_URL` or `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` to control the link.
- `/api/shopify/cancel-order/:orderNumber` proxies cancellations to Shopify and mirrors the result locally.
- `/api/shopify/sync-order` can be used by scripts or the admin UI to re-sync orders on demand or pull current Shopify status.

## Testing & Verification

1. Run `npm run lint`, `npm run type-check`, and `npx vitest run` (new tests cover Shopify helpers/webhooks).
2. Create a test order via checkout → confirm the Shopify order appears in the Admin console and `shopifyOrderId` is set in the database.
3. Issue test webhooks from Shopify (or the CLI) for `orders/updated` and `fulfillments/create` to verify tracking + status syncing.
4. Execute `POST /api/shopify/cancel-order/{orderNumber}` and confirm both Shopify and Prisma show `CANCELLED`/`REFUNDED` state.

Document any additional Shopify scopes or webhook subscriptions in `docs/` if extended in the future.
