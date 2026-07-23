# Deployment Runbook

This runbook provides step-by-step operational procedures for deploying the Jose Madrid Salsa application to production on Vercel.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Pre-Deployment Procedures](#pre-deployment-procedures)
3. [Standard Deployment Process](#standard-deployment-process)
4. [Database Migration Deployment](#database-migration-deployment)
5. [Emergency Rollback Procedures](#emergency-rollback-procedures)
6. [Post-Deployment Validation](#post-deployment-validation)
7. [Troubleshooting](#troubleshooting)
8. [Reference](#reference)

---

## Deployment Overview

### Deployment Strategy

The application uses **continuous deployment** via Vercel:

- **Automatic Deployments**: All commits to `main` branch trigger production deployments
- **Preview Deployments**: All pull requests receive unique preview URLs
- **Git Integration**: Deployments synchronized with GitHub repository

### Deployment Types

| Type | Trigger | Target Environment | Approval Required |
|------|---------|-------------------|-------------------|
| Production | Push to `main` | josemadrid.net | Yes (via PR merge) |
| Preview | Pull request | Unique preview URL | No |
| Manual | CLI command | Any environment | Yes |

### Key Contacts

- **Technical Lead**: [Name/Email]
- **DevOps Lead**: [Name/Email]
- **On-Call Engineer**: See PagerDuty rotation
- **Vercel Support**: support@vercel.com

---

## Pre-Deployment Procedures

### 1. Verify Pre-Deployment Checklist

Before initiating any production deployment, ensure all items are complete. See [PRODUCTION_LAUNCH.md](./PRODUCTION_LAUNCH.md) for comprehensive checklist.

**Critical Verifications:**

```bash
# 1. All tests passing
npm run test

# 2. Linting clean
npm run lint

# 3. Type checking passes
npm run type-check

# 4. Build succeeds locally
npm run build
```

**Expected Output**: All commands exit with code 0, no errors reported.

### 2. Verify GitHub Actions Status

```bash
# Check CI status for main branch
gh run list --branch main --limit 1

# Or view in browser
gh pr view [PR-NUMBER] --web
```

**Required**: All CI checks must show green ✓ before proceeding.

### 3. Review Pending Changes

```bash
# Compare main with current production deployment
git log --oneline origin/main ^$(git describe --tags --abbrev=0)

# Review files changed since last deployment
git diff --stat origin/main $(git describe --tags --abbrev=0)
```

### 4. Notify Stakeholders

**Before Deployment:**

- [ ] Post in #deployments Slack channel: "Starting production deployment - ETA 10 minutes"
- [ ] Notify customer support team of any user-facing changes
- [ ] Schedule deployment during low-traffic window if possible (see Analytics)

---

## Standard Deployment Process

### Automatic Deployment (Recommended)

**Standard workflow for most deployments without database migrations.**

#### Step 1: Merge Pull Request

```bash
# Ensure you're on the feature branch
git checkout feature/your-feature-name

# Pull latest changes
git pull origin main

# Merge main into your branch (resolve conflicts if any)
git merge origin/main

# Push to trigger final CI checks
git push origin feature/your-feature-name
```

#### Step 2: Merge to Main via GitHub

1. Navigate to pull request in GitHub
2. Verify all checks passing (CI, code review approval)
3. Click "Merge pull request" → "Confirm merge"
4. Delete feature branch (optional but recommended)

#### Step 3: Monitor Deployment

Vercel automatically triggers deployment on merge to `main`.

```bash
# Monitor deployment status via CLI
vercel ls --scope josemadrid-salsa

# Or open Vercel dashboard
open https://vercel.com/josemadrid-salsa/dashboard
```

**Monitor in Vercel Dashboard:**

1. Navigate to [Vercel Project Dashboard](https://vercel.com/josemadrid-salsa)
2. Click on latest deployment (should show "Building" status)
3. View real-time build logs
4. Wait for status to change to "Ready"

**Expected Timeline:**

- Code checkout: 5-10 seconds
- Dependency installation: 30-60 seconds
- Database migration (if any): 10-30 seconds
- Build: 2-4 minutes
- Deployment propagation: 10-20 seconds
- **Total**: 3-6 minutes

#### Step 4: Verify Deployment

See [Post-Deployment Validation](#post-deployment-validation) section below.

---

## Database Migration Deployment

**Use this process when deploying code that includes Prisma schema changes.**

### Pre-Migration Checklist

- [ ] Migration tested in staging environment
- [ ] Migration is backwards-compatible (if rolling deployment)
- [ ] Database backup created within last 24 hours
- [ ] Database backup restore procedure tested
- [ ] Migration rollback script prepared (if applicable)

### Step 1: Review Migration Files

```bash
# List pending migrations
npx prisma migrate status

# Review migration SQL
cat prisma/migrations/[TIMESTAMP]_[NAME]/migration.sql

# Verify migration doesn't contain destructive operations
# Look for: DROP TABLE, DROP COLUMN, ALTER COLUMN (data type changes)
grep -i "DROP\|ALTER.*TYPE" prisma/migrations/*/migration.sql
```

**Warning Signs** (require extra caution):

- `DROP TABLE` or `DROP COLUMN` - potential data loss
- `ALTER COLUMN ... TYPE` - may require data transformation
- Large table alterations (>1M rows) - may cause downtime
- Missing `DEFAULT` on `NOT NULL` column additions

### Step 2: Create Database Backup

```bash
# Using Supabase
# Navigate to Supabase dashboard > Database > Backups > Create backup

# Or using pg_dump
PGPASSWORD=$DATABASE_PASSWORD pg_dump \
  -h $DATABASE_HOST \
  -U $DATABASE_USER \
  -d $DATABASE_NAME \
  -F c \
  -f backup_$(date +%Y%m%d_%H%M%S).dump

# Verify backup file created
ls -lh backup_*.dump
```

**Expected**: Backup file created with non-zero size.

### Step 3: Apply Migration to Production

Migrations run automatically during Vercel build via `vercel-build` script:

```json
"vercel-build": "prisma migrate deploy && prisma generate && tsx prisma/seed.permissions.ts && next build"
```

**Manual Migration** (if needed):

```bash
# Set DATABASE_URL to production database
export DATABASE_URL="postgresql://..."

# Deploy migrations
npx prisma migrate deploy

# Verify migration applied
npx prisma migrate status
```

**Expected Output**:

```
The following migrations have been applied:
✓ 20240101120000_initial_schema
✓ 20240115140000_add_user_roles
✓ [NEW] 20240514100000_your_new_migration

All migrations have been successfully applied.
```

### Step 4: Deploy Application Code

Follow [Standard Deployment Process](#standard-deployment-process) above.

**Critical**: Ensure migration completes successfully before application code deploys. Vercel's `vercel-build` script handles this ordering automatically.

### Step 5: Verify Schema Changes

```bash
# Connect to production database
npx prisma studio --browser none

# Or query directly
psql $DATABASE_URL -c "\dt"  # List tables
psql $DATABASE_URL -c "\d users"  # Describe users table
```

---

## Emergency Rollback Procedures

### When to Rollback

Initiate rollback if:

- Application errors exceed 5% of requests (check Sentry)
- Database connection errors occur
- Critical functionality broken (checkout, payments, authentication)
- Data integrity issues detected
- Security vulnerability introduced

### Rollback Options

#### Option 1: Instant Rollback via Vercel Dashboard (Fastest)

**Use when**: Application code issue, no database schema changes

**Timeline**: 30-60 seconds

1. Open [Vercel Project Deployments](https://vercel.com/josemadrid-salsa/deployments)
2. Find last known good deployment (marked with ✓)
3. Click three-dot menu → "Promote to Production"
4. Confirm promotion
5. Monitor deployment status until "Ready"

```bash
# CLI alternative
vercel rollback josemadrid-salsa
```

#### Option 2: Rollback via Git Revert

**Use when**: Need to maintain deployment history, or Vercel rollback unavailable

**Timeline**: 3-5 minutes

```bash
# 1. Find commit hash of bad deployment
git log --oneline -10

# 2. Create revert commit
git revert [BAD_COMMIT_HASH] --no-edit

# 3. Push to main (triggers new deployment)
git push origin main
```

#### Option 3: Database Migration Rollback

**Use when**: Schema migration caused issues and must be reversed

**Timeline**: 5-15 minutes

**⚠️ WARNING**: This can cause data loss. Restore from backup if possible instead.

```bash
# 1. Set DATABASE_URL to production
export DATABASE_URL="postgresql://..."

# 2. Check migration status
npx prisma migrate status

# 3. Create rollback migration
# Create new migration that reverses changes
npx prisma migrate dev --name rollback_[FEATURE_NAME]

# 4. Manually edit migration SQL to reverse changes
# prisma/migrations/[TIMESTAMP]_rollback_[FEATURE]/migration.sql

# 5. Deploy rollback migration
npx prisma migrate deploy

# 6. Deploy previous application code version (Option 1 or 2 above)
```

**Alternative: Restore from Backup**

```bash
# 1. Download latest backup
# (from Supabase dashboard or storage location)

# 2. Restore database
pg_restore -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME backup_file.dump

# 3. Verify restore
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# 4. Rollback application code to matching version
```

### Post-Rollback Actions

- [ ] Post incident update in #deployments Slack channel
- [ ] Create incident report documenting root cause
- [ ] Schedule post-mortem meeting
- [ ] Update deployment checklist with new safeguards
- [ ] Re-test fix in staging before re-attempting deployment

---

## Post-Deployment Validation

### Automated Validation

```bash
# 1. Verify deployment is live
curl -I https://www.josemadrid.net
# Expected: HTTP/2 200

# 2. Verify build ID updated
curl -s https://www.josemadrid.net | grep "buildId"
```

### Manual Validation Checklist

#### Critical User Flows

- [ ] **Homepage loads** - https://www.josemadrid.net
- [ ] **Product catalog accessible** - https://www.josemadrid.net/products
- [ ] **Product detail page** - Click any product, verify images and details load
- [ ] **Add to cart** - Add product, verify cart badge updates
- [ ] **Checkout flow** - Navigate to /checkout (don't submit test order in production)
- [ ] **User authentication** - Sign in with test account
- [ ] **Admin dashboard** - https://www.josemadrid.net/admin (if applicable)

#### Performance Checks

```bash
# Run Lighthouse audit (requires Chrome)
npx lighthouse https://www.josemadrid.net --output html --output-path ./lighthouse-report.html

# Expected scores (minimum):
# Performance: 80+
# Accessibility: 90+
# Best Practices: 90+
# SEO: 90+
```

### Monitoring Dashboards

**Immediate Post-Deployment** (first 15 minutes):

1. **Vercel Analytics** - https://vercel.com/josemadrid-salsa/analytics
   - Monitor request volume
   - Check error rate (should be <1%)
   - Verify p95 response time (<500ms)

2. **Sentry Error Tracking** - https://sentry.io/organizations/josemadrid-salsa
   - Check for new error spikes
   - Review error details if rate increases
   - Set alert threshold: >10 errors/minute

3. **Amplitude Analytics** - https://analytics.amplitude.com
   - Verify event tracking functional
   - Check active user count normal
   - Monitor conversion funnel metrics

4. **Stripe Dashboard** - https://dashboard.stripe.com
   - Monitor successful payment rate
   - Check for webhook delivery failures
   - Verify no increase in failed charges

### Success Criteria

Deployment is successful when:

- [ ] All critical user flows functional
- [ ] Error rate <1% in Sentry
- [ ] Response time p95 <500ms in Vercel Analytics
- [ ] No increase in failed payments in Stripe
- [ ] Event tracking functional in Amplitude
- [ ] No customer support tickets related to deployment
- [ ] Monitoring dashboards show normal metrics for 30+ minutes

---

## Troubleshooting

### Common Deployment Issues

#### Issue: Build Fails with "Module not found"

**Symptoms**:

```
Error: Cannot find module '@/lib/utils'
```

**Root Cause**: Missing dependency or incorrect import path

**Resolution**:

```bash
# 1. Verify dependency in package.json
cat package.json | grep [MODULE_NAME]

# 2. Install missing dependency
npm install [PACKAGE_NAME]

# 3. Verify imports use correct path aliases
# Check tsconfig.json for path mappings

# 4. Clear Next.js cache and rebuild
rm -rf .next
npm run build
```

#### Issue: Deployment Succeeds but Shows Old Code

**Symptoms**: Changes not reflected on production site

**Root Cause**: Browser caching or CDN propagation delay

**Resolution**:

```bash
# 1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

# 2. Check deployment ID matches latest
curl -I https://www.josemadrid.net | grep x-vercel-id

# 3. Verify deployment marked as "Production" in Vercel dashboard

# 4. Check DNS propagation
dig www.josemadrid.net

# 5. Clear Vercel edge cache (if available)
# Navigate to Vercel dashboard → Settings → Purge cache
```

#### Issue: Database Connection Errors

**Symptoms**:

```
Error: P1001: Can't reach database server at `db.example.com`
```

**Root Cause**: Incorrect DATABASE_URL or connection limit exceeded

**Resolution**:

```bash
# 1. Verify DATABASE_URL environment variable set
vercel env ls

# 2. Test database connection
psql $DATABASE_URL -c "SELECT 1"

# 3. Check connection pooling settings
# Prisma connection limit: 10-20 for serverless
# Add to DATABASE_URL: ?connection_limit=10&pool_timeout=20

# 4. Verify database provider not experiencing downtime
# Check Supabase status page

# 5. Review database connection logs in provider dashboard
```

#### Issue: Prisma Migration Fails

**Symptoms**:

```
Error: P3009: Failed to apply migration
```

**Root Cause**: Schema conflict or incomplete migration

**Resolution**:

```bash
# 1. Check migration status
npx prisma migrate status

# 2. Review migration SQL for errors
cat prisma/migrations/[TIMESTAMP]_[NAME]/migration.sql

# 3. Reset migration state (DEVELOPMENT ONLY)
npx prisma migrate resolve --applied [MIGRATION_NAME]

# 4. For production, create corrective migration
npx prisma migrate dev --name fix_[ISSUE]

# 5. If unrecoverable, restore from backup
# See "Database Migration Rollback" section
```

#### Issue: Environment Variables Not Loading

**Symptoms**: Application behavior differs from local development

**Root Cause**: Environment variables not set in Vercel or incorrect values

**Resolution**:

```bash
# 1. List all environment variables
vercel env ls

# 2. Pull production environment locally for comparison
vercel env pull .env.vercel.production --environment=production

# 3. Add missing variables
vercel env add [VARIABLE_NAME] production
# Enter value when prompted

# 4. Redeploy to pick up new variables
vercel deploy --prod

# 5. Verify variables loaded at runtime
# Add temporary logging in API route:
# console.log('ENV CHECK:', { hasVar: !!process.env.VARIABLE_NAME })
```

### Deployment Checklist Reference

For detailed pre-deployment verification steps, see:

- [PRODUCTION_LAUNCH.md](./PRODUCTION_LAUNCH.md) - Complete production readiness guide
- [GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md) - CI/CD pipeline configuration
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Required environment variables

### Escalation Procedures

If deployment issues cannot be resolved within 30 minutes:

1. **Immediate**: Execute rollback procedures (see above)
2. **Notify**: Page on-call engineer via PagerDuty
3. **Escalate**: Contact Vercel support (support@vercel.com) for platform issues
4. **Document**: Create incident report with timeline and root cause
5. **Post-Mortem**: Schedule review within 48 hours

---

## Reference

### Vercel CLI Commands

```bash
# List deployments
vercel ls

# View deployment logs
vercel logs [DEPLOYMENT_URL]

# Promote deployment to production
vercel promote [DEPLOYMENT_URL]

# Rollback to previous deployment
vercel rollback

# List environment variables
vercel env ls

# Add environment variable
vercel env add [NAME] [ENVIRONMENT]

# Remove environment variable
vercel env rm [NAME] [ENVIRONMENT]

# Pull environment variables to local file
vercel env pull .env.local
```

### Database Commands

```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio

# Create database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Reset database (DEVELOPMENT ONLY - DESTRUCTIVE)
npx prisma migrate reset
```

### Monitoring URLs

- **Vercel Dashboard**: https://vercel.com/josemadrid-salsa
- **Vercel Analytics**: https://vercel.com/josemadrid-salsa/analytics
- **GitHub Actions**: https://github.com/josemadrid-salsa/josemadridsalsa/actions
- **Sentry**: https://sentry.io/organizations/josemadrid-salsa
- **Amplitude**: https://analytics.amplitude.com
- **Stripe Dashboard**: https://dashboard.stripe.com

### Build Configuration

#### package.json Scripts

```json
{
  "scripts": {
    "build": "cross-env NODE_ENV=production next build",
    "vercel-build": "prisma migrate deploy && prisma generate && tsx prisma/seed.permissions.ts && next build",
    "db:deploy": "prisma migrate deploy",
    "db:generate": "prisma generate"
  }
}
```

#### Vercel Configuration (vercel.json)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": true,
      "*": false
    }
  }
}
```

**Key Points**:

- Only `main` branch triggers production deployments
- All other branches/PRs create preview deployments
- Preview deployments use separate environment variables

### Related Documentation

- [PRODUCTION_LAUNCH.md](./PRODUCTION_LAUNCH.md) - Pre-launch checklist and environment setup
- [GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md) - CI/CD configuration and branch protection
- [DATABASE.md](./DATABASE.md) - Database setup and migration guide
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Complete environment variable reference
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) - Local development environment setup

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-05-14 | DevOps Team | Initial deployment runbook created |

**Last Updated**: 2026-05-14
