# Stripe Webhook Setup Guide

This guide explains how to configure Stripe webhooks for the Jose Madrid Salsa website.

## Webhook Endpoint

The webhook endpoint is available at:
- **Production**: `https://josemadrid.net/api/webhooks/stripe`
- **Local Development**: `http://localhost:3000/api/webhooks/stripe` (use Stripe CLI)

## Setting Up Production Webhooks

### Step 1: Create Webhook Endpoint in Stripe Dashboard

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add endpoint**
4. Enter the endpoint URL: `https://josemadrid.net/api/webhooks/stripe`
5. Select the following events to listen for:
   - `payment_intent.succeeded` - When a payment is successfully completed
   - `payment_intent.payment_failed` - When a payment fails
   - `payment_intent.canceled` - When a payment is canceled

### Step 2: Get Webhook Signing Secret

1. After creating the webhook, click on it to view details
2. Click **Reveal** next to "Signing secret"
3. Copy the secret (starts with `whsec_...`)

### Step 3: Add to Vercel Environment Variables

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add the following variable:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: `whsec_...` (the signing secret from Step 2)
   - **Environment**: Production (and Preview if needed)

### Step 4: Redeploy

After adding the environment variable, redeploy your application on Vercel.

## Testing Webhooks Locally

For local development, use the Stripe CLI:

```bash
# Install Stripe CLI (if not already installed)
# See: https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will:
- Display a webhook signing secret (starts with `whsec_...`)
- Forward all Stripe events to your local server
- Add the signing secret to your `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## What the Webhook Handles

### payment_intent.succeeded

When a payment succeeds:
- Updates the order status to `PAID` and `CONFIRMED`
- Records the Stripe payment ID
- Decrements product inventory (for regular orders)
- Gift certificates are already created, no additional action needed

### payment_intent.payment_failed

When a payment fails:
- Updates the order payment status to `FAILED`
- Order remains in `PENDING` status

### payment_intent.canceled

When a payment is canceled:
- Updates the order payment status to `FAILED`
- Updates the order status to `CANCELLED`

## Webhook Security

The webhook endpoint:
- ✅ Verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`
- ✅ Rejects requests with invalid signatures
- ✅ Idempotently handles events (safe to retry)
- ✅ Logs all webhook events for debugging

## Troubleshooting

### Webhook not receiving events

1. **Check Vercel deployment**: Ensure the endpoint is deployed and accessible
2. **Verify webhook URL**: Ensure it matches exactly: `https://josemadrid.net/api/webhooks/stripe`
3. **Check environment variable**: Verify `STRIPE_WEBHOOK_SECRET` is set in Vercel
4. **Check Stripe Dashboard**: View webhook delivery logs in Stripe Dashboard

### Signature verification fails

1. **Verify secret**: Ensure `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe Dashboard
2. **Check environment**: Ensure you're using the correct secret for production vs test mode
3. **Redeploy**: After updating the secret, redeploy your application

### Order not updating

1. **Check webhook logs**: View delivery logs in Stripe Dashboard
2. **Check application logs**: Check Vercel function logs for errors
3. **Verify metadata**: Ensure payment intents include `orderId` in metadata

## Testing

You can test webhooks using Stripe CLI:

```bash
# Trigger a test payment_intent.succeeded event
stripe trigger payment_intent.succeeded

# Trigger a test payment_intent.payment_failed event
stripe trigger payment_intent.payment_failed
```

## Important Notes

- **Production vs Test Mode**: Use different webhook endpoints/secrets for test and live modes
- **Idempotency**: The webhook handler is idempotent - safe to receive the same event multiple times
- **Order Metadata**: Payment intents must include `orderId` in metadata for the webhook to process them
- **Backup**: The frontend completion endpoints (`/api/checkout/complete` and `/api/gift-certificates/complete`) still work as a backup if webhooks fail

