# Deployment Checklist

This comprehensive deployment checklist ensures consistent, safe deployments for the Jose Madrid Salsa application. Use this checklist for all production and staging deployments.

**Related Documentation:**
- [Deployment Runbook](../docs/DEPLOYMENT_RUNBOOK.md) - Step-by-step deployment procedures
- [Production Launch Guide](../docs/PRODUCTION_LAUNCH.md) - First-time production launch preparation
- [GitHub Integration](../docs/GITHUB_INTEGRATION.md) - Repository configuration and CI/CD setup

## Pre-Deployment Verification

### Code Quality

- [ ] **All unit tests passing**
  ```bash
  npm test
  ```
  Expected: All tests pass with no failures

- [ ] **All E2E tests passing**
  ```bash
  npm run test:e2e
  # Or: npx playwright test
  ```
  Expected: All Playwright tests pass

- [ ] **No linting errors**
  ```bash
  npm run lint
  ```
  Expected: 0 errors, 0 warnings

- [ ] **Type checking passes**
  ```bash
  npm run type-check
  ```
  Expected: No TypeScript errors

- [ ] **Production build succeeds**
  ```bash
  npm run build
  ```
  Expected: Build completes without errors

- [ ] **No console.log or debugging statements in production code**

### Branch Status

- [ ] **Pull request approved by required reviewers**
  - Check GitHub PR for approval status
  - Verify all requested changes addressed

- [ ] **All GitHub Actions CI checks passing**
  ```bash
  gh run list --branch main --limit 1
  ```
  Expected: All checks show green ✓

- [ ] **Branch up to date with base branch**
  ```bash
  git fetch origin
  git status
  ```
  Expected: "Your branch is up to date with 'origin/main'"

- [ ] **No merge conflicts**
  - Verify clean merge possible
  - Resolve any conflicts before proceeding

### Environment Variables

- [ ] **Environment variables verified in Vercel dashboard**
  - Navigate to Vercel project → Settings → Environment Variables
  - Verify all required variables present for target environment

- [ ] **Critical environment variables configured:**
  - [ ] `DATABASE_URL` - PostgreSQL connection string
  - [ ] `NEXTAUTH_URL` - Application URL (production: https://www.josemadridsalsa.com)
  - [ ] `NEXTAUTH_SECRET` - Authentication secret (32+ characters)
  - [ ] `ENCRYPTION_KEY` - 64-character base64 encryption key
  - [ ] `MASTER_KEY` - 64-character hex encryption key for admin panel

- [ ] **Payment integration variables (Stripe):**
  - [ ] `STRIPE_PUBLISHABLE_KEY` - Production key (pk_live_...)
  - [ ] `STRIPE_SECRET_KEY` - Production secret (sk_live_...)
  - [ ] `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (whsec_...)

- [ ] **Email service variables (Resend):**
  - [ ] `RESEND_API_KEY` - Production API key
  - [ ] `FROM_EMAIL` - Verified sender email
  - [ ] `RESEND_WEBHOOK_SECRET` - Webhook signing secret
  - [ ] `CRON_SECRET` - Cron job authentication token
  - [ ] `UNSUBSCRIBE_SECRET` - Unsubscribe token signing secret

- [ ] **Google services variables:**
  - [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Maps API key with billing enabled
  - [ ] `GOOGLE_PLACES_API_KEY` - Places API key
  - [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email
  - [ ] `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Service account private key
  - [ ] `GOOGLE_CALENDAR_ID` - Public calendar ID

- [ ] **Analytics and monitoring variables:**
  - [ ] `GOOGLE_ANALYTICS_ID` - GA4 measurement ID
  - [ ] `NEXT_PUBLIC_AMPLITUDE_API_KEY` - Amplitude project API key

See [ENVIRONMENT_VARIABLES.md](../docs/ENVIRONMENT_VARIABLES.md) for complete reference.

### Database

- [ ] **Database migrations reviewed (if any)**
  ```bash
  npx prisma migrate status
  ```
  Expected: All migrations applied or clear migration plan

- [ ] **Prisma schema changes validated**
  - Review schema changes for breaking changes
  - Verify backward compatibility if rolling deployment

- [ ] **Database backup created (for production)**
  - Verify latest backup timestamp
  - Test backup restoration procedure (staging environment)

- [ ] **Migration rollback plan documented (if applicable)**
  - Document steps to revert schema changes
  - Identify data loss risks

See [DATABASE.md](../docs/DATABASE.md) for database procedures.

### Third-Party Services

- [ ] **Stripe webhook endpoint verified**
  - Check webhook endpoint URL in Stripe dashboard
  - Verify webhook secret matches environment variable
  - See [STRIPE_WEBHOOK_SETUP.md](../docs/STRIPE_WEBHOOK_SETUP.md)

- [ ] **Resend email DNS verified**
  - Check DNS records (SPF, DKIM, DMARC)
  - Verify sender domain authentication
  - See [EMAIL_DNS_SETUP.md](../docs/EMAIL_DNS_SETUP.md)

- [ ] **Google API quotas sufficient**
  - Check Maps API quota usage
  - Verify Places API quota
  - Confirm Calendar API quota

### Security

- [ ] **Security review completed**
  - No exposed secrets or credentials
  - Environment variables not committed to git
  - API keys restricted to production domain

- [ ] **SSL certificate valid**
  - Verify certificate expiration date
  - Check for certificate warnings

- [ ] **CORS configuration verified**
  - Allowed origins restricted to production domain
  - No wildcard (*) origins in production

## Deployment Process

### Standard Deployment (No Database Changes)

- [ ] **Merge pull request to target branch**
  - Production: Merge to `main`
  - Staging: Merge to `develop` (if applicable)

- [ ] **Verify Vercel automatic deployment triggered**
  ```bash
  vercel ls --scope josemadrid-salsa
  # Or open dashboard:
  # https://vercel.com/josemadrid-salsa/dashboard
  ```

- [ ] **Monitor deployment progress**
  - Watch build logs in Vercel dashboard
  - Verify build completes without errors
  - Expected duration: 3-5 minutes

- [ ] **Wait for deployment to complete successfully**
  - Status changes from "Building" → "Ready"
  - Production URL updated

### Database Migration Deployment

If deployment includes database migrations, follow these additional steps:

- [ ] **Review migration plan**
  - Identify destructive operations (DROP, ALTER with data loss)
  - Confirm rollback strategy

- [ ] **Create pre-deployment database backup**
  ```bash
  # Via database provider dashboard or CLI
  ```

- [ ] **Apply migrations**
  ```bash
  npx prisma migrate deploy
  ```
  Expected: Migrations apply cleanly

- [ ] **Verify schema changes**
  ```bash
  npx prisma db pull
  # Compare with schema.prisma
  ```

See [DEPLOYMENT_RUNBOOK.md](../docs/DEPLOYMENT_RUNBOOK.md#database-migration-deployment) for detailed database deployment procedures.

### Stakeholder Communication

- [ ] **Notify team of deployment start**
  - Post in #deployments Slack channel (or equivalent)
  - Include: Environment, version, ETA, changes summary

- [ ] **Notify customer support team** (if user-facing changes)
  - Brief on new features or changes
  - Provide FAQ or support documentation

## Post-Deployment Validation

### Smoke Tests

- [ ] **Application loads without errors**
  - Visit production URL
  - Check browser console for errors
  - Verify no 500/404 errors

- [ ] **Homepage renders correctly**
  - Check layout and styling
  - Verify images load
  - Test responsive design

- [ ] **User authentication works**
  - Test sign in flow
  - Test sign out
  - Verify session persistence

- [ ] **Core user flows functional:**
  - [ ] Product browsing and search
  - [ ] Add to cart
  - [ ] Checkout process
  - [ ] Payment processing (test mode or small amount)
  - [ ] Order confirmation email

- [ ] **Admin panel accessible** (if applicable)
  - Test admin authentication
  - Verify admin functionality

- [ ] **Database connectivity verified**
  - Check application logs for database connection
  - Verify data loads correctly

### Performance Checks

- [ ] **Run Lighthouse audit**
  ```bash
  npx lighthouse https://www.josemadridsalsa.com --view
  ```
  Expected: Performance score > 80

- [ ] **Verify Core Web Vitals**
  - LCP (Largest Contentful Paint) < 2.5s
  - FID (First Input Delay) < 100ms
  - CLS (Cumulative Layout Shift) < 0.1

- [ ] **Check page load times**
  - Homepage loads in < 3 seconds
  - Product pages load in < 2 seconds

### Monitoring & Observability

- [ ] **No new errors in Vercel logs**
  - Check Vercel dashboard → Logs
  - Look for 4xx/5xx errors
  - Investigate any new error patterns

- [ ] **Application performance within acceptable range**
  - Check Vercel Analytics
  - Verify response times normal

- [ ] **Analytics tracking operational**
  - [ ] Google Analytics receiving events
  - [ ] Amplitude tracking active (if configured)

- [ ] **Error monitoring active**
  - Check error tracking service (if configured)
  - Verify error rates normal
  - Investigate any spikes

- [ ] **Third-party service health:**
  - [ ] Stripe webhook receiving events
  - [ ] Email delivery working (send test email)
  - [ ] Google Maps/Places API functioning

### Business Metrics

- [ ] **Revenue tracking operational** (for payment-related changes)
  - Verify test transaction completes
  - Check Stripe dashboard for transaction

- [ ] **Email delivery confirmed**
  - Test order confirmation email
  - Verify email templates render correctly
  - Check email delivery rate in Resend dashboard

## Rollback Procedure

If critical issues are discovered post-deployment, follow emergency rollback procedures:

### Option 1: Instant Rollback via Vercel Dashboard (Recommended)

- [ ] **Navigate to Vercel dashboard**
  - Go to https://vercel.com/josemadrid-salsa
  - Click "Deployments" tab

- [ ] **Find last known good deployment**
  - Identify deployment before problematic version
  - Verify deployment status shows "Ready"

- [ ] **Promote previous deployment to production**
  - Click "..." menu next to deployment
  - Select "Promote to Production"
  - Confirm promotion

- [ ] **Verify rollback successful**
  - Check production URL serves previous version
  - Verify issue is resolved

### Option 2: Git Revert (For Code Issues)

```bash
# 1. Revert the problematic commit
git revert <commit-sha>

# 2. Push to main to trigger new deployment
git push origin main

# 3. Monitor Vercel for new deployment
vercel ls --scope josemadrid-salsa
```

### Option 3: Database Migration Rollback (If Applicable)

- [ ] **Assess migration impact**
  - Identify migrations to rollback
  - Check for data loss risks

- [ ] **Restore database from backup** (if destructive migration)
  ```bash
  # Follow database provider's restore procedure
  ```

- [ ] **Revert migration** (if non-destructive)
  ```bash
  # Manually create down migration
  # OR restore from backup
  ```

See [DEPLOYMENT_RUNBOOK.md](../docs/DEPLOYMENT_RUNBOOK.md#emergency-rollback-procedures) for detailed rollback procedures.

### Post-Rollback Actions

- [ ] **Verify application functioning correctly**
  - Run smoke tests
  - Check error logs

- [ ] **Document incident**
  - Create postmortem document
  - Document root cause
  - Identify preventive measures

- [ ] **Notify stakeholders**
  - Post rollback notification in #deployments
  - Notify customer support team
  - Update status page (if applicable)

- [ ] **Create hotfix PR** (if needed)
  - Branch from main: `git checkout -b hotfix/issue-description`
  - Fix issue
  - Follow expedited deployment process

## Final Verification

- [ ] **All checklist items completed**
- [ ] **No critical errors in monitoring**
- [ ] **Team notified of successful deployment**
- [ ] **Deployment documented in release notes** (if applicable)

---

**For detailed step-by-step procedures, see:**
- [Deployment Runbook](../docs/DEPLOYMENT_RUNBOOK.md)
- [Production Launch Guide](../docs/PRODUCTION_LAUNCH.md)

**For issue tracking, use:**
- [GitHub Deployment Issue Template](./.github/ISSUE_TEMPLATE/deployment.yml)
