# Production Database Management

This document describes how to manage the production database for Jose Madrid Salsa.

## Overview

The production database is hosted on Vercel Postgres and is automatically connected to your Vercel deployment. The application uses Prisma as the ORM with Prisma Accelerate for connection pooling.

## Environment Variables

The production database uses three environment variables:

- **`DATABASE_URL`**: Prisma Accelerate connection string (used by the application at runtime)
- **`POSTGRES_URL`**: Direct PostgreSQL connection (used for migrations and schema management)
- **`PRISMA_DATABASE_URL`**: Prisma-specific connection string

All are automatically configured when you deploy to Vercel with a Postgres database attached.

## Quick Commands

```bash
# Pull production environment variables
npm run db:production:pull-env

# Sync schema to production (creates/updates tables)
npm run db:production:sync

# Seed production database with initial data
npm run db:production:seed
```

## Detailed Workflow

### 1. Pull Production Environment Variables

Before running any production database commands, you need to pull the environment variables from Vercel:

```bash
npm run db:production:pull-env
```

This creates `.env.vercel.production` file with all production environment variables.

### 2. Sync Schema to Production

When you make changes to `prisma/schema.prisma` and need to apply them to production:

```bash
npm run db:production:sync
```

This script:
- Reads `POSTGRES_URL` from `.env.vercel.production`
- Runs `prisma db push` to sync the schema
- Creates new tables and updates existing ones
- **Warning**: May cause data loss if schema changes are incompatible

### 3. Seed Production Database

To populate the production database with initial data (products, categories, users, recipes):

```bash
npm run db:production:seed
```

This script:
- Reads `DATABASE_URL` from `.env.vercel.production`
- **Clears existing data** from all tables
- Seeds the database with:
  - 4 product categories (Mild, Medium, Hot, Gourmet/Fruit)
  - 28 salsa products
  - 2 users (admin and customer)
  - 1 sample fundraiser
  - 16 recipes
  - Sample analytics data

**Default Credentials**:
- Admin: `admin@josemadridsalsa.com` / `admin123456`
- Customer: `customer@example.com` / `customer123456`

### 4. Custom Seed Credentials

You can customize the admin credentials by setting environment variables:

```bash
SEED_ADMIN_EMAIL=your@email.com SEED_ADMIN_PASSWORD=yourpassword npm run db:production:seed
```

## Manual Commands

If you prefer to run the scripts directly:

```bash
# Sync schema
node scripts/sync-production-schema.js

# Seed database
node scripts/seed-production.js
```

## Troubleshooting

### Missing Tables Error

If you see errors about missing tables in production:

1. Pull environment variables: `npm run db:production:pull-env`
2. Sync schema: `npm run db:production:sync`
3. Seed database: `npm run db:production:seed`

### Connection Errors

If you get connection errors:

1. Verify Vercel Postgres is attached to your project
2. Check that environment variables are properly set in Vercel dashboard
3. Re-pull environment variables: `npm run db:production:pull-env`

### Schema Out of Sync

If migrations and schema don't match:

1. Use `npm run db:production:sync` to force schema sync
2. This bypasses migration tracking and directly updates the schema

## Database Migrations

For production deployments, we use `prisma db push` instead of migrations because:

1. **Simplicity**: Directly syncs schema without migration files
2. **Flexibility**: Handles schema drift gracefully
3. **Speed**: Faster for prototyping and rapid iteration

For a more robust approach with migration history, consider using:

```bash
# Create migration locally
npx prisma migrate dev --name your_migration_name

# Deploy to production (via Vercel build)
# Migrations are automatically applied during build if configured
```

## CI/CD Integration

The production database is automatically managed during Vercel deployments:

1. **Build Phase**: 
   - `postinstall` script runs `prisma generate`
   - Generates Prisma Client with production types

2. **Runtime**:
   - Application uses `DATABASE_URL` with Prisma Accelerate
   - Connection pooling and caching enabled

## Backup and Recovery

### Manual Backup

To create a backup of production data:

```bash
# Export data (requires database access)
pg_dump $POSTGRES_URL > backup-$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
psql $POSTGRES_URL < backup-20231027.sql
```

## Production Data Policy

**Important**: 
- Always test schema changes locally first
- Use seed scripts for initial data only
- Never run seed scripts on production with real customer data
- Consider incremental migrations for production with live data

## API Testing

After seeding, verify the database is working:

```bash
# Test featured products endpoint
curl https://www.josemadrid.net/api/products/featured | jq

# Test all products
curl https://www.josemadrid.net/api/products | jq 'length'

# Expected: 28 products, 5 featured
```

## Scripts Location

All production database management scripts are located in:

```
scripts/
├── sync-production-schema.js   # Schema sync script
└── seed-production.js          # Database seeding script
```

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [Prisma Accelerate Documentation](https://www.prisma.io/docs/accelerate)
