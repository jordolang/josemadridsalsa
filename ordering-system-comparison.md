# Ordering System Comparison

**BigCommerce (josemadridsalsa.com) → Custom Next.js (josemadrid.net)**

*Prepared: May 28, 2026* *Goal: Migration planning — identify gaps in josemadrid.net so we can reach feature parity with the BigCommerce store before cutover to josemadridsalsa.com.*

---

## Executive Summary

The custom Next.js platform at **josemadrid.net** is, in most measurable ways, **already ahead of the BigCommerce storefront at josemadridsalsa.com** in business breadth — it natively owns fundraising, wholesale, POS, loyalty, and multi-channel publishing that BigCommerce offloads to external sites or paid apps. However, the BigCommerce storefront still beats the .net replacement on a handful of buyer-facing primitives and operational polish that customers will notice on day one: real-time multi-carrier shipping quotes at checkout, abandoned-cart automation that already works, a fully populated transactional-email matrix, a configurable mix-and-match bundle UX, and a battle-tested checkout. Closing those specific gaps is what stands between today and a confident DNS cutover.

The numbered gap analysis is in §6. The order process for each system is documented in §7.

---

## 1\. Platform fingerprint

|  | BigCommerce — josemadridsalsa.com | Next.js — josemadrid.net |
| :---- | :---- | :---- |
| Platform | BigCommerce Stencil (hosted SaaS) | Next.js 15 App Router on Vercel |
| Store identifier | CDN namespace `s-dsk4gx4` | Vercel project `jordolang/josemadridsalsa.git` |
| Database | BigCommerce-managed (opaque) | PostgreSQL via Prisma Accelerate (Neon) |
| Auth | BigCommerce native | NextAuth.js \+ Prisma adapter |
| Payments | Gateway-of-choice (admin-configured) | **Stripe** primary, **PayPal**, **Venmo**, **Cash App**, **Square** (incl. Square Terminal POS) |
| Tax | BigCommerce Tax / Avalara / TaxJar | Stripe Tax API (`txcd_30011000` food code) |
| Shipping | Native real-time rates (USPS, UPS, FedEx, DHL) \+ static/table | `lib/shipping-calculator.ts`, `lib/shipping-carriers.ts`, `@easypost/api` dep, `ShippingLabel` model |
| Email | BigCommerce transactional templates | Resend \+ React Email components |
| Admin | BigCommerce control panel | Custom `/admin` dashboard with RBAC (5 roles, 28 permissions) |
| PCI scope | Level 1 platform-certified; cards never touch storefront | Stripe Elements / hosted fields — same effective scope |
| Monitoring | BigCommerce internal | Sentry \+ Amplitude \+ Vercel Analytics |
| Source of truth | BigCommerce admin UI | Git repo \+ Prisma schema |

The .net side is a fully owned, code-defined stack. The BigCommerce side is a configurable hosted product.

---

## 2\. Data collected from buyers

### 2.1 BigCommerce — what the storefront captures

From the BigCommerce Optimized One-Page Checkout (OOPC) and account templates, the storefront collects:

- **Customer:** email, optional account (password, name)  
- **Shipping address:** first/last name, company (optional), address line 1, address line 2, city, country, state/province, postal code, phone  
- **Billing address:** "same as shipping" toggle or the same fields  
- **Shipping method:** one of the configured rates (selection only — the carrier/cost/ETA are merchant-side)  
- **Payment:** handled by the gateway via hosted fields; BigCommerce stores tokenized card metadata, not PANs  
- **Order-level:** terms-of-service checkbox (optional), marketing opt-in (optional), order comments / customer message (optional), gift wrap \+ gift message (per item if enabled), gift certificate code (optional), coupon code (optional)  
- **Per-product modifiers:** on the Choose-N bundles, three "Jar 1/2/3" dropdown selections plus a required "Order Notes" text field  
- **Reviews:** rating 1–5, name, email, subject, comments  
- **Gift certificate purchase form:** purchaser name+email, recipient name+email, amount, optional message, theme selection, T\&C checkbox  
- **Account creation extras:** if enabled, customer-group selection, custom form fields

### 2.2 josemadrid.net — what the storefront captures (from `prisma/schema.prisma` and checkout components)

- **User (`users` table):** `email`, `name`, `password` (hashed), `phone`, `dateOfBirth` (optional), `role`, `isEmailVerified`, `lastLoginAt`, `stripeCustomerId`  
- **Address (`addresses` table):** `type` (SHIPPING/BILLING), `firstName`, `lastName`, `company`, `street`, `city`, `state`, `zipCode`, `country` (default US), `phone`, `isDefault`  
- **Checkout form (`app/(public)/checkout/page.tsx`):** `firstName`, `lastName`, `email`, `phone`, `address1`, `address2`, `city`, `state`, `postalCode`, `notes`  
- **Order (`orders` table):** `orderNumber`, `userId` or `guestEmail` \+ `guestPhone`, `status`, `subtotal`, `shippingCost`, `tax`, `discountAmount`, `total`, `shippingMethod`, `trackingNumber`, `estimatedDelivery`, `actualDelivery`, `shippingLabelUrl`, `packingSlipUrl`, `invoiceUrl`, `paymentStatus`, `paymentMethod`, `stripePaymentId`, `customerNotes`, `adminNotes`, `fundraiserId`, `participantId`, `paymentChannel`, `paymentProvider`, plus Shopify sync metadata  
- **OrderItem:** `productId`, `quantity`, `unitPrice`, `totalPrice`, snapshotted `productName`, `productSku`, `productImage`  
- **Payment:** `stripePaymentIntentId`, `stripeCheckoutSessionId`, `paypalCaptureId`, `paypalOrderId`, `squarePaymentId`, `squareTerminalCheckoutId`, `provider`, `methodType`, `amount`, `currency`, `paidAt`  
- **GiftCertificate:** `code`, `originalAmount`, `balance`, `purchaserName/Email`, `recipientName/Email`, `theme`, `message`, `status`, `expiresAt`, `redeemedAt`  
- **DiscountCode \+ DiscountUsage:** code, type, value, max uses, used count, max uses per user, min purchase, start/expire dates, per-order usage records  
- **AbandonedCart:** `cartData` JSON, `recoveryToken`, `emailSent`, `emailSentAt`, `recoveredAt`  
- **WishlistItem, Review, SiteReview, LoyaltyAccount, FundraiserParticipant** (referral code), **WholesaleAccount** (taxId, resaleNumber, businessType, discountRate)  
- **Analytics events:** Amplitude session replay \+ Vercel Analytics  
- **Audit logs:** every admin mutation

**Verdict:** the .net data model is strictly a superset. There is no data field BigCommerce collects on this storefront that .net cannot collect.

---

## 3\. Data transmitted

### 3.1 …to the buyer (email)

| Email | BigCommerce (default) | josemadrid.net (in `emails/` \+ `lib/email/templates/`) |
| :---- | :---- | :---- |
| Account Created | ✅ template | ⚠️ Not in `/emails/` — relies on NextAuth verification, no branded welcome found |
| Account Details Changed | ✅ template | ❌ Not found |
| Password Reset | ✅ template | ✅ via `app/auth/reset-password` \+ NextAuth |
| Order Confirmation | ✅ template | ✅ `emails/order-confirmation.tsx` |
| Combined Order Status (Awaiting Payment / Fulfillment / Shipment / Pickup / Shipped / Cancelled / Refunded) | ✅ single template | ⚠️ Partial — shipping covered, refund/cancel/declined templates not found |
| Shipping Confirmation (with tracking) | ✅ part of combined | ✅ `emails/shipping-notification.tsx` \+ `lib/email/templates/shipping-notification.ts` |
| Delivery Confirmation | ❌ no native delivered status | ✅ `emails/delivery-confirmation.tsx` *(ahead of BC)* |
| Invoice | ✅ template \+ PDF link | ✅ `Order.invoiceUrl` \+ `app/admin/orders/[id]/invoice` |
| Order Message Notification | ✅ template (admin↔customer thread) | ⚠️ `Conversation`/`Message` tables exist; outbound email unclear |
| Order Ready for Pickup | ✅ template | ❌ Not found (POS exists but no pickup-ready notification) |
| Return Confirmation / Return Status | ✅ templates | ❌ No returns/RMA flow found |
| Gift Certificate Delivery | ✅ template | ⚠️ `app/(public)/gift-certificates/*` exists; recipient-delivery email template not in `/emails/` |
| Product Review Request | ✅ scheduled template | ❌ Not found (the reviews schema exists; trigger not found) |
| Abandoned Cart (up to 3 staged) | ✅ template \+ automation | ⚠️ `app/api/cron/abandoned-cart` \+ `app/api/cart/recover` exist; only 1 stage in template count |
| Refund issued | ✅ part of combined | ❌ Not found |
| Fundraiser donation receipt | ❌ N/A on BC | ✅ `emails/fundraiser-donation-receipt.tsx` *(ahead of BC)* |
| Contact form acknowledgment | ❌ N/A | ✅ `emails/contact-form.tsx` |

### 3.2 …to the business (operator)

| Notification | BigCommerce | josemadrid.net |
| :---- | :---- | :---- |
| New order alert to staff | ✅ Settings › Notifications | ✅ `emails/admin-new-order.tsx` |
| Low-stock alert | ✅ per-product threshold | ✅ `InventoryAlert` model \+ `app/api/admin/inventory/alerts` |
| Payment failure alert | ✅ | ✅ via Stripe webhook \+ `WebhookEvent` table |
| Abandoned cart visibility (admin list) | ✅ | ✅ `AbandonedCart` table \+ cron |
| Refund-issued audit | ✅ | ✅ `Refund` model \+ audit log |
| Customer message received | ✅ | ✅ `Conversation`/`Message` \+ `ChatThread` (live chat handoff) |
| Fundraiser sale event | ❌ N/A | ✅ `FundraiserSaleEvent` w/ reactions, replies, shields |
| Order Notification Rules engine | ❌ | ✅ `OrderNotificationSetting` \+ `OrderNotificationRule` |

---

## 4\. Buyer-facing features

| Feature | BigCommerce | josemadrid.net | Notes |
| :---- | :---: | :---: | :---- |
| Product catalog with filters | ✅ Shop By Price, Sort | ✅ heat-level filter \+ search \+ comparison | `/products` |
| Product detail (gallery, qty, reviews) | ✅ | ✅ |  |
| MSRP / Was / Now pricing tiers | ✅ in theme (unused on this store) | ✅ `price` \+ `compareAtPrice` |  |
| Variants | ✅ | ✅ `ProductVariant` |  |
| Configurable bundles (Choose-N) | ✅ native product options/modifiers | ⚠️ `/bundles/` route exists — **needs verification** that buyer can pick N specific jars with the same UX | **Highest-priority gap if not fully implemented.** Mix-and-Match is one of the BC store's top-4 SKUs. |
| Wishlist | ✅ multi-list, shareable | ✅ `WishlistItem` (single list, sharing unclear) |  |
| Compare products | ✅ | ❌ Not found |  |
| Cart | ✅ w/ shipping estimator, coupon, gift cert redeem, gift wrap | ✅ Zustand `lib/store/cart`; coupon \+ gift cert via `/api/checkout/*` | Gift wrap field not found |
| Guest checkout | ✅ | ✅ `Order.guestEmail` / `guestPhone` |  |
| Account dashboard | ✅ orders, addresses, payment methods, wishlist, returns | ✅ `/account/orders`, `/account/settings`, `/api/account/payment-methods` | Returns missing |
| Saved payment methods | ✅ via gateway | ✅ `account/payment-methods` route |  |
| Returns / RMA self-serve | ✅ native | ❌ Only `/refunds` static page |  |
| Gift certificates (buy / redeem / balance) | ✅ all three | ✅ `/gift-certificates/{purchase,balance,success}` \+ redemption |  |
| Loyalty points / store credit | ❌ requires app | ✅ `LoyaltyAccount`, `PointTransaction`, `LoyaltyReward`, `RewardRedemption` w/ tiers |  |
| Reviews | ✅ native Stencil | ✅ `Review` \+ `SiteReview` \+ moderation queue |  |
| Subscriptions (recurring orders) | ❌ requires app | ❌ Not in schema |  |
| Live chat | ❌ requires app | ✅ `ChatThread`, `ChatHandoffMessage` |  |
| Gift wrap / gift message at order | ✅ | ❌ Not in `Order` schema |  |
| Multi-ship-to one order | ✅ optional | ❌ One `shippingAddressId` per order |  |
| Newsletter signup | ✅ native subscriber list | ✅ `UnsubscribePreference`, plus full email-marketing module |  |
| Storefront search | ✅ fuzzy native | ✅ `/products/search` |  |

---

## 5\. Operator-facing features

| Feature | BigCommerce | josemadrid.net | Notes |
| :---- | :---: | :---: | :---- |
| Order management list/search/filter | ✅ | ✅ `/admin/orders` |  |
| Order edit, refund, cancel | ✅ | ✅ `/api/admin/orders/[id]/{refund,update-status,tracking,send-email}` |  |
| Batch print invoices / packing slips | ✅ | ✅ `/admin/orders/[id]/{invoice,packing-slip}` (per-order; batch?) |  |
| Order export CSV | ✅ | ✅ `/api/admin/orders/export` |  |
| Order import (migration) | ✅ | ✅ `/api/admin/orders/import` *(ahead — designed for the migration itself)* |  |
| Customer management \+ groups (for B2B pricing) | ✅ | ✅ `User.role`, `WholesaleAccount` |  |
| Product catalog \+ variants \+ bulk pricing | ✅ rich modifier engine | ✅ `Product` \+ `ProductVariant` | Modifier text fields (like "Order Notes" on Choose-N) need verification |
| Inventory tracking | ✅ \+ multi-location on higher tiers | ✅ `Product.inventory` \+ `stockReserved` \+ `stockStatus` \+ `InventoryTransaction` \+ `InventoryAlert` |  |
| Multi-location inventory | ✅ Pro+ | ⚠️ Single inventory column; locations table is store-locator only |  |
| Shipping zones \+ carrier connection | ✅ UI | ✅ `ShippingSettings` \+ `/api/admin/settings/shipping` |  |
| Tax setup | ✅ Avalara/TaxJar UI | ✅ Stripe Tax (less manual) \+ `/admin/financials/taxes` |  |
| Coupons / discounts engine | ✅ rich (% / $ / BOGO / free gift / category-restricted) | ✅ `DiscountCode` (type+value+min+per-user+window) — **BOGO / free-gift rules need verification** |  |
| Gift certificates | ✅ | ✅ `/admin/gift-certificates` |  |
| Banners / page builder | ✅ Stencil Page Builder | ⚠️ `/admin/content` exists; WYSIWYG sections unclear |  |
| Storefront theme editor | ✅ visual | ❌ Code-only (Tailwind \+ shadcn) | Intentional trade-off |
| Reports — Sales / Customers / Marketing / Abandoned Carts | ✅ | ✅ `/admin/analytics/orders`, `/admin/growth`, `/admin/financials` |  |
| Apps marketplace | ✅ 1,000+ | ❌ Build-it-yourself |  |
| REST \+ GraphQL APIs \+ webhooks | ✅ | ✅ Next.js route handlers \+ `WebhookEvent` model \+ `PartnerApiKey` |  |
| RBAC | ✅ tiered staff roles | ✅ 5 roles, 28 permissions |  |
| Audit logs | ⚠️ limited | ✅ `/admin/audit-logs` |  |
| Multi-storefront / channels | ✅ Pro+ (Channels) | ✅ via fundraiser subdomains \+ `ShopListing` for TikTok/Shopify |  |
| **Fundraising** | ❌ off-platform (`josemadridsalsafundraising.com`) | ✅ **full native portal** w/ subdomains, participants, referral codes, gamification, characters, championships, seasons, share events, shields | *Ahead of BC* |
| **Wholesale** | ❌ off-platform (Faire) | ✅ native `WholesaleAccount` \+ `/admin/wholesale` | *Ahead of BC* |
| **POS / in-person** | ✅ BigCommerce for POS \+ Square integrations | ✅ `/pos/*` \+ Square Terminal via `/api/pos/create-terminal-checkout` |  |
| **Forms builder** | ❌ static | ✅ `/api/forms/*` \+ versioning | *Ahead of BC* |
| **Financials (expenses, payroll, taxes)** | ❌ | ✅ `/admin/financials/{expenses,payroll,taxes}` | *Ahead of BC* |
| Email marketing automations | ❌ requires app (Klaviyo etc.) | ✅ `/admin/email-marketing/automations` \+ `/admin/communications/suppressions` | *Ahead of BC* |
| Social shop listings (Shopify / TikTok) | ⚠️ via channels | ✅ `ShopListing` w/ status, error tracking, per-channel overrides | *Ahead of BC* |

---

## 6\. Gap analysis — what josemadrid.net still needs before cutover

Ordered by **migration risk** (highest first).

### 🔴 Migration-blocking (do before DNS cutover)

1. **Mix-and-Match / Choose-N configurator parity.** On BC, `/choose-3-with-gift-box/`, `/choose-5/`, `/choose-6/`, `/choose-12/` are four of the highest-revenue SKUs and use native modifiers (3–12 dropdowns \+ required "Order Notes" text). The .net `/bundles/` page exists but I did not confirm the buyer can pick N specific jars with the same UX. **Action:** open `/bundles/` and a sample bundle product detail, confirm dropdowns \+ per-bundle order-notes field; if missing, prioritize building the configurator.  
     
2. **Real-time shipping rates at checkout.** BC quotes USPS/UPS/FedEx live; .net has `@easypost/api` installed and `ShippingSettings.enabledCarriers` but `app/(public)/checkout/page.tsx` defines `ShippingOption[]` as something selected from a list. **Action:** verify EasyPost is actually quoting live rates at checkout (`lib/shipping-calculator.ts`), not falling back to a flat rate. If flat-rate only, buyers will see different prices on day one.  
     
3. **Complete the transactional-email matrix.** Missing on .net vs. BC: account-created welcome, account-details-changed, refund-issued, cancellation, order-status (cancelled/declined), order-ready-for-pickup, product-review-request, gift-certificate-delivery (recipient). **Action:** add React Email components mirroring BC's `Combined Order Status` template (one template, multiple status branches).  
     
4. **Abandoned cart — full 3-email sequence.** BC sends up to 3 staged emails (typical cadence 1h / 24h / 48h). .net has `app/api/cron/abandoned-cart` and recovery tokens — verify the cron sends more than one email per cart, and that the recovery URL pre-fills the cart.  
     
5. **Returns / RMA self-serve.** BC has a customer-facing "Request Return" flow tied to past orders. .net has `/refunds` (static FAQ) and admin `/api/admin/orders/[id]/refund`, but no buyer-initiated return UI. **Action:** add `/account/orders/[id]/return` with reason codes, item-level selection, and RMA tracking — or accept "email us" as the policy and update the page copy.  
     
6. **Gift wrap \+ gift message at order level.** BC offers gift wrap (per-item or per-order) with an optional gift message. .net `Order` schema has `customerNotes` only. **Action:** decide if this is in scope; if so, add `giftWrap`, `giftMessage` to `Order` (and per-item if needed) and surface in cart \+ checkout \+ admin.  
     
7. **Combined Order Status notifications.** When admin changes order status to Cancelled, Refunded, Declined, or On Hold, BC auto-fires an email. .net's `/api/admin/orders/[id]/update-status` should trigger the right Resend template — verify the wiring.

### 🟡 Polish before cutover

8. **Compare products.** BC has a Compare tool on every product card. .net has no equivalent — low-traffic feature, but visible on the old store.  
     
9. **Multi-ship-to one order.** BC allows one cart to ship to multiple addresses (useful for fundraiser gift orders). .net has one `shippingAddressId` per order.  
     
10. **Wishlist sharing.** BC lets shoppers share a wishlist URL. .net's `WishlistItem` is single-list per user.  
      
11. **Batch printing.** BC lets admins select 50 orders and print packing slips. .net has per-order pages — confirm the admin/orders page can batch-print.  
      
12. **Storefront search faceting.** BC has fuzzy native search; .net has `/products/search`. Verify it indexes ingredients and heat level the way buyers expect.  
      
13. **Stencil Page Builder analogue.** BC marketers can drop banners onto pages without code. The .net `/admin/content` route exists — verify what it lets non-developers edit.  
      
14. **Subscriptions / recurring orders.** Neither system has it natively today (BC requires an app). Decide if it's a future bet.

### 🟢 Already at parity or ahead

The .net side already beats BigCommerce on: native fundraising portal, native wholesale, native loyalty, multi-channel publishing (TikTok/Shopify), Square Terminal POS, live chat, audit logs, forms builder, expense/payroll/tax tracking, email marketing automations, and order-import infrastructure (which exists *specifically* to migrate the BC catalog and history into .net).

### Open verification questions (for Jordan to confirm)

- Does `/bundles/[slug]/` reproduce the BC Choose-N picker (N dropdowns \+ Order Notes)?  
- Does checkout actually call EasyPost for live rates, or fall back to flat?  
- What's the BigCommerce-side active payment gateway? (admin: Settings › Payments) — drives the buyer-facing fee structure and whether ACH/AmazonPay need to be added on .net.  
- Is the newsletter on BC writing to Mailchimp/Klaviyo or just BC's internal subscriber list? — drives whether contact history must be exported before cutover.  
- Are there any BC apps installed (admin: Apps › My Apps) that have business-critical workflows (e.g. ShipStation, QuickBooks)?

---

## 7\. End-to-end order process — side by side

### 7.1 BigCommerce — josemadridsalsa.com

1\. Browse                Buyer lands on /our-salsas/, /purchase-salsa/, or category

                         BC serves Stencil-rendered HTML; search powered by BC native fuzzy search

2\. Product detail        /\<slug\>/  — gallery, qty, options/modifiers (for Choose-N: 3 dropdowns \+ Order Notes), reviews

                         "Add to Cart" → cart.php?action=add\&product\_id=NNN

3\. Cart                  /cart.php (JS-rendered widget)

                         Items, shipping estimator (country/state/zip), coupon, gift-cert, gift-wrap, proceed

4\. Optimized One-Page Checkout (all on one URL, collapsible sections)

                         a. Customer:  email \+ "guest" or "sign in"

                         b. Shipping address: full address, phone, "save this address"

                         c. Shipping method: list of real-time carrier rates (USPS/UPS/FedEx) w/ ETAs

                         d. Billing address: same-as-shipping toggle

                         e. Payment: hosted card fields via gateway \+ PayPal/Apple Pay/Google Pay express

                         f. Order review: terms, marketing opt-in, order comments, Place Order

5\. Payment processing    Gateway tokenizes card → BC creates Order in status "Awaiting Payment"

                         Webhook from gateway → BC marks Order "Awaiting Fulfillment"

6\. Confirmation          BC fires the Order Confirmation email (templated)

                         Customer sees /finishorder/?o=ID or similar success page

7\. Fulfillment           Admin works the order in BC control panel:

                         \- prints invoice \+ packing slip (batch supported)

                         \- adds tracking, marks Shipped → BC fires Combined Order Status email w/ tracking

                         \- Inventory auto-decrements; low-stock alert if threshold crossed

8\. Post-order            Abandoned-cart emails (if cart wasn't completed): 1h / 24h / 48h staged

                         Product review request scheduled N days post-delivery

                         Returns: customer requests via /account.php → admin issues refund → email fires

9\. Reporting             BC Reports: Orders, Customers, Marketing, Abandoned Carts, Tax (CSV export)

### 7.2 josemadrid.net — Next.js

1\. Browse                Next.js RSC renders /products (with heat filter), /salsas/\<slug\>, /merchandise

                         Search via /products/search; Amplitude tracks events

2\. Product detail        /salsas/\<slug\> — gallery, qty, variants, reviews

                         "Add to Cart" → Zustand store (lib/store/cart) — client-side, then synced to Prisma CartItem when logged in

3\. Cart                  Cart sheet/modal driven by Zustand; persisted server-side in CartItem for logged-in users

                         Coupon validation: /api/checkout/validate-discount

                         Gift cert redemption: /api/checkout/apply-gift-certificate

4\. Checkout              /checkout (single page, client-rendered)

                         a. Form state: firstName, lastName, email, phone, address1/2, city, state, postalCode, notes

                         b. Tax calc: POST /api/checkout/calculate-tax  →  lib/tax-calculator → Stripe Tax API

                         c. Shipping calc: lib/shipping-calculator (EasyPost) returns ShippingOption\[\] w/ method/cost/ETA

                         d. Payment method selector: Card (Stripe) | PayPal | Venmo | Cash App | (Square)

                         e. Submit:

                            • Card → Stripe Elements → POST /api/checkout/create-session (Checkout Session)

                              → redirect to Stripe-hosted page → success\_url=/checkout/success

                            • PayPal → /api/checkout/paypal/create-order then /capture-order

                            • Square → /api/checkout/square/{create-order,process-payment}

                         f. Referral code (fundraiser): pulled from cookie via lib/fundraising/referral-tracker.client

5\. Payment processing    Stripe webhook → /api/webhooks/stripe → marks Payment SUCCEEDED, Order PROCESSING

                         (PayPal → /api/webhooks/paypal; Square → /api/webhooks/square)

                         lib/inventory-manager deducts reservedInventory in transaction, fires InventoryAlert if low

6\. Confirmation          POST /api/checkout/complete finalizes; Resend sends:

                         \- emails/order-confirmation.tsx to buyer

                         \- emails/admin-new-order.tsx to staff

                         \- emails/fundraiser-donation-receipt.tsx if attributed

                         Customer lands on /checkout/success?session\_id=...

7\. Fulfillment           Admin works the order in /admin/orders:

                         \- /admin/orders/\[id\]/invoice  (PDF/HTML)

                         \- /admin/orders/\[id\]/packing-slip

                         \- PUT /api/admin/orders/\[id\]/tracking adds tracking

                         \- PUT /api/admin/orders/\[id\]/update-status (PROCESSING→SHIPPED→DELIVERED)

                         \- Resend fires shipping-notification \+ delivery-confirmation

                         \- Audit logged

8\. Post-order            /api/cron/abandoned-cart runs Vercel cron → email via recovery token

                         (Note: gap above — confirm multi-stage, not single email)

                         Returns: no buyer-initiated flow; admin processes via /api/admin/orders/\[id\]/refund

9\. Reporting             /admin/analytics/orders, /admin/growth, /admin/financials

                         Amplitude session replay; Sentry for errors

10\. Multi-channel        Orders attributed via Order.fundraiserId \+ participantId

                          ShopListing syncs catalog to TikTok / Shopify / others (status, last sync, error)

                          POS orders via /pos/\* \+ Square Terminal

---

## 8\. Migration cutover plan (suggested)

1. **Lock the catalog on BC.** Stop catalog edits. Export Products, Customers, Orders, Gift Certificates, Discount Codes as CSV.  
2. **Import via .net's existing pipeline.** `/api/admin/orders/import`, `/api/admin/inventory/import`, `npm run products:transform` — these are already built for this purpose.  
3. **Close the 🔴 gaps in §6.** Mix-and-Match configurator, real-time shipping, email matrix completion, abandoned-cart sequence, returns or policy update, gift-wrap (or scope cut), status-change emails.  
4. **Soft-launch:** route a fraction of traffic via `josemadrid.net`; keep BC live. Compare conversion \+ AOV.  
5. **DNS cutover:** point `josemadridsalsa.com` to Vercel. Redirect `/cart.php`, `/login.php`, `/giftcertificates.php`, `/<slug>/` (BC slugs) → `/products`, `/auth/signin`, `/gift-certificates/purchase`, `/salsas/<slug>` respectively in `next.config.mjs`.  
6. **Decommission BC** after 30-day grace period (during which you can still pull historical reports from BC).

---

## 9\. Confirmed facts vs. assumptions

**Confirmed (from code or live page sources):**

- All Prisma models and fields cited  
- All file paths cited  
- Stripe is the primary processor; PayPal, Venmo, Cash App, Square Terminal all wired  
- Tax via Stripe Tax (`txcd_30011000`)  
- BigCommerce platform meta, store CDN namespace, footer, gift-cert tabs, Choose-N modifiers, fundraising/wholesale being off-platform — all directly observed  
- BigCommerce email/feature defaults — from official BC support docs

**Assumptions to verify (Jordan, please confirm in BC admin or the .net code):**

- BC's active payment gateway and methods exposed at checkout  
- BC's connected apps (My Apps list)  
- Whether `/bundles/[slug]/` on .net replicates the Choose-N picker  
- Whether checkout actually calls EasyPost for live rates  
- Whether the abandoned-cart cron sends multi-stage emails  
- Whether status-change handlers in `/api/admin/orders/[id]/update-status` fire the appropriate Resend template per status

---

*End of report.*  
