# Shopify Webhook Quick Start

This is a condensed reference for setting up Shopify webhooks. For detailed instructions, see [shopify-webhook-setup.md](./shopify-webhook-setup.md).

## 1. Update Environment Variables

```bash
# .env.local - Update these values
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxx
SHOPIFY_WEBHOOK_SECRET=$(openssl rand -hex 32)
SHOPIFY_API_VERSION=2024-10

NEXT_PUBLIC_SHOPIFY_ADMIN_URL=https://your-store.myshopify.com/admin
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
```

## 2. Configure Webhooks in Shopify

**Shopify Admin → Settings → Notifications → Webhooks**

Add 6 webhooks, all pointing to: `https://your-domain.com/api/webhooks/shopify`

- ✅ Order creation
- ✅ Order updated  
- ✅ Order payment
- ✅ Order cancellation
- ✅ Fulfillment creation
- ✅ Fulfillment update

## 3. Test Locally

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000

# Terminal 3: Test webhook
npm run shopify:test-webhook
```

Update Shopify webhooks to use ngrok URL while testing.

## 4. Deploy to Production

```bash
# Add env vars to Vercel
vercel env add SHOPIFY_STORE_DOMAIN
vercel env add SHOPIFY_ADMIN_API_TOKEN
vercel env add SHOPIFY_WEBHOOK_SECRET
vercel env add SHOPIFY_API_VERSION

# Deploy
npm run build
vercel --prod
```

Update Shopify webhook URLs to production domain.

## 5. Verify

```bash
# Check database
npm run db:studio

# Query for synced orders
# Look for: shopifyOrderId, shopifySyncedAt, trackingNumber
```

## Webhook Events Handled

| Shopify Event | Updates |
|--------------|---------|
| `orders/create` | Initial order sync |
| `orders/updated` | Status, tracking, timestamps |
| `orders/paid` | Payment status |
| `orders/cancelled` | Cancellation status |
| `fulfillments/create` | Tracking number, shipped date |
| `fulfillments/update` | Delivery status |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check `SHOPIFY_WEBHOOK_SECRET` matches |
| Order not found | Ensure order exists in DB first |
| Webhook not received | Check ngrok, URL, and Shopify logs |

## Commands

```bash
npm run shopify:test-webhook  # Test webhook locally
npm run db:studio             # View database
npm run dev                   # Start dev server
```

## Files

- Handler: `app/api/webhooks/shopify/route.ts`
- Signature verification: `lib/shopify/webhook.ts`
- Client: `lib/shopify/client.ts`
- Schema: `prisma/schema.prisma` (Order model)

---

**Full documentation:** [shopify-webhook-setup.md](./shopify-webhook-setup.md)
