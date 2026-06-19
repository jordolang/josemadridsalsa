# Shopify Webhook Setup Guide

This guide walks you through setting up Shopify webhooks for the Jose Madrid Salsa storefront.

## Overview

Webhooks allow Shopify to automatically notify your Next.js application when orders are updated, paid, fulfilled, or cancelled. Your app already has the webhook handler implemented at `/api/webhooks/shopify`.

## Prerequisites

- A Shopify store with Admin access
- Access to your `.env.local` file
- Your Next.js app deployed (or using ngrok for local testing)

## Step 1: Configure Environment Variables

Update your `.env.local` file with the following variables:

```bash
# Required - Replace with your actual values
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxx
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here
SHOPIFY_API_VERSION=2024-10

# Optional - for admin UI "View in Shopify" links
NEXT_PUBLIC_SHOPIFY_ADMIN_URL=https://your-store.myshopify.com/admin
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
```

### Finding Your Values

1. **SHOPIFY_STORE_DOMAIN**: Your store URL (e.g., `josemadridsalsa.myshopify.com`)
2. **SHOPIFY_ADMIN_API_TOKEN**: 
   - Go to Shopify Admin → Apps → Develop apps
   - Create a new app or use an existing one
   - Under "Admin API access token", generate/copy the token (starts with `shpat_`)
3. **SHOPIFY_WEBHOOK_SECRET**: Generate a secure secret:
   ```bash
   openssl rand -hex 32
   ```

## Step 2: Set Up Webhooks in Shopify

### Option A: Via Shopify Admin UI

1. Go to **Shopify Admin → Settings → Notifications**
2. Scroll down to **Webhooks** section
3. Click **Create webhook** for each of the following:

| Event | URL | Format |
|-------|-----|--------|
| Order creation | `https://your-domain.com/api/webhooks/shopify` | JSON |
| Order updated | `https://your-domain.com/api/webhooks/shopify` | JSON |
| Order payment | `https://your-domain.com/api/webhooks/shopify` | JSON |
| Order cancellation | `https://your-domain.com/api/webhooks/shopify` | JSON |
| Fulfillment creation | `https://your-domain.com/api/webhooks/shopify` | JSON |
| Fulfillment update | `https://your-domain.com/api/webhooks/shopify` | JSON |

4. For each webhook, set the **API version** to `2024-10` (or latest stable)

### Option B: Via Shopify CLI (Coming Soon)

We'll add a script to automate webhook creation via the Admin API.

## Step 3: Local Development Setup

For testing webhooks locally, you need to expose your local server to the internet:

### Using ngrok

1. Install ngrok:
   ```bash
   brew install ngrok  # macOS
   # or download from https://ngrok.com
   ```

2. Start your dev server:
   ```bash
   npm run dev
   ```

3. In another terminal, start ngrok:
   ```bash
   ngrok http 3000
   ```

4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

5. Update your Shopify webhooks to use:
   ```
   https://abc123.ngrok.io/api/webhooks/shopify
   ```

### Using Shopify CLI

Alternatively, use Shopify CLI which provides automatic tunneling:

```bash
shopify app dev
```

## Step 4: Test Your Webhooks

### Automated Testing

Run the included test script:

```bash
npm run shopify:test-webhook
```

This script:
- Generates test webhook payloads
- Creates valid HMAC signatures
- Sends requests to your local webhook endpoint
- Verifies the responses

### Manual Testing

1. Create a test order in your Shopify Admin
2. Check your Next.js application logs for webhook processing
3. Verify the order is updated in your database:
   ```bash
   npm run db:studio
   ```
4. Check the `shopifyOrderId`, `shopifySyncedAt`, and status fields

### Testing from Shopify

1. Go to **Shopify Admin → Settings → Notifications → Webhooks**
2. Click on a webhook
3. Click **Send test notification**
4. Check your application logs

## Step 5: Verify Webhook Events

The webhook handler supports these events:

### Order Events
- **orders/create**: New order created in Shopify
- **orders/updated**: Order details changed (status, items, etc.)
- **orders/paid**: Payment completed
- **orders/cancelled**: Order cancelled

### Fulfillment Events
- **fulfillments/create**: Shipment created with tracking
- **fulfillments/update**: Tracking or delivery status updated

### What Gets Synced

When a webhook is received, the following fields are updated in your database:

```typescript
{
  shopifyOrderId: string,
  shopifyOrderName: string,        // e.g., "#1001"
  shopifyFinancialStatus: string,  // pending, paid, refunded, etc.
  shopifyFulfillmentStatus: string, // fulfilled, partial, etc.
  shopifySyncedAt: Date,
  status: OrderStatus,             // Mapped from fulfillment status
  paymentStatus: PaymentStatus,    // Mapped from financial status
  trackingNumber: string,          // From fulfillments
  shippedAt: Date,
  deliveredAt: Date
}
```

## Troubleshooting

### Webhook Returns 401 (Unauthorized)

- Verify `SHOPIFY_WEBHOOK_SECRET` matches the secret in Shopify Admin
- Check webhook signature is being sent in `X-Shopify-Hmac-Sha256` header

### Webhook Returns 400 (Bad Request)

- Ensure `X-Shopify-Topic` header is present
- Verify payload is valid JSON

### Webhook Returns 500 (Server Error)

- Check application logs for errors
- Verify database connection is working
- Ensure the order exists in your database (create it via checkout first)

### Order Not Found Warning

If you see: `[Shopify] Order webhook received for unknown order`

This means Shopify sent a webhook for an order that doesn't exist in your database. This can happen if:
1. The order was created directly in Shopify (not through your storefront)
2. The sync from your checkout to Shopify failed

**Solution**: The webhook looks for orders by `shopifyOrderId` or `orderNumber` (from note_attributes). Make sure your checkout process calls the Shopify sync after creating orders.

### Webhook Not Received

1. Check ngrok is running (for local dev)
2. Verify webhook URL is correct in Shopify Admin
3. Check webhook status in Shopify - failed webhooks will show errors
4. Ensure your app is deployed and accessible
5. Check Shopify webhook delivery logs for HTTP errors

## Production Deployment

### Deploy to Vercel

1. Add environment variables in Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add all `SHOPIFY_*` variables

2. Deploy:
   ```bash
   npm run build
   vercel --prod
   ```

3. Update webhook URLs in Shopify Admin to use your production domain

### Environment Variable Sync

After updating `.env.local`, sync to Vercel:

```bash
vercel env pull  # Pull from Vercel
vercel env push  # Push local to Vercel
```

## Security Considerations

1. **Always verify signatures**: The webhook handler automatically validates HMAC signatures
2. **Use HTTPS**: Never use HTTP for webhook endpoints in production
3. **Rate limiting**: Consider adding rate limiting to prevent abuse
4. **Logging**: Monitor webhook failures and investigate unusual patterns
5. **Rotate secrets**: Periodically update `SHOPIFY_WEBHOOK_SECRET` and update Shopify webhooks

## Monitoring

### Check Webhook Status

Monitor your webhooks:
- Shopify Admin shows delivery success/failure rates
- Check your application logs for processing errors
- Monitor `shopifySyncError` field in orders table

### Database Queries

Check sync status:

```sql
-- Orders with sync errors
SELECT orderNumber, shopifyOrderId, shopifySyncError 
FROM orders 
WHERE shopifySyncError IS NOT NULL;

-- Recent synced orders
SELECT orderNumber, shopifyOrderId, shopifySyncedAt 
FROM orders 
WHERE shopifySyncedAt IS NOT NULL 
ORDER BY shopifySyncedAt DESC 
LIMIT 10;
```

## Additional Resources

- [Shopify Webhook Documentation](https://shopify.dev/docs/apps/webhooks)
- [HMAC Validation Guide](https://shopify.dev/docs/apps/webhooks/validate)
- [Webhook Topics Reference](https://shopify.dev/docs/api/admin-rest/latest/resources/webhook)
- [Order Event Types](https://shopify.dev/docs/api/admin-rest/latest/resources/order#event-topics)

## Next Steps

After setting up webhooks:

1. ✅ Test with a real order flow
2. ✅ Monitor for a few days to ensure stability
3. ✅ Set up alerts for webhook failures
4. ✅ Document any custom order attributes or metadata
5. ✅ Consider adding retry logic for failed webhooks
