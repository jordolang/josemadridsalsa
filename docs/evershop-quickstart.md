# EverShop Integration - Quick Start Guide

This guide will help you get EverShop integrated with your Jose Madrid Salsa e-commerce platform in minutes.

## Prerequisites

- PostgreSQL database running (same as your Next.js app)
- Node.js 18+ installed
- Your Next.js app configured with `.env.local` containing `DATABASE_URL`

## Step 1: Run Setup Script

From the root of your project, run:

```bash
npm run evershop:setup
```

This script will:
- Parse your existing `DATABASE_URL` from `.env.local`
- Generate secure API keys
- Create `evershop/.env` with database configuration
- Add EverShop configuration to your `.env.local`

## Step 2: Create EverShop Schema

The setup script will output a command like this:

```bash
psql -h localhost -p 5432 -U your_user -d josemadridsalsa -c 'CREATE SCHEMA IF NOT EXISTS evershop;'
```

Run this command to create a separate schema for EverShop tables.

**Alternative using npm:**
```bash
# If you have psql in your PATH
npm run evershop:setup
# Then follow the printed instructions
```

## Step 3: Initialize EverShop

```bash
cd evershop
npm run setup
```

This will:
- Create database tables in the `evershop` schema
- Create the admin user
- Initialize default settings

## Step 4: Start EverShop

In a **separate terminal** (keep your Next.js dev server running):

```bash
npm run evershop:dev
```

EverShop will start on `http://localhost:3001`

## Step 5: Access EverShop Admin

1. Open `http://localhost:3001/admin` in your browser
2. Login with:
   - **Email**: `admin@josemadridsalsa.com`
   - **Password**: `ChangeMe123!`
3. **Important**: Change your password immediately after first login

## Step 6: Test the Integration

### Create a Test Order in Next.js

1. Make sure your Next.js app is running (`npm run dev`)
2. Create a test order through your storefront
3. Note the order number

### Sync Order to EverShop

Use the API to sync the order:

```bash
curl -X POST http://localhost:3000/api/evershop/sync-order \
  -H "Content-Type: application/json" \
  -d '{"orderNumber": "ORD-2024-001"}'
```

### Check in EverShop

1. Go to `http://localhost:3001/admin/orders`
2. You should see your synced order

## Architecture Overview

```
┌─────────────────────┐
│   Next.js (3000)    │  Customer-facing storefront
│   - Product browsing│
│   - Cart & Checkout │
│   - Customer portal │
└──────────┬──────────┘
           │
           │ API Bridge
           │
┌──────────▼──────────┐
│   EverShop (3001)   │  Order Management System
│   - Order tracking  │
│   - Fulfillment     │
│   - Shipping labels │
│   - Admin panel     │
└─────────────────────┘
```

## Common Commands

### Start Both Systems
```bash
# Terminal 1 - Next.js
npm run dev

# Terminal 2 - EverShop  
npm run evershop:dev
```

### Stop EverShop
```bash
# Press Ctrl+C in the EverShop terminal
```

### View Logs
```bash
# Next.js logs are in Terminal 1
# EverShop logs are in Terminal 2
```

## Environment Variables

### Next.js `.env.local`
```bash
# Your existing vars...
DATABASE_URL=postgresql://...

# EverShop Integration (added by setup script)
EVERSHOP_API_URL=http://localhost:3001/api
EVERSHOP_API_KEY=<generated_key>
EVERSHOP_WEBHOOK_SECRET=<generated_key>
```

### EverShop `evershop/.env`
```bash
# Database (shared with Next.js)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=josemadridsalsa
DB_USER=your_user
DB_PASSWORD=your_password
DB_SCHEMA=evershop

# Server
PORT=3001
HOST=localhost

# Admin
ADMIN_EMAIL=admin@josemadridsalsa.com
ADMIN_PASSWORD=ChangeMe123!

# API Keys
EVERSHOP_API_KEY=<generated_key>
SESSION_SECRET=<generated_key>
```

## Integration Flow

### 1. Order Creation
When a customer completes checkout in Next.js:
1. Order is saved to Prisma database
2. Order is synced to EverShop via API
3. Customer receives confirmation

### 2. Order Fulfillment (in EverShop)
1. Admin logs into EverShop admin panel
2. Views order details
3. Creates shipping label
4. Marks as shipped with tracking number

### 3. Status Sync (EverShop → Next.js)
1. EverShop sends webhook to Next.js
2. Next.js updates order status in Prisma
3. Customer sees updated status in portal
4. Customer receives shipping notification email

## Troubleshooting

### EverShop won't start
**Error**: `role 'postgres' does not exist`
- Check your database credentials in `evershop/.env`
- Ensure PostgreSQL is running
- Verify the evershop schema was created

### Orders not syncing
**Check**:
1. Both servers are running
2. Environment variables are set correctly
3. Check logs in both terminals
4. Verify API keys match between systems

### Database connection errors
**Check**:
1. PostgreSQL is running
2. Database credentials are correct
3. `evershop` schema exists
4. User has permissions on both schemas

### Port conflicts
If port 3001 is in use:
1. Change `PORT` in `evershop/.env`
2. Update `EVERSHOP_API_URL` in `.env.local`

## Next Steps

1. **Configure Shipping Methods**
   - Go to EverShop admin → Settings → Shipping
   - Add your shipping carriers and rates

2. **Set Up Payment Processing**
   - Configure Stripe in EverShop (if not using Next.js payment)
   - Or keep payment in Next.js and only use EverShop for fulfillment

3. **Customize Email Templates**
   - EverShop admin → Settings → Email Templates
   - Customize order confirmation, shipping notifications

4. **Enable Webhooks**
   - Configure EverShop to send webhooks to your Next.js app
   - Test webhook delivery

5. **Production Deployment**
   - Set up EverShop on a server or container
   - Update API URLs to production domains
   - Use environment-specific configurations

## Support & Documentation

- **Full Integration Docs**: `docs/evershop-integration.md`
- **EverShop Docs**: https://docs.evershop.io/
- **EverShop GitHub**: https://github.com/evershopcommerce/evershop

## Security Checklist

Before going to production:
- [ ] Change EverShop admin password
- [ ] Rotate all API keys
- [ ] Enable HTTPS for both systems
- [ ] Set up firewall rules
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts
