# Payment Integration Guide

How payment providers are integrated into the Jose Madrid Salsa platform for payments, webhooks, and refunds. This guide covers Stripe (primary) and PayPal setup. For the full multi-provider architecture, see `docs/payment-architecture.md`.

---

## Table of Contents

- [Overview](#overview)
- [Stripe Setup](#stripe-setup)
- [Stripe Client Configuration](#stripe-client-configuration)
- [Payment Flow](#payment-flow)
- [Webhook Configuration](#webhook-configuration)
- [Webhook Event Handling](#webhook-event-handling)
- [Refund Process](#refund-process)
- [Tax Calculation](#tax-calculation)
- [Payment Methods](#payment-methods)
- [PayPal Setup](#paypal-setup)
- [PayPal Webhook Configuration](#paypal-webhook-configuration)
- [Venmo Support](#venmo-support)
- [Error Handling](#error-handling)
- [Type Definitions](#type-definitions)
- [Key Files](#key-files)

---

## Overview

The platform uses **Stripe PaymentIntents** for payment processing. The integration follows a split architecture:

- **Client-side:** Stripe.js and Stripe Elements for secure card input and payment confirmation
- **Server-side:** Stripe SDK for creating PaymentIntents, processing refunds, and verifying webhooks

Payment confirmation happens through two channels:
1. **Primary:** Client calls `/api/checkout/complete` after successful `confirmCardPayment`
2. **Backup:** Stripe webhook `payment_intent.succeeded` ensures no payments are missed

---

## Stripe Setup

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Server-side secret key (starts with `sk_`) | `sk_live_xxx` or `sk_test_xxx` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side publishable key (starts with `pk_`) | `pk_live_xxx` or `pk_test_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret (starts with `whsec_`) | `whsec_xxx` |

**Alternative:** `STRIPE_SECRET` is also accepted as a fallback for `STRIPE_SECRET_KEY`.

### Initial Setup Steps

1. Create a Stripe account at stripe.com
2. Navigate to the Stripe Dashboard > Developers > API Keys
3. Copy the **Secret key** and set it as `STRIPE_SECRET_KEY`
4. Copy the **Publishable key** and set it as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
5. Set up webhooks (see [Webhook Configuration](#webhook-configuration))
6. For development, use test mode keys (`sk_test_*`, `pk_test_*`)

### Verifying Configuration

If `STRIPE_SECRET_KEY` is not set, the server will throw an error when any Stripe operation is attempted. The checkout page shows a configuration error message if `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing.

---

## Stripe Client Configuration

**File:** `lib/stripe.ts`

The Stripe SDK client is initialized as a lazy singleton:

```
API Version: 2025-10-29.clover
Max Network Retries: 2
Timeout: 30 seconds (30000ms)
```

Access via `getStripe()` which returns the cached instance or creates a new one.

---

## Payment Flow

### 1. Create PaymentIntent (Server)

**Endpoint:** `POST /api/checkout`

When the customer submits the checkout form:

1. Server validates the request, creates the order (status: `PENDING`)
2. Reserves inventory atomically
3. Calculates tax and shipping server-side
4. Creates a Stripe PaymentIntent:
   - `amount`: Total in cents (`Math.round(total * 100)`)
   - `currency`: `usd`
   - `receipt_email`: Customer email
   - `metadata`: `{ orderId, orderNumber, customerName }`
   - `shipping`: Customer shipping address and name
5. Returns `{ clientSecret, orderId, amount }` to the client

### 2. Confirm Payment (Client)

The client confirms payment using one of two methods:

**Standard Card Payment:**
```
stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name, email, phone }
  }
})
```

**Express Checkout (Apple Pay / Google Pay):**
```
stripe.confirmPayment({
  elements: event.elements,
  clientSecret,
  confirmParams: { return_url },
  redirect: 'if_required'
})
```

### 3. Complete Order (Server)

**Endpoint:** `POST /api/checkout/complete`

After successful client-side confirmation:

1. Validates `{ orderId, paymentIntentId }`
2. Fetches order and verifies PaymentIntent status is `succeeded` (in parallel)
3. Idempotency: if order already `PAID`, returns success immediately
4. If payment not succeeded, releases inventory and returns error
5. In a Serializable transaction:
   - Order: `paymentStatus` -> `PAID`, `status` -> `CONFIRMED`, stores `stripePaymentId`
   - Marks abandoned carts as recovered
   - Updates fundraiser participant totals (order count, revenue, commission)
   - Deducts reserved inventory
6. Fires inventory alerts post-transaction

### 4. Redirect to Confirmation

Client clears cart and redirects to `/order-confirmation/[orderId]`.

---

## Webhook Configuration

### Setting Up Webhooks in Stripe Dashboard

1. Go to Stripe Dashboard > Developers > Webhooks
2. Click "Add endpoint"
3. Set the endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
5. Copy the **Signing secret** and set it as `STRIPE_WEBHOOK_SECRET`

### Local Development

Use the Stripe CLI to forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI will output a webhook signing secret to use as `STRIPE_WEBHOOK_SECRET`.

### Webhook Route Configuration

**File:** `app/api/webhooks/stripe/route.ts`

```
Runtime: nodejs
Dynamic: force-dynamic (no caching)
```

---

## Webhook Event Handling

### Security

1. Read raw request body as text (not JSON)
2. Extract `stripe-signature` header
3. Verify signature using `stripe.webhooks.constructEvent(body, signature, webhookSecret)`
4. Return 400 if signature is invalid
5. Return 503 if `STRIPE_WEBHOOK_SECRET` is not configured

### Idempotency

The webhook route uses a `WebhookEvent` database table to prevent duplicate processing:

1. Check if event ID exists in `WebhookEvent` table with `processed: true`
2. If already processed, skip and return 200
3. Create/upsert `WebhookEvent` record with `processed: false`
4. Process the event
5. Mark `WebhookEvent` as `processed: true`

### Handled Events

#### `payment_intent.succeeded`

1. Extract `orderId` from PaymentIntent metadata
2. Find order (skip if not found or already `SUCCEEDED`)
3. In a transaction:
   - Order: `paymentStatus` -> `SUCCEEDED`, `status` -> `CONFIRMED`
   - Upsert `Payment` record with PaymentIntent details
   - Decrement product inventory for each order item
4. Send confirmation email if not already sent

#### `payment_intent.payment_failed`

1. Extract `orderId` from metadata
2. In a transaction:
   - Order: `paymentStatus` -> `FAILED`
   - Upsert `Payment` record with `FAILED` status

#### `payment_intent.canceled`

1. Extract `orderId` from metadata
2. In a transaction:
   - Order: `paymentStatus` -> `FAILED`, `status` -> `CANCELLED`
   - Upsert `Payment` record with `CANCELED` status

#### `charge.refunded`

1. Extract `orderId` from charge metadata
2. Determine if full or partial refund (`amount_refunded === amount`)
3. Find order with items and associated `Payment` record
4. In a transaction:
   - Order: status -> `REFUNDED` (full) or unchanged (partial); payment status -> `REFUNDED` or `PARTIALLY_REFUNDED`
   - Payment: status -> `REFUNDED` or `PARTIALLY_REFUNDED`
   - Upsert `Refund` record with Stripe refund details
   - Full refund only: restore inventory (increment each product)
   - Partial refund: inventory NOT restored (requires manual admin adjustment)
   - Create `AuditLog` entry with refund details

---

## Refund Process

### Admin Refund API

**Endpoint:** `POST /api/admin/orders/[id]/refund`
**Permission:** `orders:write`

### Request

```json
{
  "amount": 25.00
}
```

Amount is in dollars (converted to cents server-side).

### Validation Steps

1. Verify admin has `orders:write` permission
2. Validate amount is a positive number
3. Fetch order and verify payment status is `PAID` or `PARTIALLY_REFUNDED`
4. Verify order has a `stripePaymentId`
5. Verify amount does not exceed order total
6. Retrieve Stripe charge and calculate existing refunds
7. Verify amount does not exceed remaining refundable amount

### Processing

1. Convert amount to cents: `Math.floor(amount * 100)` (truncates sub-cent amounts)
2. Generate idempotency key: `refund-{orderId}-{amountInCents}` (prevents duplicate refunds on retry)
3. Create Stripe refund with:
   - `charge`: Charge ID from PaymentIntent
   - `amount`: Amount in cents
   - `metadata`: `{ orderId, orderNumber, refundedBy }`
4. Log audit event (`orders.refund`)

### Response

```json
{
  "success": true,
  "refund": {
    "id": "re_xxx",
    "amount": 25.00,
    "status": "succeeded",
    "created": 1234567890
  },
  "order": {
    "id": "clxxx",
    "orderNumber": "JMS-20260331-1234",
    "totalRefunded": 25.00,
    "refundableAmount": 17.99
  },
  "message": "Refund processed successfully. Order status will be updated via webhook."
}
```

**Important:** The refund endpoint does NOT directly update the order status. The order status update happens asynchronously via the `charge.refunded` Stripe webhook.

### Error Handling

| Stripe Error Type | HTTP Status | User Message |
|-------------------|-------------|-------------|
| `StripeInvalidRequestError` | 400 | Stripe error details |
| `StripeConnectionError` | 503 | Unable to connect to payment processor |
| `StripeRateLimitError` | 429 | Too many requests |
| `StripeAuthenticationError` | 500 | Payment processor configuration error |

---

## Tax Calculation

Tax is calculated using the **Stripe Tax API** during checkout.

**Tax code:** `txcd_30011000` (Food & beverage - Packaged food)

### Behavior

- Called during checkout with line items and shipping address
- If tax calculation fails, checkout continues with `$0` tax (does not block checkout)
- Tax amount is stored on the order as a separate field

---

## Payment Methods

### Stripe Methods

| Method | Implementation |
|--------|----------------|
| Credit/Debit Card | Stripe `CardElement` via `@stripe/react-stripe-js` |
| Apple Pay | Stripe `ExpressCheckoutElement` |
| Google Pay | Stripe `ExpressCheckoutElement` |

### Card Element Configuration

- Font size: 16px, color: `#1f2937`
- Invalid color: `#ef4444`
- Postal code hidden (collected separately in shipping form)

### Express Checkout

Uses `ExpressCheckoutElement` with `buttonType: 'buy'` for both Apple Pay and Google Pay. Only rendered when cart has items and total > 0.

### Other Providers

For Cash App Pay (Square) and the full multi-provider architecture, see `docs/payment-architecture.md`.

---

## PayPal Setup

PayPal is an optional payment provider for online payments. When configured, customers can pay with their PayPal wallet or Venmo account.

### Required Environment Variables

| Variable | Side | Description |
|----------|------|-------------|
| `PAYPAL_CLIENT_ID` | Server | PayPal REST API client ID |
| `PAYPAL_CLIENT_SECRET` | Server | PayPal REST API client secret |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Client | Client-side PayPal client ID (for the PayPal JS SDK) |
| `PAYPAL_WEBHOOK_ID` | Server | PayPal webhook ID for signature verification |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PAYPAL_SANDBOX` | `true` (sandbox) | Set to `false` for production PayPal environment |
| `PAYPAL_RETURN_URL` | `{NEXT_PUBLIC_BASE_URL}/checkout/paypal/return` | Customer return URL after PayPal approval |
| `PAYPAL_CANCEL_URL` | `{NEXT_PUBLIC_BASE_URL}/checkout/paypal/cancel` | Customer cancel URL |

### Initial Setup Steps

1. Create a PayPal Developer account at [developer.paypal.com](https://developer.paypal.com)
2. Navigate to **Dashboard > My Apps & Credentials**
3. Create a new app (or use the default sandbox app for testing)
4. Copy the **Client ID** and set it as both `PAYPAL_CLIENT_ID` and `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
5. Copy the **Secret** and set it as `PAYPAL_CLIENT_SECRET`
6. Set up webhooks (see [PayPal Webhook Configuration](#paypal-webhook-configuration))
7. For development, use sandbox credentials (default behavior)

### Adapter Registration

The PayPal adapter is automatically registered when both `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are present in the environment. No code changes are needed -- the registration happens in `lib/payments/index.ts`:

```
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  registerProvider(new PayPalAdapter())
}
```

### PayPal Payment Flow

1. Customer selects "PayPal" in the payment method selector
2. `PayPalButton` component renders the PayPal button via `@paypal/react-paypal-js`
3. Customer clicks the button, which opens a PayPal popup
4. Client calls `POST /api/checkout/paypal/create-order` to create a PayPal Order (intent: `CAPTURE`)
5. Customer authorizes payment in the PayPal popup
6. On approval, client calls `POST /api/checkout/paypal/capture-order` to capture the payment
7. On success, the order is confirmed and the customer is redirected to the confirmation page

### Client-Side Components

| Component | File | Purpose |
|-----------|------|---------|
| `PayPalProvider` | `components/checkout/PayPalProvider.tsx` | Wraps checkout with `PayPalScriptProvider` from `@paypal/react-paypal-js`. Renders children directly if `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is not set. |
| `PayPalButton` | `components/checkout/PayPalButton.tsx` | Renders the PayPal payment button using `FUNDING.PAYPAL`. Handles order creation, approval, and error callbacks. |

### SDK Configuration

- **Server:** `@paypal/checkout-server-sdk`
  - Environment: `SandboxEnvironment` (default) or `LiveEnvironment` when `PAYPAL_SANDBOX=false`
  - Client is lazily initialized as a singleton
- **Client:** `@paypal/react-paypal-js`
  - Currency: `USD`
  - Intent: `capture`
  - Venmo funding enabled by default

---

## PayPal Webhook Configuration

### Setting Up Webhooks in PayPal Dashboard

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
2. Select your app
3. Scroll to **Webhooks** and click "Add Webhook"
4. Set the endpoint URL: `https://yourdomain.com/api/webhooks/paypal`
5. Select events to listen to:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
6. Copy the **Webhook ID** and set it as `PAYPAL_WEBHOOK_ID`

### Webhook Route

**File:** `app/api/webhooks/paypal/route.ts`

```
Runtime: nodejs
Dynamic: force-dynamic (no caching)
```

### Signature Verification

PayPal webhook signatures are verified using PayPal's Webhook Verification API:

1. Extract PayPal signature headers (`paypal-transmission-id`, `paypal-transmission-time`, `paypal-cert-url`, `paypal-transmission-sig`, `paypal-auth-algo`)
2. Obtain an access token via the PayPal OAuth2 API (`/v1/oauth2/token`)
3. Call PayPal's verification endpoint (`/v1/notifications/verify-webhook-signature`)
4. Webhook is accepted only if `verification_status` is `SUCCESS`
5. Returns 400 if any signature header is missing or verification fails

### Handled Events

| Event | Action |
|-------|--------|
| `PAYMENT.CAPTURE.COMPLETED` | Order -> `CONFIRMED`/`SUCCEEDED`. Creates Payment record with `paypalOrderId` and `paypalCaptureId`. Sends confirmation email if not already sent. |
| `PAYMENT.CAPTURE.REFUNDED` | Creates Refund record. Full refund: Order -> `REFUNDED`. Partial refund: Payment -> `PARTIALLY_REFUNDED`. |

### Idempotency

Uses the same `WebhookEvent` table as Stripe with `provider: 'PAYPAL'` and the PayPal event ID as `providerEventId`. Events already marked as `processed: true` are skipped.

### Local Development

PayPal does not have a CLI equivalent to `stripe listen`. For local webhook testing:

1. Use a tunneling service (e.g., ngrok) to expose your local server
2. Set the webhook URL to `https://your-ngrok-url.ngrok.io/api/webhooks/paypal`
3. Use sandbox credentials for testing

---

## Venmo Support

Venmo payments are processed through the PayPal SDK. When PayPal is configured, Venmo is automatically available.

### How It Works

- The `PayPalProvider` component enables Venmo as a funding source: `enableFunding: 'venmo'`
- The `VenmoButton` component (`components/checkout/VenmoButton.tsx`) renders a Venmo-branded button using `FUNDING.VENMO`
- The payment flow is identical to PayPal: create order -> customer authorizes in popup -> capture order
- Both PayPal and Venmo payments use the same server-side endpoints and the same PayPal adapter

### Configuration

No additional environment variables are needed beyond the PayPal setup. Venmo availability depends on:
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` being set
- The customer's device and region (Venmo is US-only)
- The PayPal SDK detecting Venmo eligibility

### Payment Method Selector

In the `PaymentMethodSelector`, Venmo appears as a separate option from PayPal when `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is configured.

---

## Error Handling

### Client-Side Payment Errors

The checkout page maps Stripe error codes to user-friendly messages:

| Code | Message |
|------|---------|
| `insufficient_funds` | Your card has insufficient funds |
| `expired_card` | Your card has expired |
| `incorrect_cvc` | The security code (CVC) is incorrect |
| `incorrect_number` | The card number is incorrect |
| `card_velocity_exceeded` | Too many transactions |
| `fraudulent` | Flagged as potentially fraudulent |
| `card_declined` / `generic_decline` | Card was declined |
| `processing_error` | Processing error, try again |
| `invalid_expiry_month` / `invalid_expiry_year` | Invalid expiration date |
| `invalid_cvc` | Invalid CVC |

### Server-Side Error Recovery

- **Inventory release:** If payment fails after reservation, all reserved inventory is released
- **Webhook backup:** Even if the completion endpoint fails, the `payment_intent.succeeded` webhook will catch successful payments
- **Idempotent completion:** The completion endpoint checks for `PAID` status before processing, allowing safe retries

---

## Type Definitions

**File:** `lib/stripe/types.ts`

| Type | Fields |
|------|--------|
| `CheckoutSessionRequest` | `orderId`, `successUrl?`, `cancelUrl?` |
| `CheckoutSessionResponse` | `sessionId`, `url` |
| `PaymentMetadata` | `orderId`, `orderNumber?`, `customerEmail?` |
| `RefundRequest` | `paymentId`, `amount?` (cents), `reason?` |
| `RefundResponse` | `refundId`, `status` |
| `WebhookEventType` | Union of 6 event type strings |
| `WebhookEventData` | `id`, `type`, `processed`, `createdAt` |

---

## Key Files

### Stripe

| File | Purpose |
|------|---------|
| `lib/stripe.ts` | Stripe SDK singleton client initialization |
| `lib/stripe/types.ts` | TypeScript type definitions for Stripe operations |
| `lib/stripe/webhooks.ts` | Reusable webhook handler functions |
| `lib/payments/providers/stripe.ts` | Stripe adapter (PaymentProviderAdapter implementation) |
| `app/api/checkout/route.ts` | Creates order + PaymentIntent |
| `app/api/checkout/complete/route.ts` | Finalizes order after payment confirmation |
| `app/api/webhooks/stripe/route.ts` | Stripe webhook receiver with idempotency |
| `app/api/admin/orders/[id]/refund/route.ts` | Admin refund processing |
| `app/(public)/checkout/page.tsx` | Client-side payment UI |
| `lib/tax-calculator.ts` | Stripe Tax API integration |

### PayPal

| File | Purpose |
|------|---------|
| `lib/payments/providers/paypal.ts` | PayPal adapter (PaymentProviderAdapter implementation) |
| `app/api/webhooks/paypal/route.ts` | PayPal webhook receiver with signature verification |
| `components/checkout/PayPalProvider.tsx` | PayPal SDK wrapper for checkout |
| `components/checkout/PayPalButton.tsx` | PayPal payment button |
| `components/checkout/VenmoButton.tsx` | Venmo payment button (via PayPal SDK) |

### Shared

| File | Purpose |
|------|---------|
| `lib/payments/types.ts` | Provider-agnostic payment types and adapter interface |
| `lib/payments/registry.ts` | Provider registry and method-to-provider mapping |
| `lib/payments/index.ts` | Auto-registration of adapters |
| `components/checkout/PaymentMethodSelector.tsx` | Payment method selection UI |
