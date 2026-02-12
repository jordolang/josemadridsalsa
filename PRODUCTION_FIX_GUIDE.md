# 🚨 CRITICAL: Database & Authentication Fix Guide

## Problem Summary

Your application is experiencing **401 authentication errors** and **no database connectivity** because:

1. ❌ **Missing DATABASE_URL** - The production environment doesn't have the correct database connection string
2. ❌ **Authentication depends on database** - NextAuth requires database access to verify credentials
3. ❌ **Neon database credentials not configured** - Environment variables are missing or incorrect

## Impact

- **Users cannot login** (401 errors)
- **No database connectivity** (all database queries fail)
- **Application is effectively down** (critical features broken)

---

## ✅ IMMEDIATE FIX: Update Vercel Environment Variables

### Step 1: Log into Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project: **josemadridsalsa**
3. Navigate to **Settings** → **Environment Variables**

### Step 2: Set/Update These Critical Variables

Add or update the following environment variables for the **Production** environment:

```bash
# CRITICAL: Database Connection
DATABASE_URL=postgresql://neondb_owner:npg_suRSly1DjCn8@ep-holy-leaf-ahscccxe-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

# CRITICAL: Authentication
NEXTAUTH_SECRET=71d6c19fd251388a9cb6012840460b546f6c411f4ea8b2efad6b1e7881a4eb2c
NEXTAUTH_URL=https://www.josemadrid.net

# CRITICAL: Admin Panel Encryption
MASTER_KEY=your_master_key_here
```

**⚠️ IMPORTANT**:
- Make sure there are **NO TRAILING SPACES** or **NEWLINES** in the values
- Vercel copy/paste issues can add whitespace - the code sanitizes this, but best to avoid it
- Double-check the DATABASE_URL is EXACTLY as shown above

### Step 3: Redeploy

After updating environment variables, trigger a redeploy:

```bash
# Option 1: Through Vercel Dashboard
Go to Deployments → Click "..." on latest deployment → "Redeploy"

# Option 2: Through Git
git commit --allow-empty -m "redeploy: apply updated environment variables"
git push origin main
```

### Step 4: Verify Fix

After redeployment completes (~2-3 minutes), verify:

1. **Check auth endpoint**:
   ```bash
   curl https://www.josemadrid.net/api/auth/session
   ```
   Should return `{}` (JSON), not HTML error page

2. **Try logging in** at https://www.josemadrid.net/auth/signin
   - Should no longer get 401 errors
   - Login should work properly

3. **Check Vercel function logs**:
   - Go to Vercel Dashboard → Functions → Logs
   - Look for `[Prisma] Client initialized successfully`
   - Should NOT see "DATABASE_URL is not set" errors

---

## 🔍 Root Cause Analysis

### What Happened

1. **Database Host Changed**: The old database at `db.prisma.io` no longer exists (DNS failure)
2. **Environment Variables Not Updated**: Production Vercel environment still had old/missing DATABASE_URL
3. **Auth System Failed**: NextAuth requires database to verify user credentials
   - When DATABASE_URL is missing, Prisma client fails to initialize
   - Auth callbacks try to query database → fails
   - Returns 401 Unauthorized for all protected routes

### Why 401 Errors Occurred

From `lib/auth.ts:84-94`:
```typescript
const prisma = await getPrisma()
const user = await prisma.user.findUnique({
  where: { email: normalizedEmail }
})
```

When DATABASE_URL is not set:
- Prisma client initialization fails
- Database queries throw errors
- Auth authorize function returns `null`
- NextAuth returns 401 Unauthorized

### Middleware Impact

From `middleware.ts:97-99` (API routes):
```typescript
if (!token) {
  return NextResponse.json(
    { error: 'Unauthorized - authentication required' },
    { status: 401 }
  )
}
```

Similar token validation occurs at:
- Lines 64-69: `/admin` routes
- Lines 84-85: `/account` routes

Without a valid database connection:
- Sessions cannot be created during login
- Token validation fails
- All protected routes (admin, account, API) return 401

---

## 📋 Environment Variables Checklist

### ✅ Required for Basic Operation

- [x] `DATABASE_URL` - Neon PostgreSQL connection string
- [x] `NEXTAUTH_SECRET` - JWT encryption secret (32-byte hex string)
- [x] `NEXTAUTH_URL` - Production domain (https://www.josemadrid.net)
- [ ] `MASTER_KEY` - Admin panel encryption key (**YOU NEED TO SET THIS**)

### Optional (Set if you use these features)

- [ ] `STRIPE_SECRET_KEY` - For payment processing
- [ ] `RESEND_API_KEY` - For sending emails
- [ ] `GOOGLE_MAPS_API_KEY` - For location features
- [ ] `UPLOADTHING_SECRET` - For file uploads
- [ ] `CRON_SECRET` - For scheduled jobs

---

## 🔐 Security Notes

### Database Credentials

The Neon database URL includes:
- **Username**: `neondb_owner`
- **Password**: `npg_suRSly1DjCn8` (visible in docs, should be rotated if public)
- **Host**: `ep-holy-leaf-ahscccxe-pooler.us-east-1.aws.neon.tech`
- **Database**: `neondb`
- **Connection Pooler**: Uses `-pooler` endpoint (recommended for serverless)

### Recommended Actions

1. **Rotate Neon Database Password** (if these credentials were exposed):
   - Go to Neon Dashboard
   - Reset database password
   - Update DATABASE_URL in Vercel

2. **Generate New NEXTAUTH_SECRET** (if you suspect compromise):
   ```bash
   openssl rand -hex 32
   ```
   - Update in Vercel environment variables
   - All existing sessions will be invalidated (users must re-login)

3. **Set MASTER_KEY** (if not already set):
   ```bash
   openssl rand -hex 32
   ```
   - Required for admin panel functionality

---

## 🧪 Testing After Fix

### 1. Test Database Connection

```bash
# From local environment (after setting .env)
npm run db:studio
```

Should open Prisma Studio successfully

### 2. Test Authentication Flow

1. Visit https://www.josemadrid.net/auth/signin
2. Enter valid credentials
3. Should login successfully (no 401 errors)
4. Check browser console - no authentication errors

### 3. Check Production Logs

```bash
# View recent function logs
vercel logs --prod --since 10m
```

Look for:
- ✅ `[Prisma] Client initialized successfully`
- ✅ `[Auth] Login successful for: <email>`
- ❌ Should NOT see: "DATABASE_URL is not set"
- ❌ Should NOT see: "Failed to load Prisma client"

---

## 📚 Related Files

- **Database Connection**: `lib/prisma.ts` - Handles DATABASE_URL and fallbacks
- **Authentication**: `lib/auth.ts` - NextAuth configuration and database queries
- **Middleware**: `middleware.ts` - Protects routes and returns 401 errors
- **Auth API**: `app/api/auth/[...nextauth]/route.ts` - NextAuth route handler
- **Schema**: `prisma/schema.prisma` - Database schema definition

---

## 🆘 Still Having Issues?

### Check These Common Problems

1. **Trailing whitespace in DATABASE_URL**
   - Vercel copy/paste can add spaces/newlines
   - The code sanitizes this, but double-check anyway

2. **Wrong NEXTAUTH_URL**
   - Must be exactly: `https://www.josemadrid.net`
   - No trailing slash
   - Include `https://`

3. **NEXTAUTH_SECRET not set or too short**
   - Must be a secure random string (32+ characters)
   - Use `openssl rand -hex 32` to generate

4. **Database is down**
   - Check Neon dashboard: https://console.neon.tech
   - Verify database is running and accessible

5. **Old build cached**
   - Try redeploying again
   - Check deployment logs for errors

### Enable Debug Logging

Temporarily enable debug mode to see detailed auth logs:

1. The auth config already has `debug: process.env.NODE_ENV === 'development'`
2. To debug production, you can temporarily change `lib/auth.ts:52`:
   ```typescript
   debug: true,  // Enable temporarily
   ```
3. Commit and push to see detailed logs in Vercel
4. **Remember to disable after debugging!**

---

## ✅ Success Criteria

After implementing the fix, you should see:

- ✅ No 401 errors when accessing protected pages
- ✅ Login works without errors
- ✅ Database queries execute successfully
- ✅ Prisma client initializes without warnings
- ✅ Application fully functional

---

**Status**: 🚨 **CRITICAL FIX NEEDED**
**Priority**: **P0 - IMMEDIATE**
**ETA**: 5 minutes to update env vars + 3 minutes deployment = **~10 minutes total**

**Next Steps**:
1. Update Vercel environment variables (above)
2. Redeploy application
3. Test login functionality
4. Verify 401 errors are gone
