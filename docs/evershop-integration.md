# EverShop Integration Plan

## Overview
This document outlines the integration of EverShop's Order Management System (OMS) into the Jose Madrid Salsa e-commerce platform. EverShop has been installed in the `evershop/` subdirectory and will handle advanced order management, fulfillment, and shipping operations.

## Architecture Decision

### Hybrid Approach: API Bridge + Shared Database Schema
We'll use a **dual-system architecture** where:
1. **Next.js Storefront** - Handles customer-facing operations (product browsing, cart, checkout)
2. **EverShop Backend** - Handles order management, fulfillment, shipping, and admin operations
3. **Order Sync Layer** - Middleware that creates orders in both systems

### Why This Approach?
- **Separation of Concerns**: Storefront and order management are decoupled
- **Best of Both Worlds**: Use Next.js 15 features for frontend, EverShop's mature OMS for backend
- **Gradual Migration**: Can migrate features incrementally
- **Independent Scaling**: Each system can scale independently

## Database Strategy

### Current State
- **Next.js App**: Uses Prisma with PostgreSQL (`DATABASE_URL` in `.env.local`)
- **EverShop**: Requires PostgreSQL with separate schema/tables

### Recommended Setup
1. **Shared PostgreSQL Instance** with separate schemas:
   - Schema `public` - Next.js/Prisma models
   - Schema `evershop` - EverShop tables
2. **Cross-Schema Views** for order synchronization
3. **Webhook/Event System** for real-time updates

## Integration Components

### 1. Order Creation Flow
```
Customer Checkout (Next.js) 
  → Create Order in Prisma DB
  → POST to EverShop API /api/orders
  → EverShop creates order record
  → Return tracking info to customer
```

### 2. Order Status Synchronization
- EverShop updates (shipped, delivered) → Webhook → Update Prisma Order
- Real-time status available in Next.js customer portal

### 3. Admin Panel Access
- EverShop admin at `http://localhost:3000/admin` (default)
- Next.js admin at `/admin` (existing)
- Single sign-on (SSO) via shared JWT/session

## Implementation Steps

### Phase 1: EverShop Setup
1. Configure EverShop database connection
2. Run EverShop migrations
3. Set up admin user
4. Configure shipping methods & payment gateways

### Phase 2: API Bridge Development
1. Create Next.js API route: `/api/evershop/sync-order`
2. Build order transformer (Prisma Order → EverShop Order)
3. Implement retry logic and error handling
4. Add logging and monitoring

### Phase 3: Webhook Integration
1. Create EverShop webhook endpoints
2. Handle order status updates
3. Update Prisma database on status changes
4. Send customer notifications

### Phase 4: Admin Integration
1. Add "View in EverShop" links from Next.js admin
2. Embed EverShop fulfillment UI (optional)
3. Sync user permissions

## Data Mapping

### Order Fields
| Next.js (Prisma) | EverShop | Notes |
|------------------|----------|-------|
| orderNumber | orderNumber | Direct mapping |
| status | status | Convert enum values |
| total | grandTotal | Currency handling |
| shippingAddress | shippingAddress | Address transformation |
| items[] | items[] | Line item mapping |
| paymentStatus | paymentStatus | Map PENDING → null |
| trackingNumber | shipment.trackingNumber | From shipment relation |

### Status Mapping
| Prisma OrderStatus | EverShop Status |
|--------------------|-----------------|
| PENDING | pending |
| CONFIRMED | confirmed |
| PROCESSING | processing |
| SHIPPED | shipped |
| DELIVERED | delivered |
| CANCELLED | cancelled |
| REFUNDED | refunded |

## Environment Configuration

### EverShop Environment Variables
Create `evershop/.env`:
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=josemadridsalsa
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SCHEMA=evershop

# Admin
ADMIN_EMAIL=admin@josemadridsalsa.com
ADMIN_PASSWORD=<secure_password>

# API
EVERSHOP_API_KEY=<generate_secure_key>

# Port (avoid conflict with Next.js)
PORT=3001
```

### Next.js Environment Variables
Add to `.env.local`:
```bash
# EverShop Integration
EVERSHOP_API_URL=http://localhost:3001/api
EVERSHOP_API_KEY=<same_as_above>
EVERSHOP_WEBHOOK_SECRET=<generate_secure_key>
```

## API Endpoints

### Next.js → EverShop
- `POST /api/evershop/create-order` - Sync new order to EverShop
- `GET /api/evershop/order-status/:orderNumber` - Get fulfillment status
- `POST /api/evershop/cancel-order/:orderNumber` - Cancel order

### EverShop → Next.js (Webhooks)
- `POST /api/webhooks/evershop/order-updated` - Order status change
- `POST /api/webhooks/evershop/shipment-created` - Shipping label generated
- `POST /api/webhooks/evershop/tracking-updated` - Tracking number added

## Security Considerations

1. **API Authentication**: Use API keys with HMAC signatures
2. **Webhook Verification**: Validate webhook signatures
3. **Database Access**: Limit cross-schema access
4. **Rate Limiting**: Implement on all API endpoints
5. **Audit Logging**: Log all order syncs and updates

## Monitoring & Logging

### Key Metrics
- Order sync success rate
- Sync latency (time to sync)
- Webhook delivery rate
- Failed sync attempts

### Logging Strategy
- Log all API calls between systems
- Store sync failures for manual review
- Alert on repeated failures

## Rollback Plan

If integration issues arise:
1. Disable EverShop order sync
2. Continue using Next.js-only order flow
3. Manually sync critical orders
4. Debug and redeploy

## Testing Strategy

### Unit Tests
- Order transformer logic
- API client functions
- Webhook signature verification

### Integration Tests
- End-to-end order creation flow
- Webhook handling
- Status synchronization

### Manual Testing Checklist
- [ ] Create order in Next.js → Appears in EverShop
- [ ] Mark shipped in EverShop → Updates in Next.js
- [ ] Cancel order → Syncs both ways
- [ ] Webhook failures → Proper error handling

## Future Enhancements

1. **Real-time Sync**: Use database triggers instead of API calls
2. **Advanced Fulfillment**: Multi-warehouse support
3. **Returns Management**: Handle returns/exchanges
4. **Analytics**: Unified reporting across both systems
5. **Mobile App**: EverShop mobile admin app integration

## Resources

- EverShop Documentation: https://docs.evershop.io/
- EverShop API Reference: https://docs.evershop.io/api/
- GraphQL Playground: http://localhost:3001/graphql (when running)
