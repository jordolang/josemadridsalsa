# Production Database Connection Fix Guide

## 🚨 Problem Summary

Your production website (josemadrid.net) is experiencing complete database connectivity failure, causing:

- ❌ **Login system not working** - Users cannot authenticate
- ❌ **Find-us page not loading locations** - RetailLocation data not accessible
- ❌ **All database queries failing** - No connection to PostgreSQL database

## 🔍 Root Cause

The production Vercel deployment is missing or has an incorrect `DATABASE_URL` environment variable. Common issues:

1. **DATABASE_URL not set** in Vercel production environment
2. **Wrong URL format** - Using unreachable `db.prisma.io:5432` host
3. **Missing credentials** - API key or connection string incomplete
4. **NEXTAUTH_SECRET not set** - Causing authentication failures

## ✅ Step-by-Step Fix

### Step 1: Access Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Sign in with your account
3. Select the **josemadridsalsa** project (or your project name)

### Step 2: Configure Environment Variables

Navigate to: **Settings → Environment Variables**

#### Required Variables for Production:

| Variable | Value | Environment | Notes |
|----------|-------|-------------|-------|
| `DATABASE_URL` | `prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY` | Production | **CRITICAL** - Use Prisma Accelerate |
| `NEXTAUTH_URL` | `https://www.josemadrid.net` | Production | Must match your domain |
| `NEXTAUTH_SECRET` | `[32-char hex string]` | Production | Generate with `openssl rand -hex 32` |
| `MASTER_KEY` | `[32-char hex string]` | Production | For admin panel encryption |

#### How to Get DATABASE_URL:

**Option A: Prisma Accelerate (Recommended for Production)**

1. Go to [Prisma Data Platform](https://cloud.prisma.io/)
2. Sign in and select your project
3. Navigate to "Accelerate"
4. Copy the connection string that looks like:
   ```
   prisma://accelerate.prisma-data.net/?api_key=eyJhbG...
   ```

**Option B: Neon PostgreSQL (Direct Connection)**

1. Go to [Neon Dashboard](https://console.neon.tech/)
2. Select your project
3. Copy the connection string that looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```

**❌ DO NOT USE:** `postgres://...@db.prisma.io:5432/...` (not publicly accessible)

#### How to Generate Secrets:

```bash
# Generate NEXTAUTH_SECRET
openssl rand -hex 32

# Generate MASTER_KEY
openssl rand -hex 32
```

### Step 3: Set Environment Variables in Vercel

For each variable:

1. Click **Add New** button
2. Enter the **Key** (e.g., `DATABASE_URL`)
3. Enter the **Value** (paste your connection string)
4. Select **Production** environment
5. Click **Save**

![Vercel Environment Variables Screenshot](https://vercel.com/_next/image?url=%2Fdocs-proxy%2Fstatic%2Fdocs%2Fplatform%2Fenvironment-variables.png)

### Step 4: Verify Settings

Double-check all variables are set for **Production** environment:

- ✅ DATABASE_URL
- ✅ NEXTAUTH_URL
- ✅ NEXTAUTH_SECRET
- ✅ MASTER_KEY

### Step 5: Redeploy

After setting environment variables, you need to redeploy:

**Option A: Redeploy from Vercel Dashboard**
1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **⋯** (three dots) → **Redeploy**
4. Confirm the redeployment

**Option B: Push to Git (Automatic Deployment)**
```bash
git commit --allow-empty -m "fix: trigger redeploy with updated env vars"
git push origin main
```

### Step 6: Verify the Fix

Once deployment completes (2-3 minutes):

1. Visit https://www.josemadrid.net
2. Test login functionality
3. Visit https://www.josemadrid.net/find-us
4. Verify locations are loading

## 🧪 Testing Database Connection

### From Local Environment

Run the diagnostic script:

```bash
# Install dependencies first
npm install

# Run diagnostic
node scripts/diagnose-db-connection.js
```

This will check:
- ✓ Environment variables are set
- ✓ Database URL format is correct
- ✓ Connection can be established
- ✓ Queries are working

### Check Production Logs

1. Go to Vercel Dashboard → Deployments
2. Click on the latest deployment
3. Go to **Functions** or **Runtime Logs**
4. Look for Prisma connection logs:
   - ✅ `[Prisma] Client initialized successfully`
   - ❌ `[Prisma] DATABASE_URL is not set`
   - ❌ `Can't reach database server`

## 🔧 Troubleshooting

### Issue: "Can't reach database server at db.prisma.io"

**Solution:** The `db.prisma.io` host is not publicly accessible. Change DATABASE_URL to use Prisma Accelerate:

```env
# ❌ Wrong
DATABASE_URL="postgres://...@db.prisma.io:5432/..."

# ✅ Correct
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
```

### Issue: Login returns 401 or 500 error

**Causes:**
1. NEXTAUTH_SECRET not set
2. NEXTAUTH_URL doesn't match production domain
3. Database connection failed

**Solution:**
```env
NEXTAUTH_URL="https://www.josemadrid.net"  # Must match exactly
NEXTAUTH_SECRET="[generate new 32-char hex]"
```

### Issue: Find-us page shows no locations

**Causes:**
1. DATABASE_URL not working
2. No data in RetailLocation table
3. All locations marked as `isActive: false`

**Solution:**
1. Verify DATABASE_URL is set correctly
2. Check data exists: Run locally with `npx prisma studio`
3. Verify schema is migrated: `npx prisma migrate deploy`

### Issue: "Prisma Client is not configured"

**Causes:**
1. Missing DATABASE_URL during build
2. Prisma generate not run

**Solution:**
```bash
# Regenerate Prisma Client
npx prisma generate

# Redeploy
git commit --allow-empty -m "fix: regenerate Prisma Client"
git push
```

## 📋 Production Checklist

Before going live, ensure:

- [ ] DATABASE_URL is set in Vercel Production environment
- [ ] NEXTAUTH_SECRET is set (32+ character random string)
- [ ] NEXTAUTH_URL matches production domain exactly
- [ ] Database schema is up to date (`npx prisma migrate deploy`)
- [ ] Prisma Client is generated (`npx prisma generate`)
- [ ] Environment variables don't have trailing whitespace
- [ ] SSL mode is enabled for PostgreSQL connections
- [ ] Test login on production site
- [ ] Test find-us page loads locations
- [ ] Check Vercel function logs for errors

## 🔒 Security Notes

1. **Never commit .env files** to git
2. **Use different credentials** for production vs development
3. **Rotate secrets regularly** (NEXTAUTH_SECRET, MASTER_KEY)
4. **Use SSL connections** for database (Neon automatically includes `?sslmode=require`)
5. **Limit database permissions** - Production should not have schema modification rights

## 📞 Getting Help

If you continue to experience issues:

1. Run diagnostic: `node scripts/diagnose-db-connection.js`
2. Check Vercel logs: Dashboard → Deployments → Function Logs
3. Test locally: Set up `.env.local` with production DATABASE_URL
4. Verify database is accessible: `npx prisma db pull`

## 🎯 Expected Results

After completing this fix:

✅ Users can log in successfully
✅ Find-us page displays all retail locations
✅ Admin dashboard loads data
✅ All database queries work
✅ No connection errors in logs

## 🚀 Performance Optimization

Once working, consider:

1. **Use Prisma Accelerate** - Connection pooling and caching
2. **Enable connection pooling** - For direct PostgreSQL connections
3. **Set up read replicas** - For high-traffic queries
4. **Monitor query performance** - Use Prisma Studio or pgAdmin

---

**Last Updated:** 2026-01-19
**Related Docs:**
- [Database Fix README](./DATABASE_FIX_README.md)
- [Environment Setup Guide](./env-setup.md)
- [NextAuth Production Config](./NEXTAUTH_PRODUCTION_CONFIG.md)
