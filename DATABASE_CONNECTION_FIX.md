# 🔧 Database Connection Fix - URGENT

## 🚨 Critical Issue Identified

Your production website **josemadrid.net** has a complete database connection failure causing:

- ❌ **Login System Down** - Users cannot authenticate
- ❌ **Find-Us Page Not Loading** - Location data unavailable
- ❌ **All Database Queries Failing** - Complete system outage

## 📊 Root Cause Analysis

After comprehensive diagnosis, the issue is:

**DATABASE_URL is missing, incorrect, or using an unreachable host in Vercel production environment**

Common causes:
1. ⚠️ `DATABASE_URL` not set in Vercel production
2. ⚠️ Wrong URL format (using `db.prisma.io:5432` which is NOT publicly accessible)
3. ⚠️ `NEXTAUTH_SECRET` not configured
4. ⚠️ Environment variable mismatch between local and production

## ✅ Quick Fix (5 Minutes)

### Step 1: Access Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your **josemadridsalsa** project
3. Navigate to **Settings → Environment Variables**

### Step 2: Set Required Environment Variables

Add these variables for **Production** environment:

#### 1. DATABASE_URL (CRITICAL)

```env
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_KEY"
```

**Where to get this:**
- If using **Prisma Accelerate**: https://cloud.prisma.io/ → Your Project → Accelerate → Copy connection string
- If using **Neon PostgreSQL**: https://console.neon.tech/ → Your Project → Connection string

**❌ DO NOT USE:** `postgres://...@db.prisma.io:5432/...` (not accessible)

#### 2. NEXTAUTH_URL

```env
NEXTAUTH_URL="https://www.josemadrid.net"
```

Must match your production domain exactly.

#### 3. NEXTAUTH_SECRET

```bash
# Generate with:
openssl rand -hex 32

# Then set in Vercel:
NEXTAUTH_SECRET="[the generated 64-character string]"
```

#### 4. MASTER_KEY (for admin panel)

```bash
# Generate with:
openssl rand -hex 32

# Then set in Vercel:
MASTER_KEY="[the generated 64-character string]"
```

### Step 3: Redeploy

After setting environment variables:

**Option A: Vercel Dashboard**
1. Go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**

**Option B: Git Push (Automatic)**
```bash
git commit --allow-empty -m "fix: trigger redeploy with updated env vars"
git push origin main
```

### Step 4: Verify Fix

Wait 2-3 minutes for deployment, then test:

1. ✅ Visit https://www.josemadrid.net
2. ✅ Test login at https://www.josemadrid.net/login
3. ✅ Check find-us page: https://www.josemadrid.net/find-us
4. ✅ Verify locations load correctly

## 🛠️ Automated Setup Scripts

### Option 1: Automated Vercel Setup

```bash
# Interactive script to set all environment variables
./scripts/setup-vercel-env.sh
```

This script will:
- Prompt you for each required variable
- Auto-generate secrets
- Set variables in Vercel production
- Trigger redeployment

### Option 2: Diagnostic Tool

```bash
# Check database connection and configuration
node scripts/diagnose-db-connection.js
```

This will verify:
- ✓ Environment variables are set correctly
- ✓ Database URL format is valid
- ✓ Connection can be established
- ✓ Queries are working

## 📋 Complete Environment Variables Checklist

### Critical (MUST SET):
- [ ] `DATABASE_URL` - Database connection string
- [ ] `NEXTAUTH_URL` - Production domain URL
- [ ] `NEXTAUTH_SECRET` - JWT encryption secret
- [ ] `MASTER_KEY` - Admin panel encryption

### Payment (If using e-commerce):
- [ ] `STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`

### Maps & Location (For find-us page):
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- [ ] `GOOGLE_PLACES_API_KEY`

### Email (For transactional emails):
- [ ] `RESEND_API_KEY`
- [ ] `FROM_EMAIL`

## 🔍 How to Verify Your Current Vercel Settings

### Method 1: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link

# Check environment variables
vercel env ls

# Pull production variables (to verify)
vercel env pull .env.production.local
```

### Method 2: Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Look for `DATABASE_URL` under "Production"

## 🚨 Common Issues & Solutions

### Issue 1: "Can't reach database server at db.prisma.io"

**Cause:** Using unreachable `db.prisma.io` host in DATABASE_URL

**Solution:**
```env
# ❌ Wrong (not accessible)
DATABASE_URL="postgres://...@db.prisma.io:5432/postgres..."

# ✅ Correct (use Prisma Accelerate)
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
```

### Issue 2: Login returns 401 or 500

**Cause:** NEXTAUTH_SECRET not set or NEXTAUTH_URL mismatch

**Solution:**
1. Generate new secret: `openssl rand -hex 32`
2. Set in Vercel: `NEXTAUTH_SECRET="[generated-value]"`
3. Verify `NEXTAUTH_URL="https://www.josemadrid.net"` (exact match)
4. Redeploy

### Issue 3: Find-us page shows no locations

**Cause:** Database connection failed or no data

**Solution:**
1. Verify DATABASE_URL is set correctly
2. Check database has data: `npx prisma studio` (locally)
3. Ensure schema is migrated: `npx prisma migrate deploy`
4. Check RetailLocation table has records with `isActive: true`

### Issue 4: "Prisma Client is not configured"

**Cause:** Missing DATABASE_URL during build

**Solution:**
1. Set DATABASE_URL in Vercel (see Step 2 above)
2. Regenerate Prisma Client: `npx prisma generate`
3. Commit and push to trigger rebuild

## 📚 Related Documentation

- **Detailed Fix Guide**: [docs/PRODUCTION_DATABASE_FIX.md](./docs/PRODUCTION_DATABASE_FIX.md)
- **Database Troubleshooting**: [docs/DATABASE_FIX_README.md](./docs/DATABASE_FIX_README.md)
- **Environment Setup**: [docs/env-setup.md](./docs/env-setup.md)
- **NextAuth Config**: [docs/NEXTAUTH_PRODUCTION_CONFIG.md](./docs/NEXTAUTH_PRODUCTION_CONFIG.md)

## 🎯 What Was Fixed

This fix includes:

1. ✅ **Enhanced Prisma client error handling** (`lib/prisma.ts`)
   - Detects `db.prisma.io` and shows clear error
   - Better logging for production debugging
   - Improved environment variable fallback chain

2. ✅ **Database diagnostic script** (`scripts/diagnose-db-connection.js`)
   - Checks environment variables
   - Tests database connection
   - Verifies query execution
   - Provides actionable solutions

3. ✅ **Vercel setup automation** (`scripts/setup-vercel-env.sh`)
   - Interactive environment variable setup
   - Auto-generates secrets
   - Sets variables in Vercel
   - Triggers deployment

4. ✅ **Comprehensive documentation**
   - Production fix guide
   - Troubleshooting steps
   - Environment checklist
   - Common issues & solutions

## 🚀 Production Deployment Checklist

Before marking this issue as resolved, verify:

- [ ] All environment variables set in Vercel production
- [ ] DATABASE_URL uses Prisma Accelerate (not db.prisma.io)
- [ ] NEXTAUTH_SECRET is generated and set
- [ ] Deployment completed successfully
- [ ] Login works on production
- [ ] Find-us page loads locations
- [ ] No errors in Vercel function logs
- [ ] Database queries are executing (check logs)

## 📞 Support

If you continue to experience issues after following this guide:

1. Run diagnostic: `node scripts/diagnose-db-connection.js`
2. Check Vercel logs: Dashboard → Deployments → Function Logs
3. Verify database access: `npx prisma db pull` (locally with production URL)
4. Review error messages in browser console (F12)

## 🎉 Expected Results

After completing this fix:

✅ Users can log in successfully
✅ Find-us page displays all retail locations with map
✅ Admin dashboard loads all data
✅ All database queries execute without errors
✅ No connection errors in production logs
✅ Full website functionality restored

---

**Created:** 2026-01-19
**Status:** Fix Ready for Deployment
**Priority:** CRITICAL
**Estimated Fix Time:** 5-10 minutes

---

## Quick Command Reference

```bash
# Generate secrets
openssl rand -hex 32

# Setup Vercel environment variables
./scripts/setup-vercel-env.sh

# Test database connection
node scripts/diagnose-db-connection.js

# Deploy to Vercel
vercel --prod

# Or trigger via git
git commit --allow-empty -m "fix: redeploy with database configuration"
git push origin main
```

---

**Next Steps:**
1. Set environment variables in Vercel (5 min)
2. Redeploy application (2-3 min wait)
3. Test production website
4. Mark issue as resolved ✅
