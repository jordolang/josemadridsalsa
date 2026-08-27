# Stripe Payment Integration Documentation

Welcome to the Stripe integration documentation for Jose Madrid Salsa. This directory contains comprehensive guides for understanding and working with our Stripe payment implementation.

## 📚 Documentation Overview

### Quick Start

1. **[Current Implementation](./current-implementation.md)** ⭐ **START HERE**
   - Overview of our current Stripe integration
   - Architecture and data flow
   - API endpoints and database schema
   - Testing and troubleshooting

2. **[Comprehensive Stripe Guide](./stripe-checkout-comprehensive-guide.md)**
   - Official Stripe documentation reference
   - All available integration patterns
   - Alternative approaches and comparisons
   - Testing strategies and best practices

3. **[Webhook Setup Guide](../STRIPE_WEBHOOK_SETUP.md)**
   - Webhook configuration and testing
   - Event handling details
   - Local development setup
   - Production deployment

## 🏗️ Our Implementation

Jose Madrid Salsa uses a **custom Payment Element integration** with:

- ✅ Server-side PaymentIntent creation
- ✅ Webhook-based order fulfillment
- ✅ Real-time tax and shipping calculation
- ✅ Gift certificate support
- ✅ Discount code validation
- ✅ Guest checkout
- ✅ Email automation

**Integration Pattern**: Payment Intents API with Payment Element

## 🔑 Key Files

### Backend (API Routes)
```
app/api/checkout/route.ts              # Main checkout endpoint
app/api/webhooks/stripe/route.ts       # Webhook handler
app/api/gift-certificates/purchase/    # Gift certificate flow
lib/stripe.ts                          # Stripe client initialization
lib/tax-calculator.ts                  # Tax calculation logic
lib/shipping-calculator.ts             # Shipping calculation logic
```

### Frontend
```
app/(public)/checkout/page.tsx         # Checkout page component
components/store/CheckoutForm.tsx      # Payment form (if exists)
```

### Configuration
```
.env.local                             # Environment variables
prisma/schema.prisma                   # Database models
```

## 🚀 Quick Reference

### Environment Variables

```env
STRIPE_PUBLISHABLE_KEY=pk_test_...     # Frontend (public)
STRIPE_SECRET_KEY=sk_test_...          # Backend (secret)
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook verification
```

> ⚠️ **SECURITY WARNING**: The examples above show test keys. **NEVER commit actual API keys to version control**. Always use environment variables and add `.env.local` to your `.gitignore`.

### Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | ✅ Success |
| 4000 0025 0000 3155 | 🔐 3D Secure Required |
| 4000 0000 0000 9995 | ❌ Declined |

### API Endpoints

```
POST /api/checkout                     # Create order + payment
POST /api/webhooks/stripe              # Process payment events
POST /api/checkout/calculate-tax       # Real-time tax
POST /api/checkout/calculate-shipping  # Real-time shipping
```

## 📖 Reading Guide

### For Developers New to the Project

1. Read [Current Implementation](./current-implementation.md) to understand what we have
2. Review the webhook setup in [STRIPE_WEBHOOK_SETUP.md](../STRIPE_WEBHOOK_SETUP.md)
3. Look at the code files listed above
4. Test the integration using test cards

### For Exploring Alternative Approaches

1. Review [Current Implementation](./current-implementation.md) first
2. Read [Comprehensive Stripe Guide](./stripe-checkout-comprehensive-guide.md)
3. Compare patterns in the "Integration Pattern Comparison" section
4. Discuss with team before making changes

### For Troubleshooting

1. Check the "Troubleshooting" section in [Current Implementation](./current-implementation.md)
2. Review webhook logs in Stripe Dashboard
3. Check application logs in Vercel
4. Test locally using Stripe CLI

## 🔧 Local Development Setup

### 1. Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Other platforms
# See: https://stripe.com/docs/stripe-cli
```

### 2. Login to Stripe

```bash
stripe login
```

### 3. Forward Webhooks Locally

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 4. Test Webhook Events

```bash
# Trigger a successful payment
stripe trigger payment_intent.succeeded

# Trigger a failed payment
stripe trigger payment_intent.payment_failed
```

### 5. Run the Application

```bash
npm run dev
# Visit http://localhost:3000/checkout
```

## 📊 Stripe Dashboard

**Test Mode**: https://dashboard.stripe.com/test
**Production**: https://dashboard.stripe.com

### Key Dashboard Sections

- **Payments** - View all transactions
- **Customers** - Customer records (if used)
- **Products** - Product catalog (if used)
- **Webhooks** - Webhook endpoint configuration
- **Developers > API Keys** - Get API keys
- **Developers > Webhooks** - Manage webhook endpoints
- **Settings > Payment Methods** - Enable/disable payment methods

## 🔐 Security Checklist

- [x] Webhook signatures verified
- [x] API keys stored in environment variables
- [x] Amounts calculated server-side
- [x] HTTPS enforced in production
- [x] PCI compliance (using Stripe Elements)
- [x] Rate limiting on API endpoints
- [x] Input validation with Zod schemas
- [x] Error logging and monitoring

## 📈 Monitoring

### Metrics to Watch

- Payment success rate (should be > 95%)
- Average payment processing time
- Webhook delivery latency
- Failed webhook delivery count
- Customer payment errors

### Where to Find Metrics

- **Stripe Dashboard** - Payment analytics
- **Vercel Logs** - Application logs
- **Database** - Order status history
- **Email** - Stripe daily summaries

## 🎯 Common Tasks

### Add a New Payment Method

1. Enable in [Stripe Dashboard](https://dashboard.stripe.com/settings/payment_methods)
2. Update `automatic_payment_methods` config if needed
3. Test with Stripe test cards
4. Deploy and verify in production

### Update Stripe API Version

1. Review [Stripe API changelog](https://stripe.com/docs/upgrades)
2. Update `apiVersion` in `lib/stripe.ts`
3. Update `@types/stripe` package
4. Test all payment flows
5. Deploy

### Add Webhook Event Handler

1. Add event type to `app/api/webhooks/stripe/route.ts`
2. Implement handler logic
3. Test with `stripe trigger <event_type>`
4. Update webhook endpoint in Dashboard if needed

## 🆘 Support

### Internal Resources

- **Code Owner**: See CODEOWNERS file
- **Documentation**: This directory
- **Previous Issues**: Check git commit history

### External Resources

- **Stripe Support**: https://support.stripe.com
- **Stripe Docs**: https://stripe.com/docs
- **Stripe Status**: https://status.stripe.com
- **Community**: https://github.com/stripe

## 📝 Contributing

When making changes to the Stripe integration:

1. Create a feature branch
2. Update relevant documentation
3. Add tests for new functionality
4. Test locally with Stripe CLI
5. Test in Stripe test mode
6. Get code review
7. Deploy to staging first
8. Monitor Stripe Dashboard after deployment

## 🔄 Updates

This documentation is maintained as part of the Jose Madrid Salsa codebase.

**Last Updated**: January 2026
**Stripe SDK Version**: Latest (via package.json)
**Stripe API Version**: 2025-10-29.clover

---

## Quick Links

- 🏠 [Main Documentation](../README.md)
- 📧 [Email Setup](../env-setup.md)
- 🔧 [Project Status](../PROJECT_STATUS.md)

