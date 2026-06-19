# Stripe Checkout - Comprehensive Integration Guide

> **Note**: This is the official Stripe documentation for accepting payments. For Jose Madrid Salsa's specific implementation, see [current-implementation.md](./current-implementation.md).

# Accept a payment

Securely accept payments online.

Build a payment form or use a prebuilt checkout page to start accepting online payments.

> #### Not a developer?
>
> Use Stripe's [no-code options](https://docs.stripe.com/no-code.md) or apps from [our partners](https://stripe.partners/) to get started and do more with your Stripe account—no code required. If you use a third-party platform to build and maintain a website, you can add Stripe payments with a plugin.

## Table of Contents

1. [Stripe-hosted page](#stripe-hosted-page)
2. [Embedded form](#embedded-form)
3. [Checkout Sessions API](#checkout-sessions-api)
4. [Payment Intents API](#payment-intents-api)
5. [Mobile Integrations](#mobile-integrations)

---

# Stripe-hosted page

> This is a Stripe-hosted page for when payment-ui is checkout and ui is stripe-hosted. View the full page at https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted.

Redirect to a Stripe-hosted payment page using [Stripe Checkout](https://docs.stripe.com/payments/checkout.md). See how this integration [compares to Stripe's other integration types](https://docs.stripe.com/payments/online-payments.md#compare-features-and-availability).

#### Integration effort
Complexity: 2/5
#### Integration type

Redirect to Stripe-hosted payment page

#### UI customization
Limited customization
- 20 preset fonts
- 3 preset border radius
- Custom background and border color
- Custom logo

[Try it out](https://checkout.stripe.dev/)

Use our official libraries to access the Stripe API from your application:

#### Node.js

```bash
# Install with npm
npm install stripe --save
```

## Redirect your customer to Stripe Checkout [Client-side] [Server-side]

Add a checkout button to your website that calls a server-side endpoint to create a [Checkout Session](https://docs.stripe.com/api/checkout/sessions/create.md).

You can also create a Checkout Session for an [existing customer](https://docs.stripe.com/payments/existing-customers.md?platform=web&ui=stripe-hosted), allowing you to prefill Checkout fields with known contact information and unify your purchase history for that customer.

```html
<html>
  <head>
    <title>Buy cool new product</title>
  </head>
  <body>
    <!-- Use action="/create-checkout-session.php" if your server is PHP based. -->
    <form action="/create-checkout-session" method="POST">
      <button type="submit">Checkout</button>
    </form>
  </body>
</html>
```

A Checkout Session is the programmatic representation of what your customer sees when they're redirected to the payment form. You can configure it with options such as:

- [Line items](https://docs.stripe.com/api/checkout/sessions/create.md#create_checkout_session-line_items) to charge
- Currencies to use

You must populate `success_url` with the URL value of a page on your website that Checkout returns your customer to after they complete the payment.

> Checkout Sessions expire 24 hours after creation by default.

After creating a Checkout Session, redirect your customer to the [URL](https://docs.stripe.com/api/checkout/sessions/object.md#checkout_session_object-url) returned in the response.

#### Node.js

```javascript
// This example sets up an endpoint using the Express framework.

const express = require('express');
const app = express();
const stripe = require('stripe')('<<YOUR_SECRET_KEY>>')

app.post('/create-checkout-session', async (req, res) => {const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'T-shirt',
          },
          unit_amount: 2000,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: 'http://localhost:4242/success',
  });

  res.redirect(303, session.url);
});

app.listen(4242, () => console.log(`Listening on port ${4242}!`));
```

### Payment methods

By default, Stripe enables cards and other common payment methods. You can turn individual payment methods on or off in the [Stripe Dashboard](https://dashboard.stripe.com/settings/payment_methods). In Checkout, Stripe evaluates the currency and any restrictions, then dynamically presents the supported payment methods to the customer.

To see how your payment methods appear to customers, enter a transaction ID or set an order amount and currency in the Dashboard.

You can enable Apple Pay and Google Pay in your [payment methods settings](https://dashboard.stripe.com/settings/payment_methods). By default, Apple Pay is enabled and Google Pay is disabled. However, in some cases Stripe filters them out even when they're enabled. We filter Google Pay if you [enable automatic tax](https://docs.stripe.com/tax/checkout.md) without collecting a shipping address.

Checkout's Stripe-hosted pages don't need integration changes to enable Apple Pay or Google Pay. Stripe handles these payments the same way as other card payments.

For more details on this integration pattern, see the full documentation sections below.

---

# Additional Integration Patterns

This document contains comprehensive documentation for multiple Stripe integration approaches:

1. **Stripe-hosted Checkout** - Redirect customers to Stripe's hosted payment page
2. **Embedded Checkout** - Embed Stripe's checkout form on your site
3. **Custom Checkout (Payment Element)** - Build fully custom checkout experiences
4. **Mobile SDKs** - Native iOS, Android, and React Native integrations

## Current Jose Madrid Salsa Implementation

Our project currently uses a **hybrid approach** combining:
- Custom checkout UI with Stripe PaymentIntent API
- Server-side checkout session creation
- Webhook-based order fulfillment
- Tax and shipping calculation integration

For details on our specific implementation, see:
- [Current Implementation Guide](./current-implementation.md)
- [Webhook Setup Guide](../STRIPE_WEBHOOK_SETUP.md)

## Reference Links

- **Stripe Dashboard**: https://dashboard.stripe.com
- **API Documentation**: https://docs.stripe.com/api
- **Testing Guide**: https://docs.stripe.com/testing
- **Webhook Guide**: https://docs.stripe.com/webhooks

---

## Test Cards

For testing your integration:

| Card Number | Scenario | Details |
|-------------|----------|---------|
| 4242 4242 4242 4242 | Success | Payment succeeds without authentication |
| 4000 0025 0000 3155 | 3D Secure | Requires authentication |
| 4000 0000 0000 9995 | Decline | Card declined with insufficient_funds |

Use any future expiration date, any 3-digit CVC, and any postal code.

---

## Security Notes

- Always validate amounts server-side
- Never expose secret keys in client code
- Verify webhook signatures
- Use HTTPS in production
- Handle PCI compliance properly

---

For the complete, detailed documentation of all integration patterns, please refer to the original Stripe documentation at https://docs.stripe.com/payments/accept-a-payment
