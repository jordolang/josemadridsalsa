# API Audit - Jose Madrid Salsa Backend

> Generated 2026-04-02 by auditing all `app/api/` route files and `prisma/schema.prisma`.

## Table of Contents

1. [Authentication Architecture](#authentication-architecture)
2. [Payment Systems](#payment-systems)
3. [Customer-Facing API Endpoints](#customer-facing-api-endpoints)
4. [Admin API Endpoints](#admin-api-endpoints)
5. [Webhook & Cron Endpoints](#webhook--cron-endpoints)
6. [Database Schema Summary](#database-schema-summary)
7. [Mobile API Client Recommendations](#mobile-api-client-recommendations)
8. [Apple Pay Integration Plan](#apple-pay-integration-plan)

---

## Authentication Architecture

### Provider: NextAuth.js (JWT strategy)

- **Session strategy**: JWT (not database sessions)
- **Session max age**: 30 days
- **Secret**: `NEXTAUTH_SECRET` env var
- **Providers**:
  - `CredentialsProvider` (email + bcrypt password)
  - `GoogleProvider` (OAuth)
  - Facebook OAuth (TODO/commented out)
- **Pages**: `/auth/signin`, `/auth/error`

### JWT Token Shape

```typescript
{
  id: string        // User CUID
  email: string
  name?: string
  role: UserRole     // CUSTOMER | ADMIN | DEVELOPER | STAFF | WHOLESALE | FUNDRAISER
  fundraiserId?: string  // Only for FUNDRAISER role
  avatar?: string   // Google profile pic URL
}
```

### Session Shape (returned to client)

```typescript
session.user = {
  id: string
  email: string
  name?: string
  role: UserRole
  fundraiserId?: string
  image?: string        // Google avatar
}
```

### Server-Side Auth Helper

```typescript
// lib/rbac.ts
getCurrentUser(): Promise<{
  id: string
  email: string
  name: string | null
  role: UserRole
} | null>
```

Uses `getServerSession(authOptions)` under the hood. All authenticated endpoints call this function.

### Mobile Auth Strategy

NextAuth JWT tokens are HTTP-only cookies. For the iOS app, the recommended approach is:

1. **Credentials flow**: POST to `/api/auth/callback/credentials` with `{email, password, csrfToken}` — the response sets `next-auth.session-token` cookie
2. **Google OAuth flow**: Use ASWebAuthenticationSession to complete the Google OAuth flow through `/api/auth/signin/google`
3. **Session check**: GET `/api/auth/session` returns the current session JSON
4. **Token storage**: Store the session cookie in iOS Keychain; attach it to all subsequent API requests via `URLSession` cookie handling

### Auth API Routes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | Public | NextAuth handler (signin, signout, session, csrf, providers) |
| `/api/auth/register` | POST | Public | Register new user (email, password, name) |
| `/api/auth/forgot-password` | POST | Public | Send password reset email |
| `/api/auth/verify-reset-token` | POST | Public | Verify password reset token validity |
| `/api/auth/reset-password` | POST | Public | Reset password with token |
| `/api/auth/fundraiser-register` | POST | Public | Register fundraiser account |

---

## Payment Systems

The backend supports **three payment providers** via an adapter pattern (`lib/payments`):

### 1. Stripe (Primary)

- Used by default checkout flow (`/api/checkout`)
- Creates `PaymentIntent` with `client_secret` returned to frontend
- Stripe Tax API for tax calculation
- Stripe customer IDs stored on User for saved payment methods
- Webhook: `/api/webhooks/stripe`

### 2. Square

- Dedicated flow: `/api/checkout/square/create-order` + `/api/checkout/square/process-payment`
- Uses Square Web Payments SDK tokenized card (`sourceId`)
- POS terminal support: `/api/pos/create-terminal-checkout`, `/api/pos/terminal-status`
- Webhook: `/api/webhooks/square`

### 3. PayPal

- Dedicated flow: `/api/checkout/paypal/create-order` + `/api/checkout/paypal/capture-order`
- Returns `paypalOrderId` and `approvalUrl` for redirect-based flow
- Webhook: `/api/webhooks/paypal`

### Payment Database Models

- `Payment` — tracks all payment records with multi-provider fields (stripePaymentIntentId, squarePaymentId, paypalOrderId, etc.)
- `PaymentProviderConfig` — per-provider credentials and supported methods
- `WebhookEvent` — idempotency tracking for webhooks
- `Refund` — refund tracking

### Payment Enums

```
PaymentProvider: STRIPE | SQUARE | PAYPAL
PaymentChannel: ONLINE | POS
PaymentStatus: PENDING | PROCESSING | SUCCEEDED | PAID | FAILED | CANCELED | REFUNDED | PARTIALLY_REFUNDED
```

---

## Customer-Facing API Endpoints

### Products

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/products` | GET | Public | `?heatLevel=&search=&featured=&take=&skip=&sortOrder=&inStock=&categories=&tags=` | `Product[]` |
| `/api/products/featured` | GET | Public | — | `Product[]` |
| `/api/products/search` | GET | Public | `?q=` | `Product[]` |
| `/api/products/[id]/recommendations` | GET | Public | — | `Product[]` |
| `/api/salsas` | GET | Public | — | `Product[]` (alias) |
| `/api/salsas/featured` | GET | Public | — | `Product[]` |

**Product Shape** (response):
```typescript
{
  id: string
  name: string
  slug: string
  description: string | null
  price: number          // Decimal converted to float
  compareAtPrice?: number
  featuredImage: string | null
  images: string[]
  heatLevel: "MILD" | "MEDIUM" | "HOT" | "EXTRA_HOT" | "FRUIT"
  sku: string
  inventory: number
  isFeatured: boolean
  ingredients: string[]
  searchKeywords: string[]
  tags: string[]          // tag slugs
  nutritionalInfo: NutritionalInfo | null
  productIngredients: ProductIngredient[]
}
```

### Cart

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/cart` | GET | Required | — | `{ items, itemCount, totalQuantity, subtotal }` |
| `/api/cart` | POST | Required | `{ productId: string, quantity: number }` | `{ success, cartItem }` |
| `/api/cart/[id]` | PATCH | Required | `{ quantity: number }` | Updated cart item |
| `/api/cart/[id]` | DELETE | Required | — | Success |
| `/api/cart/recover` | POST | Public | `{ token: string }` | Recovered cart data |
| `/api/cart/track` | POST | Public | `{ ... }` | Abandoned cart tracking |

### Checkout

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/checkout` | POST | Optional* | `CheckoutSchema` (items, customer, shipping, notes, discountCode, shippingMethod, referralCode) | `{ clientSecret, orderId, amount }` |
| `/api/checkout/create-session` | POST | Optional | — | Stripe checkout session |
| `/api/checkout/complete` | POST | Optional | — | Order completion |
| `/api/checkout/calculate-shipping` | POST | Public | Shipping address + items | Shipping options & cost |
| `/api/checkout/calculate-tax` | POST | Public | Items + address | Tax amount |
| `/api/checkout/validate-discount` | POST | Public | `{ code: string }` | Discount details |
| `/api/checkout/apply-gift-certificate` | POST | Public | `{ code: string }` | Gift cert balance |
| `/api/checkout/retry-payment` | POST | Required | `{ orderId }` | New payment intent |
| `/api/checkout/square/create-order` | POST | Optional | Same as checkout | `{ orderId }` |
| `/api/checkout/square/process-payment` | POST | Optional | `{ sourceId, orderId, verificationToken?, guestEmail? }` | `{ success, orderId, orderNumber, squarePaymentId }` |
| `/api/checkout/paypal/create-order` | POST | Optional | Same as checkout | `{ paypalOrderId, approvalUrl, orderId, amount }` |
| `/api/checkout/paypal/capture-order` | POST | Optional | `{ paypalOrderId, orderId }` | Capture result |

*Guest checkout supported — if no session, requires `customer.email` in body.

### Orders

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/orders` | GET | Required | `?status=&paymentStatus=&take=&skip=&sortOrder=` | `Order[]` (user's orders) |
| `/api/orders` | POST | Required | `{ cartItemIds, shippingAddress, billingAddress, notes }` | `{ clientSecret, orderId, orderNumber, amount }` |
| `/api/orders/[id]` | GET | Required | — | Single order detail |

### Wishlist

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/wishlist` | GET | Optional | — | `{ items: WishlistItem[] }` (empty if not authenticated) |
| `/api/wishlist` | POST | Required | `{ productId: string }` | Created wishlist item |
| `/api/wishlist` | DELETE | Required | `{ productId: string }` | `{ message }` |

### Loyalty Program

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/loyalty` | GET | Required | — | `{ data: LoyaltyAccount }` |
| `/api/loyalty/rewards` | GET | Required | — | Available rewards |
| `/api/loyalty/redeem` | POST | Required | `{ rewardId }` | Redemption result |

### Account / Payment Methods

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/account/payment-methods` | GET | Required | — | Saved payment methods |

### Gift Certificates

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/gift-certificates/purchase` | POST | Public | Purchase details | Gift cert code |
| `/api/gift-certificates/balance` | POST | Public | `{ code }` | Balance info |
| `/api/gift-certificates/complete` | POST | Public | Completion data | Result |

### Locations (Store Finder)

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/api/locations` | GET | Public | `?city=&state=` | `RetailLocation[]` |
| `/api/locations/geocode` | POST | Public | Address string | Geocoded coordinates |

### Other Public Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/recipes` | GET | Public | Recipe catalog |
| `/api/reviews/google` | GET | Public | Google reviews |
| `/api/newsletter` | POST | Public | Newsletter signup |
| `/api/calendar` | GET | Public | Events calendar |
| `/api/recommendations/personalized` | GET | Required | AI personalized recs |
| `/api/ai-chat` | POST | Public | AI chatbot |
| `/api/fundraisers` | GET | Public | Active fundraisers |
| `/api/fundraisers/[id]` | GET | Public | Single fundraiser |
| `/api/fundraiser/signup` | POST | Public | Fundraiser registration |
| `/api/fundraiser/sale` | POST | Public | Record fundraiser sale |
| `/api/participants/lookup` | GET | Public | Participant lookup by referral code |
| `/api/image-proxy` | GET | Public | Proxy external images |
| `/api/unsubscribe` | POST/GET | Public | Email unsubscribe |

### Fundraiser Portal (Authenticated Fundraiser Users)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/fundraiser-portal/dashboard` | GET | Fundraiser | Dashboard stats |
| `/api/fundraiser-portal/assets` | GET | Fundraiser | Marketing assets |
| `/api/fundraiser-portal/contact` | POST | Fundraiser | Contact support |
| `/api/fundraiser-portal/page-config` | GET/PUT | Fundraiser | Portal page config |
| `/api/fundraiser-portal/settings` | GET/PUT | Fundraiser | Portal settings |

---

## Admin API Endpoints

All admin endpoints require authentication with role `ADMIN` (or `STAFF`/`DEVELOPER` for some).

### Products Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/products` | GET, POST | List/create products |
| `/api/admin/products/[id]` | GET, PUT, DELETE | Single product CRUD |
| `/api/admin/products/[id]/variants` | GET, POST | Product variants |
| `/api/admin/products/[id]/variants/[variantId]` | PUT, DELETE | Variant CRUD |
| `/api/admin/products/export` | GET | Export products |
| `/api/admin/products/import` | POST | Import products |
| `/api/admin/categories` | GET, POST | Categories |
| `/api/admin/categories/[id]` | PUT, DELETE | Category CRUD |
| `/api/admin/tags` | GET, POST | Tags |
| `/api/admin/tags/[id]` | PUT, DELETE | Tag CRUD |

### Orders Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/orders` | GET | List orders (with filters) |
| `/api/admin/orders/[id]/update-status` | PUT | Update order status |
| `/api/admin/orders/[id]/tracking` | PUT | Add tracking number |
| `/api/admin/orders/[id]/shipping-label` | POST | Generate shipping label |
| `/api/admin/orders/[id]/send-email` | POST | Send order email |
| `/api/admin/orders/[id]/refund` | POST | Process refund |
| `/api/admin/orders/[id]/modify` | PUT | Modify order |
| `/api/admin/orders/bulk-status` | PUT | Bulk status update |
| `/api/admin/orders/export` | GET | Export orders |
| `/api/admin/orders/import` | POST | Import orders |

### Inventory Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/inventory` | GET | Inventory list |
| `/api/admin/inventory/[productId]` | PUT | Update inventory |
| `/api/admin/inventory/alerts` | GET, POST | Inventory alerts |
| `/api/admin/inventory/alerts/[alertId]` | PUT, DELETE | Alert CRUD |
| `/api/admin/inventory/export` | GET | Export inventory |
| `/api/admin/inventory/import` | POST | Import inventory |

### Users, Settings, Media, Locations, Discounts, Events, SEO

(Extensive admin endpoints — not critical for initial mobile app build, documented here for reference.)

### Email Marketing (Admin)

Full email campaign system with templates, mailing lists, automations, suppressions, brand kit, and analytics.

---

## Webhook & Cron Endpoints

### Webhooks

| Endpoint | Provider | Events |
|----------|----------|--------|
| `/api/webhooks/stripe` | Stripe | Payment intents, refunds |
| `/api/webhooks/square` | Square | Payments, refunds |
| `/api/webhooks/paypal` | PayPal | Orders, captures |
| `/api/webhooks/shopify` | Shopify | Order sync |
| `/api/webhooks/resend` | Resend | Email delivery events |

### Cron Jobs

| Endpoint | Description |
|----------|-------------|
| `/api/cron/abandoned-cart` | Send abandoned cart recovery emails |
| `/api/cron/dashboard-analysis` | Pre-compute dashboard analytics |
| `/api/cron/email-automation` | Process email automation workflows |
| `/api/cron/email-campaigns` | Send scheduled email campaigns |

---

## Database Schema Summary

### Core Models (Mobile-Relevant)

| Model | Key Fields | Mobile Use |
|-------|-----------|------------|
| **User** | id, email, name, role, phone, stripeCustomerId | Account, auth |
| **Address** | id, userId, type, firstName, lastName, street, city, state, zipCode | Shipping/billing |
| **Product** | id, name, slug, price, heatLevel, sku, inventory, images, isFeatured | Product catalog |
| **ProductVariant** | id, productId, name, type, price, sku | Size/flavor variants |
| **NutritionalInfo** | productId, servingSize, calories, fats, sodium, etc. | Product detail |
| **Category** | id, name, slug, description, image | Product filtering |
| **CartItem** | id, userId, productId, quantity | Shopping cart |
| **WishlistItem** | id, userId, productId | Wishlist |
| **Order** | id, orderNumber, status, paymentStatus, total, trackingNumber | Order history |
| **OrderItem** | orderId, productId, quantity, unitPrice, productName snapshot | Order line items |
| **Payment** | id, orderId, amount, status, provider, methodType | Payment records |
| **LoyaltyAccount** | userId, pointsBalance, lifetimePoints, tier | Loyalty program |
| **PointTransaction** | accountId, type, points, description | Points history |
| **LoyaltyReward** | name, pointsCost, rewardType, rewardValue | Redeemable rewards |
| **Review** | userId, productId, rating, title, comment, isVerified | Product reviews |
| **RetailLocation** | businessName, address, city, state, latitude, longitude | Store finder |
| **Recipe** | title, slug, description, ingredients, instructions | Recipe content |
| **GiftCertificate** | code, originalAmount, balance, recipientName | Gift certs |
| **DiscountCode** | code, type, value, maxUses, expiresAt | Promo codes |

### Key Enums

```
UserRole: CUSTOMER | ADMIN | DEVELOPER | STAFF | WHOLESALE | FUNDRAISER
HeatLevel: MILD | MEDIUM | HOT | EXTRA_HOT | FRUIT
OrderStatus: PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED
PaymentStatus: PENDING | PROCESSING | SUCCEEDED | PAID | FAILED | CANCELED | REFUNDED | PARTIALLY_REFUNDED
PaymentProvider: STRIPE | SQUARE | PAYPAL
LoyaltyTier: BRONZE | SILVER | GOLD | PLATINUM
StockStatus: IN_STOCK | LOW_STOCK | OUT_OF_STOCK | DISCONTINUED
```

---

## Mobile API Client Recommendations

### Priority 1 (MVP Launch)

These endpoints power the core shopping experience:

1. **Auth**: `/api/auth/[...nextauth]`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`
2. **Products**: `/api/products` (with query params), `/api/products/featured`, `/api/products/search`, `/api/products/[id]/recommendations`
3. **Cart**: `/api/cart` (GET, POST), `/api/cart/[id]` (PATCH, DELETE)
4. **Checkout**: `/api/checkout` (Stripe), `/api/checkout/calculate-shipping`, `/api/checkout/calculate-tax`, `/api/checkout/validate-discount`
5. **Orders**: `/api/orders` (GET), `/api/orders/[id]` (GET)
6. **Locations**: `/api/locations` (GET)

### Priority 2 (Post-MVP)

7. **Wishlist**: `/api/wishlist` (GET, POST, DELETE)
8. **Loyalty**: `/api/loyalty`, `/api/loyalty/rewards`, `/api/loyalty/redeem`
9. **Reviews**: `/api/reviews/google` (read-only for now)
10. **Recipes**: `/api/recipes`
11. **Gift Certificates**: `/api/gift-certificates/*`
12. **Square Payments**: `/api/checkout/square/*`
13. **PayPal Payments**: `/api/checkout/paypal/*`
14. **Account**: `/api/account/payment-methods`

### Priority 3 (Future)

15. **AI Chat**: `/api/ai-chat`
16. **Personalized Recs**: `/api/recommendations/personalized`
17. **Fundraiser Portal**: `/api/fundraiser-portal/*`
18. **Newsletter**: `/api/newsletter`

### Swift API Client Architecture

```
APIClient/
  APIClient.swift              -- URLSession singleton, cookie/token management
  APIError.swift               -- Error types matching backend error shapes
  Endpoints/
    AuthEndpoint.swift         -- Login, register, session, password reset
    ProductEndpoint.swift      -- Product catalog, search, recommendations
    CartEndpoint.swift         -- Cart CRUD
    CheckoutEndpoint.swift     -- Checkout flows (Stripe, Square, PayPal)
    OrderEndpoint.swift        -- Order history, detail
    LocationEndpoint.swift     -- Store finder
    WishlistEndpoint.swift     -- Wishlist management
    LoyaltyEndpoint.swift      -- Loyalty program
    GiftCertEndpoint.swift     -- Gift certificates
  Models/
    User.swift                 -- Matches session.user shape
    Product.swift              -- Matches product response
    CartItem.swift             -- Matches cart item response
    Order.swift                -- Matches order response
    Address.swift              -- Shipping/billing address
    LoyaltyAccount.swift       -- Loyalty data
    // ... mirrors all API response types
```

### Key Design Decisions

1. **Cookie-based auth**: NextAuth uses HTTP-only cookies. The iOS client should use `URLSession` with `HTTPCookieStorage` to automatically manage session cookies after login. Store cookies persistently across app launches.

2. **No bearer tokens**: The API does not use Authorization header tokens. All auth is cookie-based via NextAuth's JWT session cookie (`next-auth.session-token`).

3. **Decimal handling**: Backend returns `price` fields as `number` (already converted from Prisma Decimal). Swift client can use `Double` or `Decimal` for prices.

4. **Zod validation errors**: When the backend returns 400 with `{ error, details }`, the `details` field contains Zod's `flatten()` output with `fieldErrors` and `formErrors`.

5. **Rate limiting**: Many endpoints use `withRateLimit`. The iOS client should handle 429 responses with exponential backoff.

6. **Guest checkout**: The checkout endpoint supports guest checkout (no session required) but needs `customer.email` in the body. The cart endpoints require authentication.

---

## Apple Pay Integration Plan

### Current Payment Architecture

The backend uses a provider adapter pattern (`lib/payments`) with `getProvider(provider)` returning a unified `PaymentAdapter` interface:

```typescript
interface PaymentAdapter {
  createPayment(params): Promise<PaymentResult>
  createCustomer(email, name, metadata): Promise<CustomerResult>
  // ... capture, refund, etc.
}
```

### Apple Pay via Stripe

Stripe is the primary payment provider and already supports Apple Pay on the web via Stripe Elements. For the iOS app:

1. **Stripe iOS SDK** (`stripe-ios`) handles Apple Pay natively
2. The existing `/api/checkout` endpoint returns a `clientSecret` for a Stripe PaymentIntent
3. The iOS app can use `STPApplePayContext` to present the Apple Pay sheet and confirm the PaymentIntent with the `clientSecret`
4. No backend changes needed — the existing Stripe PaymentIntent flow works with Apple Pay out of the box

### Apple Pay via Square

Square also supports Apple Pay via their iOS SDK:

1. Use Square Mobile Payments SDK
2. The existing `/api/checkout/square/process-payment` accepts a `sourceId` — Apple Pay generates a nonce that can be passed as `sourceId`
3. Minimal backend changes needed

### Recommended Approach

1. **Phase 1**: Apple Pay via Stripe (zero backend changes, use existing `clientSecret` flow)
2. **Phase 2**: Apple Pay via Square (if POS/Square is the preferred provider)
3. **Phase 3**: Consider adding `APPLE_PAY` as a `methodType` on the `Payment` model for analytics tracking

### Required Capabilities

- Apple Pay merchant ID registered in Apple Developer Portal
- Stripe Dashboard: enable Apple Pay domain verification
- iOS app: add Apple Pay entitlement and `PKPaymentAuthorizationViewController` support

---

## Mobile Payment Implementation (Completed)

> Updated 2026-04-02 after implementing the payment integration layer.

### Architecture

The mobile payment layer is built on `@stripe/stripe-react-native` (v0.50.3) and uses Stripe's PaymentSheet for a unified card + Apple Pay experience.

### Files

| File | Purpose |
|------|---------|
| `lib/payments/stripe-config.ts` | Publishable key, merchant ID, Apple Pay constants |
| `lib/payments/StripeProvider.tsx` | Root wrapper initializing Stripe SDK with merchant ID + URL scheme |
| `lib/payments/index.ts` | Barrel exports |
| `hooks/useCheckout.ts` | Main checkout hook: creates session, initializes PaymentSheet, handles result |
| `hooks/useSquareCheckout.ts` | Square checkout hook (P2): two-step order + payment flow via sourceId |
| `app/checkout.tsx` | Checkout screen with shipping form, Apple Pay button, card payment |
| `app/_layout.tsx` | Updated to use centralized StripeProvider with Apple Pay merchant ID |

### Stripe Checkout Flow

```
User taps "Pay" → useCheckout.startCheckout(request)
  → POST /api/checkout (backend creates Order + Stripe PaymentIntent)
  ← { clientSecret, orderId, amount }
  → initPaymentSheet({ paymentIntentClientSecret: clientSecret, applePay: { merchantCountryCode } })
  → presentPaymentSheet() (shows card entry + Apple Pay option)
  ← User confirms payment
  → Stripe confirms PaymentIntent server-side via webhook
  → Show order confirmation
```

### Apple Pay Flow

Apple Pay is automatically available in PaymentSheet when:
1. `merchantIdentifier` is set on `<StripeProvider>` (set to `merchant.com.josemadridsalsa`)
2. `applePay.merchantCountryCode` is passed to `initPaymentSheet` (set to `US`)
3. Device supports Apple Pay (`isPlatformPaySupported()` returns true)
4. Running on a physical iOS device (not simulator)

No separate Apple Pay flow is needed -- PaymentSheet presents it as the primary option when available.

### Square Checkout Flow (P2)

```
User taps "Pay with Square"
  → Square Mobile Payments SDK tokenizes card → sourceId
  → POST /api/checkout/square/create-order (creates Order)
  ← { orderId }
  → POST /api/checkout/square/process-payment { sourceId, orderId }
  ← { success, orderId, orderNumber, squarePaymentId }
```

Square Apple Pay generates a nonce that is passed as `sourceId` -- same backend endpoint, no changes needed.

### Error Handling

- `ApiError` with status + Zod field errors for validation failures
- User cancellation (`Canceled` code) treated as non-error
- Network errors with exponential backoff retry (via `lib/api/client.ts`)
- User-friendly error messages displayed in the checkout UI

### Configuration Required Before Production

1. Replace `pk_test_placeholder` in `stripe-config.ts` with actual Stripe publishable key (ideally via `expo-constants` / app config)
2. Register `merchant.com.josemadridsalsa` in Apple Developer Portal
3. Verify Apple Pay domain in Stripe Dashboard
4. Add Apple Pay entitlement to the Xcode project
5. Test on physical iOS device (Apple Pay not available in simulator)
