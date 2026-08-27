# Checkout Flow

Complete documentation of the Jose Madrid Salsa checkout pipeline, from cart management through payment confirmation.

---

## Table of Contents

- [Overview](#overview)
- [Flow Diagram](#flow-diagram)
- [1. Cart Management](#1-cart-management)
- [2. Checkout Page](#2-checkout-page)
- [3. Checkout API](#3-checkout-api)
- [4. Payment Processing](#4-payment-processing)
- [5. Order Completion](#5-order-completion)
- [6. Payment Webhooks](#6-payment-webhooks)
- [7. Order Confirmation](#7-order-confirmation)
- [8. Error Handling](#8-error-handling)
- [9. Abandoned Cart Recovery](#9-abandoned-cart-recovery)
- [Key Files](#key-files)

---

## Overview

The checkout flow supports multiple payment providers through a unified interface. The process follows these stages:

1. Customer builds a cart (client-side, persisted in localStorage)
2. Customer fills out checkout form (contact, shipping, payment)
3. Customer selects a payment method (card, PayPal, Venmo, Cash App Pay)
4. Server creates an Order record and initiates payment with the selected provider
5. Client confirms payment (Stripe Elements, PayPal popup, or Cash App flow)
6. Client calls the completion endpoint to finalize the order
7. Provider sends webhook events as backup confirmation

Both authenticated users and guest customers can complete checkout.

### Supported Payment Methods

| Method | Provider | Flow |
|--------|----------|------|
| Credit/Debit Card | Stripe | Client-side confirmation via Stripe Elements |
| Apple Pay | Stripe | Express Checkout Element |
| Google Pay | Stripe | Express Checkout Element |
| PayPal | PayPal | Popup authorization + server-side capture |
| Venmo | PayPal | Popup authorization + server-side capture |
| Cash App Pay | Square | Tokenization via Square Web Payments SDK |

---

## Flow Diagram

```
+------------------+     +-------------------+     +------------------+
|   Cart (Client)  |---->| Checkout Page     |---->| POST /api/       |
|   Zustand Store  |     | Contact + Address |     | checkout         |
|   localStorage   |     | + Payment Form    |     |                  |
+------------------+     +-------------------+     +------------------+
                                                          |
                                                          | Creates:
                                                          | - Order (PENDING)
                                                          | - PaymentIntent
                                                          | - Inventory reservation
                                                          v
                                                   +------------------+
                                                   | Returns:         |
                                                   | clientSecret     |
                                                   | orderId          |
                                                   +------------------+
                                                          |
                                                          v
                                              +------------------------+
                                              | stripe.confirmCard     |
                                              | Payment (client-side)  |
                                              +------------------------+
                                                          |
                                              +-----------+-----------+
                                              |                       |
                                          SUCCESS                   FAIL
                                              |                       |
                                              v                       v
                                   +-------------------+    +------------------+
                                   | POST /api/        |    | Show error       |
                                   | checkout/complete  |    | message to user  |
                                   +-------------------+    +------------------+
                                              |
                                              | In a Serializable transaction:
                                              | - Order -> PAID / CONFIRMED
                                              | - Deduct reserved inventory
                                              | - Update fundraiser totals
                                              | - Mark abandoned carts recovered
                                              v
                                   +-------------------+
                                   | Redirect to       |
                                   | /order-            |
                                   | confirmation/[id] |
                                   +-------------------+

                        === Async / Background ===

                                   +-------------------+
                                   | Stripe Webhook    |
                                   | POST /api/        |
                                   | webhooks/stripe   |
                                   +-------------------+
                                   | Handles:          |
                                   | - payment_intent  |
                                   |   .succeeded      |
                                   | - payment_intent  |
                                   |   .payment_failed |
                                   | - payment_intent  |
                                   |   .canceled       |
                                   | - charge.refunded |
                                   +-------------------+
```

---

## 1. Cart Management

**File:** `lib/store/cart.ts`

The cart is a Zustand store with `persist` middleware, backed by `localStorage`.

### Cart Item Shape

| Field        | Type     | Description                          |
|-------------|----------|--------------------------------------|
| `id`        | string   | Product ID (CUID)                    |
| `name`      | string   | Product display name                 |
| `slug`      | string   | URL-safe product identifier          |
| `price`     | number   | Unit price in dollars                |
| `image`     | string   | Product image URL                    |
| `quantity`  | number   | Quantity in cart                      |
| `sku`       | string   | Stock-keeping unit code              |
| `heatLevel` | string   | Salsa heat level                     |
| `maxQuantity` | number | Optional per-item quantity cap (default 99) |

### Cart Actions

| Action            | Behavior                                                              |
|-------------------|-----------------------------------------------------------------------|
| `addItem`         | Adds item or increments quantity (capped at `maxQuantity`)            |
| `removeItem`      | Removes item by ID                                                    |
| `updateQuantity`  | Sets quantity; removes item if quantity <= 0                          |
| `clearCart`        | Empties the cart                                                      |
| `setGuestEmail`   | Stores guest email for abandoned cart tracking                        |

### Abandoned Cart Tracking

Every cart mutation triggers a debounced (2-second) POST to `/api/cart/track` with the current items and guest email. This enables abandoned cart recovery emails.

---

## 2. Checkout Page

**File:** `app/(public)/checkout/page.tsx`

The checkout page is a client component wrapped in Stripe's `<Elements>` provider.

### Form Sections

1. **Contact Information** - First name, last name, email (required), phone (optional)
2. **Shipping Address** - Address line 1, line 2 (optional), city, state, ZIP code, order notes (optional)
3. **Shipping Method** - Radio buttons populated after address is entered (debounced API call)
4. **Payment Method** - `PaymentMethodSelector` component showing available methods based on configured providers (card, PayPal, Venmo, Cash App Pay). Methods are auto-detected from environment variables.
5. **Payment Details** - Renders the appropriate payment UI based on selected method:
   - **Card**: Stripe Elements (`CardElement` + `ExpressCheckoutElement`)
   - **PayPal**: `PayPalButton` via `@paypal/react-paypal-js`
   - **Venmo**: `VenmoButton` via `@paypal/react-paypal-js`
   - **Cash App Pay**: `CashAppButton` via `react-square-web-payments-sdk`

### Client-Side Calculations

When the customer enters city, state, or ZIP code, the page fires debounced requests (800ms) to:

- `POST /api/checkout/calculate-tax` - Returns estimated tax amount
- `POST /api/checkout/calculate-shipping` - Returns available shipping options with costs and estimated delivery

The first shipping option is auto-selected. The customer can switch between options.

### Express Checkout (Apple Pay / Google Pay)

The `ExpressCheckoutElement` from `@stripe/react-stripe-js` allows one-tap payment. It follows the same server flow: create order via `/api/checkout`, confirm payment, then complete via `/api/checkout/complete`.

### Order Summary Sidebar

Displays line items, subtotal, shipping cost, tax, and total. Updates in real-time as shipping/tax calculations complete.

---

## 3. Checkout API

**File:** `app/api/checkout/route.ts`

### Request Validation

Uses Zod schema (`CheckoutSchema`) to validate:

| Field           | Type                              | Required | Notes                                           |
|----------------|-----------------------------------|----------|--------------------------------------------------|
| `items`        | `{ productId, quantity }[]`       | Yes      | Minimum 1 item; productId must be CUID           |
| `customer`     | `{ email, firstName, lastName, phone? }` | Yes | Email must be valid                         |
| `shipping`     | `{ address1, address2?, city, state, postalCode }` | Yes | All except address2 required     |
| `notes`        | string                            | No       | Customer order notes                              |
| `discountCode` | string                            | No       | Discount code (validated separately)              |
| `recoveryToken`| string                            | No       | Abandoned cart recovery token                     |
| `shippingMethod` | string                          | No       | Preferred shipping method name                    |
| `referralCode` | string                            | No       | Fundraiser referral code                          |

**Security note:** `shippingCost` is intentionally NOT accepted from the client. Shipping is always recalculated server-side to prevent tampering.

### Processing Steps

1. **Authentication check** - Optional; guests can check out
2. **Input validation** - Zod schema parse
3. **Product lookup** - Fetches all products from DB; fails if any are missing
4. **Inventory reservation** - Atomic reservation via `reserveMultipleProducts` (Serializable transaction). If any item lacks stock, the entire reservation rolls back.
5. **Tax calculation** - Calls `calculateTax()` using Stripe Tax API with tax code `txcd_30011000` (packaged food). Falls back to $0 on failure.
6. **Shipping calculation** - Calls `calculateShipping()` server-side. If the client's preferred method matches a server option, uses that cost. Otherwise falls back to the server default. Returns HTTP 500 if shipping calculation fails entirely.
7. **Total computation** - `subtotal + tax + shipping`
8. **Abandoned cart recovery** - If `recoveryToken` provided, marks matching abandoned cart as recovered
9. **Referral attribution** - If `referralCode` provided, looks up participant and fundraiser IDs
10. **Order creation** - Creates Order with items in Prisma, status `PENDING`, payment status `PENDING`
11. **Audit logging** - Logs order creation event
13. **Stripe PaymentIntent** - Creates PaymentIntent with order metadata (orderId, orderNumber, customerName)

### Response

```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "orderId": "clxxx...",
  "amount": 42.99
}
```

### Order Number Format

`JMS-YYYYMMDD-NNNN` where NNNN is a random 4-digit number (1000-9999).

---

## 4. Payment Processing

Payment confirmation happens client-side using Stripe.js.

### Standard Card Payment

1. Client calls `stripe.confirmCardPayment(clientSecret, { payment_method: { card, billing_details } })`
2. Stripe processes the payment
3. On success, the `paymentIntent.id` is captured

### Express Checkout

1. Client calls `stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url } })`
2. Uses `redirect: 'if_required'` to avoid unnecessary redirects

### Error Mapping

The client maps Stripe error codes and decline codes to user-friendly messages. Handled codes include:
- `insufficient_funds`, `expired_card`, `incorrect_cvc`, `incorrect_number`
- `card_velocity_exceeded`, `fraudulent`
- Decline codes: `lost_card`, `stolen_card`, `processing_error`, `generic_decline`

---

## 5. Order Completion

**File:** `app/api/checkout/complete/route.ts`

Called after successful client-side payment confirmation.

### Request

```json
{
  "orderId": "clxxx...",
  "paymentIntentId": "pi_xxx"
}
```

### Processing Steps (Serializable Transaction)

1. **Fetch order and PaymentIntent** in parallel
2. **Idempotency check** - If order already `PAID`, returns success immediately
3. **Payment verification** - Confirms PaymentIntent status is `succeeded`; releases inventory if not
4. **Atomic transaction:**
   - Order status -> `CONFIRMED`, payment status -> `PAID`
   - Mark abandoned carts as recovered (by userId or guestEmail)
   - Update fundraiser participant totals (order count, revenue, commission)
   - Deduct reserved inventory via `deductReservedInventoryInTx`
5. **Post-transaction:** Fire low-stock inventory alerts

### Failure Recovery

If any step after inventory reservation fails, all reserved inventory is released item-by-item with error logging.

---

## 6. Payment Webhooks

### Stripe Webhook Route

**File:** `app/api/webhooks/stripe/route.ts`

### Security

1. Reads raw request body as text
2. Validates `stripe-signature` header
3. Verifies signature using `STRIPE_WEBHOOK_SECRET`
4. Returns 400 if signature is invalid, 503 if secret is not configured

### Idempotency

Uses a `WebhookEvent` table to track processed events by `stripeEventId`. If an event has already been processed, it is skipped.

### Handled Events

| Event                          | Action                                                                 |
|-------------------------------|------------------------------------------------------------------------|
| `payment_intent.succeeded`    | Order -> `CONFIRMED`/`SUCCEEDED`, decrement inventory, create Payment record, send confirmation email |
| `payment_intent.payment_failed` | Order payment status -> `FAILED`, create/update Payment record       |
| `payment_intent.canceled`     | Order -> `CANCELLED`/`FAILED`, create/update Payment record           |
| `charge.refunded`             | Full: Order -> `REFUNDED`, restore inventory. Partial: `PARTIALLY_REFUNDED`. Creates Refund record + audit log |

### Webhook Handler Library

**File:** `lib/stripe/webhooks.ts`

Contains reusable handler functions with the same logic, structured for testability:

- `handlePaymentIntentSucceeded` - Updates order, decrements inventory, sends email
- `handlePaymentIntentFailed` - Marks payment as failed
- `handlePaymentIntentCanceled` - Marks order cancelled
- `handleChargeRefunded` - Processes refunds with idempotency via audit log check
- `verifyWebhookSignature` - Signature verification helper
- `processWebhookEvent` - Event router

### Refund Handling Details

- **Full refunds:** Order status -> `REFUNDED`, inventory restored, audit log created
- **Partial refunds:** Payment status -> `PARTIALLY_REFUNDED`, inventory NOT automatically restored (requires manual admin adjustment)
- **Idempotency:** Duplicate refund webhooks are detected via `auditLog` query matching `refundId`

### PayPal Webhook Route

**File:** `app/api/webhooks/paypal/route.ts`

Receives events at `POST /api/webhooks/paypal`. Verifies signatures via PayPal's webhook verification API using `PAYPAL_WEBHOOK_ID`.

| Event | Action |
|-------|--------|
| `PAYMENT.CAPTURE.COMPLETED` | Order -> `CONFIRMED`/`SUCCEEDED`, creates/updates Payment record, sends confirmation email |
| `PAYMENT.CAPTURE.REFUNDED` | Creates Refund record, updates Payment and Order status |

Uses the same `WebhookEvent` table for idempotency with `provider: 'PAYPAL'`.

---

## 7. Order Confirmation

### Primary Confirmation Page

**File:** `app/order-confirmation/[id]/page.tsx`

Server-rendered page displaying:
- Success message with green check icon
- Order number and status badge
- Order info (date, payment method, payment status)
- Financial breakdown (subtotal, shipping, tax, total)
- Line items table (product, quantity, unit price, line total)
- Shipping address
- Next steps guidance
- Links to continue shopping or view all orders

### Alternative Success Page

**File:** `app/(public)/checkout/success/page.tsx`

Accepts `?order=<orderId>` query parameter. Displays:
- Order summary with line items
- Shipping method details
- Google review prompt (links to configurable `GOOGLE_REVIEW_URL`)
- Contact information for support

### Cancel Page

**File:** `app/(public)/checkout/cancel/page.tsx`

Static page shown when payment is cancelled. Reassures customer that no charges were made and cart items are preserved. Offers retry and continue shopping links.

---

## 8. Error Handling

### Cart Level
- Failed cart tracking calls are caught and logged; they never block the user

### Checkout API Level
- Invalid payload -> 400 with Zod error details
- Missing products -> 400
- Insufficient inventory -> 400 (atomic rollback of all reservations)
- Shipping calculation failure -> 500 (blocks checkout)
- Tax calculation failure -> Falls back to $0 tax (does not block checkout)
- Post-reservation failures -> All inventory reservations released before re-throwing

### Payment Level
- Stripe errors are mapped to user-friendly messages on the client
- Failed PaymentIntents trigger inventory release on the completion endpoint

### Webhook Level
- Signature verification failure -> 400
- Missing webhook secret -> 503
- Missing orderId in metadata -> Logged, returns 200 (acknowledged)
- Order not found -> Logged, returns 200
- Processing errors -> 500

---

## 9. Abandoned Cart Recovery

### Tracking Flow

1. Cart mutations trigger debounced POST to `/api/cart/track`
2. Guest email is captured when the email field contains `@`
3. Abandoned carts are stored in the `abandonedCart` table

### Recovery Flow

1. Recovery email contains a link with `?recover=<token>` parameter
2. Checkout page detects the token on mount
3. Calls `GET /api/cart/recover?token=<token>` to fetch saved cart items
4. Clears current cart and populates with recovered items
5. Displays success message: "Your cart has been restored!"
6. On successful order completion, the abandoned cart record is marked as recovered

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/store/cart.ts` | Client-side cart state (Zustand + localStorage) |
| `app/(public)/checkout/page.tsx` | Checkout form UI with payment method selection |
| `app/(public)/checkout/layout.tsx` | Minimal passthrough layout |
| `app/(public)/checkout/success/page.tsx` | Post-purchase success page |
| `app/(public)/checkout/cancel/page.tsx` | Payment cancellation page |
| `components/checkout/PaymentMethodSelector.tsx` | Payment method selection UI (card, PayPal, Venmo, Cash App) |
| `components/checkout/PayPalProvider.tsx` | PayPal SDK wrapper |
| `components/checkout/PayPalButton.tsx` | PayPal payment button |
| `components/checkout/VenmoButton.tsx` | Venmo payment button |
| `components/checkout/CashAppButton.tsx` | Cash App Pay button |
| `components/checkout/SquareProvider.tsx` | Square Web Payments SDK wrapper |
| `app/api/checkout/route.ts` | Order creation + payment initiation |
| `app/api/checkout/complete/route.ts` | Order finalization after payment |
| `app/api/checkout/retry-payment/route.ts` | Payment retry for failed orders |
| `app/api/checkout/calculate-tax/route.ts` | Tax estimation endpoint |
| `app/api/checkout/calculate-shipping/route.ts` | Shipping rate endpoint |
| `app/api/checkout/validate-discount/route.ts` | Discount code validation |
| `app/api/checkout/apply-gift-certificate/route.ts` | Gift certificate application |
| `app/api/payments/create/route.ts` | Unified payment creation (provider-agnostic) |
| `app/api/payments/methods/route.ts` | Available payment methods listing |
| `app/api/webhooks/stripe/route.ts` | Stripe webhook receiver |
| `app/api/webhooks/paypal/route.ts` | PayPal webhook receiver |
| `lib/payments/index.ts` | Payment provider registration and exports |
| `lib/payments/types.ts` | Provider-agnostic payment types |
| `lib/payments/registry.ts` | Provider registry and method routing |
| `lib/payments/providers/stripe.ts` | Stripe adapter |
| `lib/payments/providers/paypal.ts` | PayPal adapter |
| `lib/stripe/webhooks.ts` | Stripe webhook handler logic |
| `lib/stripe/types.ts` | Stripe-related type definitions |
| `app/order-confirmation/[id]/page.tsx` | Order confirmation display |
| `lib/shipping-calculator.ts` | Shipping cost calculation |
| `lib/tax-calculator.ts` | Tax calculation via Stripe Tax |
| `lib/inventory-manager.ts` | Inventory reservation and deduction |
