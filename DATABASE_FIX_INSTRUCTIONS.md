# Console Errors Fix - Database Configuration

## Issue Diagnosed

The console errors you're seeing on www.josemadrid.net are caused by:

1. **500 Error on `/api/products`** - Database connection failure
2. **500 Error on `/api/auth/session`** - Authentication API failing due to database issues
3. **CLIENT_FETCH_ERROR** - NextAuth receiving non-JSON responses (HTML error pages instead of JSON)

## Root Cause

The production environment needs the correct DATABASE_URL configured to point to your Neon PostgreSQL database. The errors suggest either:
- The DATABASE_URL environment variable is not set in production (Vercel)
- The NEXTAUTH_URL is incorrectly set to `http://localhost:3000` instead of `https://www.josemadrid.net`

## Solution

### Step 1: Configure Vercel Environment Variables

You need to add these environment variables to your Vercel project:

```bash
DATABASE_URL=postgresql://neondb_owner:npg_suRSly1DjCn8@ep-holy-leaf-ahscccxe-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
NEXTAUTH_URL=https://www.josemadrid.net
NEXTAUTH_SECRET=71d6c19fd251388a9cb6012840460b546f6c411f4ea8b2efad6b1e7881a4eb2c
```

**How to set environment variables in Vercel:**

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your `josemadridsalsa` project
3. Go to **Settings** > **Environment Variables**
4. Add each variable above:
   - Variable Name: `DATABASE_URL`
   - Value: `postgresql://neondb_owner:npg_suRSly1DjCn8@ep-holy-leaf-ahscccxe-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - Environment: Select **Production**, **Preview**, and **Development**
   - Click **Save**
5. Repeat for `NEXTAUTH_URL` and `NEXTAUTH_SECRET`
6. **Redeploy** your application for the changes to take effect

### Step 2: Verify Database Connection

After deploying, the following API endpoints should work:
- https://www.josemadrid.net/api/products
- https://www.josemadrid.net/api/auth/session

### Step 3: Test the Application

1. Visit https://www.josemadrid.net
2. Open the browser console (F12)
3. Verify there are no 500 errors
4. Check that products load correctly
5. Verify authentication works

## Local Development Configuration

For local development, we've configured `.env` to use your Raspberry Pi PostgreSQL server:

```bash
DATABASE_URL=postgresql://postgres:postgres@192.168.1.28:5432/josemadrid
```

**Note:** This Claude Code development environment has network restrictions and cannot connect to external databases. If you need to test locally:

1. Use a local development environment (your own computer)
2. Ensure the Raspberry Pi database is accessible from your network
3. Run migrations: `npx prisma migrate deploy`
4. Seed data: `npm run db:seed` (if you have a seed script)

## Files Modified

- `.env` - Updated for local development (Raspberry Pi database)
- `.env.production` - Created with production configuration (Neon database)
- `DATABASE_FIX_INSTRUCTIONS.md` - This file

## Next Steps

1. Configure the environment variables in Vercel as described above
2. Redeploy your application
3. Test the production website to verify errors are resolved
4. If errors persist, check Vercel logs for more details
