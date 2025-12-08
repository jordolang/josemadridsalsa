# Database Setup Guide

## The Problem

Your current `.env` file has these database URLs:
- `PRISMA_DATABASE_URL` - Prisma Accelerate proxy (for runtime queries)
- `DATABASE_URL` - Points to db.prisma.io (also Prisma Accelerate)

**Prisma Accelerate is just a proxy layer** - it's not the actual database. You need to find your **real underlying PostgreSQL database URL** to run migrations and seeding.

## Finding Your Real Database

### Option 1: Check Vercel Project Settings

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Look for a variable like:
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_PRISMA_URL`
   - `DATABASE_URL_UNPOOLED`
   - Or any URL that looks like `postgresql://user:pass@some-host.postgres.database.azure.com/dbname`

### Option 2: Check Your Database Provider

Where did you create your PostgreSQL database?

**If using Vercel Postgres:**
```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
vercel link

# Pull environment variables
vercel env pull .env.production

# Look for POSTGRES_URL_NON_POOLING or similar
cat .env.production
```

**If using Neon:**
- Go to https://console.neon.tech
- Select your project
- Go to Connection Details
- Copy the "Direct connection" URL (not the pooled one)

**If using Supabase:**
- Go to https://app.supabase.com
- Select your project
- Settings → Database
- Copy the "Direct connection" URL

**If using Railway:**
- Go to https://railway.app
- Select your project
- Select the Postgres service
- Copy the `DATABASE_URL` from the Variables tab

## Once You Have the Real Database URL

Create a new file `.env.production.local` with:

```bash
# Your REAL database (for migrations/seeding)
DIRECT_DATABASE_URL="postgresql://username:password@your-real-host.com:5432/database_name"

# Keep these for runtime
PRISMA_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."
DATABASE_URL="postgres://d113aa485f22861c11968bb73c881cf9d94237260a82ccce900063c78c8ef456:sk_18tNM4N1m_SE0CjWAUJal@db.prisma.io:5432/postgres?sslmode=require"
```

Then run:

```bash
# Use the direct URL for migrations
DATABASE_URL=$DIRECT_DATABASE_URL npx prisma db push

# Use the direct URL for seeding
DATABASE_URL=$DIRECT_DATABASE_URL npm run db:seed
```

## Quick Test

Once you think you have the real database URL, test it:

```bash
# Replace with your actual URL
export TEST_URL="postgresql://your-real-url"

# Try to connect
psql "$TEST_URL" -c "SELECT version();"

# OR using prisma
DATABASE_URL="$TEST_URL" npx prisma db execute --stdin <<< "SELECT 1;"
```

## Next Steps

1. Find your real database URL using one of the methods above
2. Test the connection
3. Run migrations: `DATABASE_URL=<real-url> npx prisma db push`
4. Run seeding: `DATABASE_URL=<real-url> npm run db:seed`
5. Verify products load on your website
