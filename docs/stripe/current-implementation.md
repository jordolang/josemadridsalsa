# Jose Madrid Salsa - Stripe Integration Overview

## Implementation Summary

Jose Madrid Salsa uses a **custom Payment Element integration** with server-side PaymentIntent creation and webhook-based order fulfillment. This implementation provides maximum flexibility while maintaining security and reliability.

## Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Customer  │────────▶│   Next.js    │────────▶│   Stripe    │
│   Browser   │◀────────│   Frontend   │◀────────│     API     │
└─────────────┘         └──────────────┘         └─────────────┘
                               │                         │
                               │                         │
                               ▼                         ▼
                        ┌──────────────┐         ┌─────────────┐
                        │  PostgreSQL  │         │   Webhook   │
                        │   Database   │◀────────│   Handler   │
                        └──────────────┘         └─────────────┘
```

## Current Implementation Details

### 1. Payment Flow

**File**: `app/api/checkout/route.ts` (287 lines)

```typescript
// Current checkout process:
1. Calculate tax using Stripe Tax API
2. Calculate shipping costs
3. Create Stripe PaymentIntent
4. Create Order record (status: PENDING)
5. Return client secret to frontend
6. Frontend confirms payment with Stripe
7. Webhook updates order status on success
```

**Key Features:**
- ✅ Real-time tax calculation (food/beverage tax code)
- ✅ Dynamic shipping calculation
- ✅ Discount code validation
- ✅ Gift certificate application
- ✅ Guest checkout support
- ✅ Abandoned cart recovery

### 2. Stripe Configuration

**File**: `lib/stripe.ts` (24 lines)

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
  typescript: true,
});
```

**Environment Variables:**
```env
STRIPE_PUBLISHABLE_KEY=pk_test_...  # Public key for frontend
STRIPE_SECRET_KEY=sk_test_...       # Secret key for backend
STRIPE_WEBHOOK_SECRET=whsec_...     # Webhook signature verification
```

### 3. Webhook Integration

**File**: `app/api/webhooks/stripe/route.ts` (164 lines)

**Handled Events:**
- `payment_intent.succeeded` - Confirms order, sends confirmation email, decrements inventory
- `payment_intent.payment_failed` - Marks payment as failed
- `payment_intent.canceled` - Cancels order

**Security Features:**
- ✅ Webhook signature verification
- ✅ Idempotent event handling (safe to retry)
- ✅ Database transactions for atomicity
- ✅ Error logging and monitoring

### 4. Frontend Integration

**File**: `app/(public)/checkout/page.tsx`

**Technologies:**
- `@stripe/stripe-js` - Stripe.js loader
- `@stripe/react-stripe-js` - React components
- Stripe Elements - Secure card input

**Components:**
- CardElement for payment details
- Real-time validation
- Error handling and display
- Loading states

### 5. Additional Features

#### Gift Certificates
**File**: `app/api/gift-certificates/purchase/route.ts`

- Separate payment flow for gift certificates
- Balance tracking
- Application to orders

#### Tax Calculation
**File**: `lib/tax-calculator.ts`

- Integrates with Stripe Tax API
- Food/beverage tax category
- Real-time calculation based on shipping address

#### Shipping Calculator
**File**: `lib/shipping-calculator.ts`

- Weight-based calculation
- Destination-based rates
- Integration with checkout flow

## Integration Pattern Comparison

Our implementation is closest to the **Payment Intents API with Payment Element** pattern from the comprehensive guide.

### Why This Pattern?

✅ **Full control** over checkout UI/UX
✅ **Flexible** business logic integration
✅ **Tax and shipping** calculated server-side
✅ **Inventory management** integrated
✅ **Email automation** on payment success
✅ **Shopify sync** for multi-channel inventory

### Comparison to Other Patterns

| Pattern | Pros | Cons | Our Choice |
|---------|------|------|------------|
| **Stripe Checkout** | Quick setup, hosted by Stripe | Less customization, redirect required | ❌ Need more control |
| **Embedded Checkout** | No redirect, some customization | Limited business logic integration | ❌ Need full control |
| **Payment Element** | Full control, flexible | More code to maintain | ✅ **CURRENT** |

## API Endpoints

### Checkout Endpoints

```
POST   /api/checkout                      # Create order + payment intent
POST   /api/checkout/complete             # Completion callback
POST   /api/checkout/calculate-tax        # Real-time tax estimation
POST   /api/checkout/calculate-shipping   # Real-time shipping estimation
POST   /api/checkout/validate-discount    # Discount code validation
POST   /api/checkout/apply-gift-certificate # Gift certificate application
```

### Webhook Endpoints

```
POST   /api/webhooks/stripe               # Stripe event handler
```

### Gift Certificate Endpoints

```
POST   /api/gift-certificates/purchase    # Purchase gift certificate
POST   /api/gift-certificates/complete    # Completion callback
GET    /api/gift-certificates/balance     # Check balance
```

## Database Schema

### Key Models

```prisma
model Order {
  id                String   @id @default(cuid())
  orderNumber       String   @unique
  total             Decimal
  subtotal          Decimal
  tax               Decimal
  shipping          Decimal
  status            OrderStatus
  paymentStatus     PaymentStatus
  stripePaymentId   String?
  customerId        String?
  // ... more fields
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
  CANCELLED
}
```

## Testing

### Test Cards

```
4242 4242 4242 4242 - Success (no authentication)
4000 0025 0000 3155 - Success (requires 3D Secure)
4000 0000 0000 9995 - Declined (insufficient funds)
```

### Test Endpoints

```bash
# Create test payment
curl -X POST https://josemadrid.net/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"items": [...], "shippingAddress": {...}}'

# Test webhook locally (requires Stripe CLI)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger payment_intent.succeeded
```

## Security Considerations

### Current Security Measures

✅ **Server-side validation** - All amounts calculated server-side
✅ **Webhook signatures** - Verified on every webhook call
✅ **Environment variables** - Secrets never exposed to client
✅ **HTTPS only** - All production traffic encrypted
✅ **PCI compliance** - Using Stripe Elements (PCI-DSS SAQ A)
✅ **Rate limiting** - API routes protected
✅ **Input validation** - Zod schemas on all inputs

## Monitoring & Analytics

### Current Monitoring

- **Stripe Dashboard** - Payment analytics and monitoring
- **Vercel Logs** - Application logs and errors
- **Sentry** - Error tracking (if configured)
- **Database logs** - Order and payment history

### Key Metrics Tracked

- Payment success rate
- Average order value
- Tax collected
- Shipping costs
- Failed payment reasons
- Webhook processing latency

## Future Enhancements

### Potential Improvements

1. **Apple Pay / Google Pay** - Add digital wallet support
2. **Subscription Support** - Recurring orders
3. **Installment Payments** - Buy now, pay later (Klarna, Afterpay)
4. **Multi-currency** - International sales
5. **Saved Payment Methods** - Customer cards on file
6. **3D Secure Improvements** - Better authentication UX

### Migration Considerations

If considering a migration to a different pattern:

- **To Stripe Checkout**: Less code to maintain, but loss of customization
- **To Embedded Checkout**: Middle ground, but still limited flexibility
- **Current Pattern**: Provides maximum flexibility for our business needs

## Reference Documentation

- [Comprehensive Stripe Guide](./stripe-checkout-comprehensive-guide.md) - All integration patterns
- [Webhook Setup Guide](../STRIPE_WEBHOOK_SETUP.md) - Webhook configuration details
- [Official Stripe Docs](https://docs.stripe.com/payments/accept-a-payment) - Latest Stripe documentation
- [Stripe API Reference](https://docs.stripe.com/api) - Complete API documentation

## Support & Troubleshooting

### Common Issues

**Issue**: Webhook not receiving events
**Solution**: Check webhook secret, verify endpoint is publicly accessible, check Stripe Dashboard webhook logs

**Issue**: 3D Secure not working
**Solution**: Ensure return URL is configured correctly, check browser console for errors

**Issue**: Tax calculation failing
**Solution**: Verify shipping address is complete, check Stripe Tax API configuration

### Getting Help

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Support**: https://support.stripe.com
- **Internal Documentation**: `/docs/STRIPE_WEBHOOK_SETUP.md`
- **Code References**: Search for `stripe` in codebase

## Conclusion

Our Stripe integration is **production-ready** and provides a solid foundation for accepting payments. The custom Payment Element approach gives us the flexibility needed for our business while maintaining security and reliability.

For migrating to Stripe Checkout or exploring other patterns, refer to the [comprehensive guide](./stripe-checkout-comprehensive-guide.md).

---

**Last Updated**: January 2026
**Stripe API Version**: 2025-10-29.clover
**Implementation Status**: ✅ Production Ready
