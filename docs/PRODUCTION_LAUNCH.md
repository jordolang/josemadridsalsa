# Production Launch Guide

This guide provides a comprehensive checklist and procedures for launching the Jose Madrid Salsa application to production on Vercel.

## Prerequisites

Before launching to production, ensure:

- [ ] All development and staging testing completed
- [ ] Admin access to Vercel project
- [ ] Admin access to GitHub repository
- [ ] Access to all third-party service accounts (Stripe, Google, Resend, etc.)
- [ ] DNS management access for domain configuration
- [ ] Database backup and restore procedures tested
- [ ] Incident response team identified and briefed

## Pre-Launch Checklist

### 1. Code Quality and Testing

- [ ] All unit tests passing locally and in CI
  ```bash
  npm run test
  ```
- [ ] All E2E tests passing
  ```bash
  npm run test:e2e
  ```
- [ ] No linting errors
  ```bash
  npm run lint
  ```
- [ ] Type checking passes
  ```bash
  npm run type-check
  ```
- [ ] All GitHub Actions CI checks passing
- [ ] No console.log or debugging statements in production code
- [ ] Security review completed (see [Security Review Guide](./SECURITY_REVIEW.md))

### 2. Environment Configuration

#### Database Setup

- [ ] Production database provisioned (Neon or other PostgreSQL provider)
- [ ] Database connection string obtained and tested
- [ ] Database migrations applied
  ```bash
  npx prisma migrate deploy
  ```
- [ ] Database backup strategy configured and tested
- [ ] Database performance indexes reviewed
- [ ] Connection pooling configured appropriately

See [DATABASE.md](./DATABASE.md) for detailed database setup instructions.

#### Environment Variables

Review and configure all required environment variables in Vercel. See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete reference.

**Critical Production Variables:**

- [ ] `DATABASE_URL` - Production PostgreSQL connection string
- [ ] `NEXTAUTH_URL` - Production URL (https://www.josemadrid.net)
- [ ] `NEXTAUTH_SECRET` - Strong random secret (32+ characters)
- [ ] `NEXTAUTH_COOKIE_DOMAIN` - Set to `.josemadrid.net` for subdomain sharing if needed
- [ ] `ENCRYPTION_KEY` - 64-character base64 encryption key
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
  ```
- [ ] `MASTER_KEY` - 64-character hex encryption key for admin panel
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

**Payment Processing:**

- [ ] `STRIPE_PUBLISHABLE_KEY` - Production publishable key (pk_live_...)
- [ ] `STRIPE_SECRET_KEY` - Production secret key (sk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` - Production webhook secret (whsec_...)

**Email Service:**

- [ ] `RESEND_API_KEY` - Production API key
- [ ] `FROM_EMAIL` - Verified sender email (orders@josemadridsalsa.com)
- [ ] `RESEND_WEBHOOK_SECRET` - Webhook signing secret
- [ ] `CRON_SECRET` - Bearer token for cron job authentication
- [ ] `UNSUBSCRIBE_SECRET` - Secret for signing unsubscribe tokens

**Google Services:**

- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Production Maps API key with billing enabled
- [ ] `GOOGLE_PLACES_API_KEY` - Places API key
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email
- [ ] `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` - Service account private key
- [ ] `GOOGLE_CALENDAR_ID` - Public calendar ID
- [ ] `GOOGLE_ANALYTICS_ID` - Production GA4 measurement ID

**Analytics and Monitoring:**

- [ ] `NEXT_PUBLIC_AMPLITUDE_API_KEY` - Production Amplitude key
- [ ] `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY` - Production GrowthBook SDK key
- [ ] `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED` - Set to `true` if enabled

**File Upload:**

- [ ] `UPLOADTHING_SECRET` - Production secret
- [ ] `UPLOADTHING_APP_ID` - Production app ID

**Shipping:**

- [ ] `SHIPPING_PROVIDER` - Set to `easypost` or `shippo`
- [ ] `SHIPPING_API_KEY` - Production API key
- [ ] `SHIPPING_TEST_MODE` - Set to `false` for production
- [ ] Shipping origin address configured

**AI Assistant (Optional):**

- [ ] `ANTHROPIC_API_KEY` - Production API key if using Claude AI

#### Vercel Configuration

Add environment variables to Vercel:

```bash
# Using Vercel CLI
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# ... add all other variables

# Or pull existing production environment
vercel env pull .env.vercel.production --environment=production
```

See [NEXTAUTH_PRODUCTION_CONFIG.md](./NEXTAUTH_PRODUCTION_CONFIG.md) for authentication-specific setup.

### 3. Third-Party Service Configuration

#### Stripe

- [ ] Account in production mode (not test mode)
- [ ] Payment methods configured (cards, digital wallets)
- [ ] Webhook endpoint configured: `https://www.josemadrid.net/api/webhooks/stripe`
- [ ] Webhook events selected:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
- [ ] Webhook secret obtained and added to environment variables
- [ ] Test payment processed successfully
- [ ] Refund process tested

See [STRIPE_WEBHOOK_SETUP.md](./STRIPE_WEBHOOK_SETUP.md) for detailed configuration.

#### Resend Email

- [ ] Domain verified (josemadridsalsa.com)
- [ ] DNS records configured (SPF, DKIM, DMARC)
- [ ] Sender email verified (orders@josemadridsalsa.com)
- [ ] Webhook endpoint configured: `https://www.josemadrid.net/api/webhooks/resend`
- [ ] Test email sent and received successfully
- [ ] Email templates reviewed for production content
- [ ] Unsubscribe handling tested

See [EMAIL_SYSTEM.md](./EMAIL_SYSTEM.md) and [EMAIL_DNS_SETUP.md](./EMAIL_DNS_SETUP.md) for email configuration.

#### Google Services

**Calendar API:**
- [ ] Service account created with domain-wide delegation
- [ ] Calendar API enabled in Google Cloud Console
- [ ] Calendar shared with service account
- [ ] Test event retrieval working

See [GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md).

**Maps and Places:**
- [ ] Google Maps JavaScript API enabled
- [ ] Places API enabled
- [ ] Street View Static API enabled (optional)
- [ ] Billing account configured and alerts set
- [ ] API key restrictions configured (HTTP referrers)
- [ ] Daily quota limits set appropriately

See [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md) and [GOOGLE_PLACES_SETUP.md](./GOOGLE_PLACES_SETUP.md).

**Analytics:**
- [ ] GA4 property created for production
- [ ] Data stream configured for www.josemadrid.net
- [ ] Events tracking verified
- [ ] Goals and conversions configured

#### UploadThing

- [ ] Production app created
- [ ] File upload limits configured
- [ ] Allowed file types restricted
- [ ] CDN settings configured
- [ ] Test file upload working

#### Shipping Provider (EasyPost or Shippo)

- [ ] Production account created
- [ ] API key obtained
- [ ] Shipping rates tested with real addresses
- [ ] Label printing verified
- [ ] Return labels configured if needed

### 4. Domain and DNS Configuration

- [ ] Domain registered and ownership verified
- [ ] DNS managed by reliable provider (Cloudflare, Route53, etc.)
- [ ] DNS records configured:
  - A/AAAA or CNAME for www.josemadrid.net → Vercel
  - TXT records for email verification (SPF, DKIM, DMARC)
  - TXT records for domain verification (Google, etc.)
- [ ] SSL certificate provisioned and valid
- [ ] HTTPS redirect enabled
- [ ] WWW redirect configured (if using apex domain)
- [ ] DNS propagation verified (48-72 hours)

### 5. Monitoring and Observability

#### Vercel Analytics

- [ ] Vercel Analytics enabled for production project
- [ ] Real User Monitoring (RUM) configured
- [ ] Web Vitals tracking enabled
- [ ] Function logs retention configured

#### Amplitude Analytics

- [ ] Production project created
- [ ] API key configured in environment variables
- [ ] Key events defined and verified:
  - Page views
  - Add to cart
  - Checkout started
  - Purchase completed
  - Sign up / Sign in
- [ ] User properties configured
- [ ] Funnels created for conversion tracking

#### Error Tracking

Consider adding error tracking (Sentry, Rollbar, etc.):

- [ ] Error tracking service configured
- [ ] Source maps uploaded for stack traces
- [ ] Alert rules configured
- [ ] Integration with incident management

#### Uptime Monitoring

Set up external uptime monitoring:

- [ ] Uptime monitoring service configured (UptimeRobot, Pingdom, etc.)
- [ ] Health check endpoint monitored: `https://www.josemadrid.net/api/health`
- [ ] Alert thresholds configured
- [ ] Notification channels set (email, Slack, SMS)

### 6. Performance Optimization

- [ ] Image optimization configured (Next.js Image component)
- [ ] Font optimization (next/font)
- [ ] Code splitting reviewed
- [ ] Bundle size analyzed
  ```bash
  npm run build
  # Review bundle analyzer output
  ```
- [ ] Lighthouse CI scores acceptable:
  - Performance: 90+
  - Accessibility: 95+
  - Best Practices: 95+
  - SEO: 95+
- [ ] Critical rendering path optimized
- [ ] Database queries optimized (N+1 queries eliminated)
- [ ] API route response times acceptable (<500ms P95)

### 7. Security Hardening

- [ ] Environment variables never exposed to client
- [ ] API routes protected with authentication where needed
- [ ] Rate limiting configured for public endpoints
- [ ] CORS configured appropriately
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS prevention (React escaping)
- [ ] CSRF protection enabled (NextAuth)
- [ ] Secrets rotation schedule established
- [ ] DDoS protection configured (Vercel Pro or Cloudflare)

### 8. Compliance and Legal

- [ ] Privacy policy published and linked
- [ ] Terms of service published and linked
- [ ] Cookie consent banner configured (if required)
- [ ] GDPR compliance reviewed (if applicable)
- [ ] CCPA compliance reviewed (if applicable)
- [ ] Accessibility standards met (WCAG 2.1 Level AA)
- [ ] PCI DSS compliance (handled by Stripe)

### 9. Content Review

- [ ] All placeholder content replaced
- [ ] Contact information verified and current
- [ ] Product descriptions reviewed for accuracy
- [ ] Pricing verified
- [ ] Legal pages reviewed by legal counsel
- [ ] Error messages are user-friendly
- [ ] Help documentation complete

### 10. Rollback Plan

- [ ] Previous stable version identified
- [ ] Rollback procedure documented
- [ ] Database migration rollback tested
- [ ] Emergency contact list prepared
- [ ] Communication plan for downtime

## Launch Day Procedures

### Step 1: Final Pre-Launch Verification

1. **Verify GitHub CI Status**
   - All checks passing on main branch
   - Latest commit deployed to staging
   - No known issues in backlog

2. **Staging Environment Verification**
   ```bash
   # Test critical user flows
   # - User registration
   # - Product browsing
   # - Add to cart
   # - Checkout and payment
   # - Order confirmation email
   # - Admin panel access
   ```

3. **Database Backup**
   ```bash
   # Create backup before launch
   # Document backup location and restoration procedure
   ```

### Step 2: Deploy to Production

1. **Merge to Production Branch**
   ```bash
   git checkout main
   git pull origin main
   # Verify latest changes are included
   git log -5
   ```

2. **Tag Release**
   ```bash
   git tag -a v1.0.0 -m "Production launch"
   git push origin v1.0.0
   ```

3. **Deploy via Vercel**
   - Vercel automatically deploys on push to main (if configured)
   - Or manual deploy:
     ```bash
     vercel --prod
     ```

4. **Monitor Deployment**
   - Watch Vercel deployment logs
   - Verify build completes successfully
   - Check for any deployment warnings

### Step 3: Post-Deployment Verification

**Immediate Checks (0-5 minutes):**

- [ ] Homepage loads successfully: https://www.josemadrid.net
- [ ] Health check endpoint returns 200: https://www.josemadrid.net/api/health
- [ ] NextAuth session endpoint returns JSON: https://www.josemadrid.net/api/auth/session
- [ ] Static assets loading (images, CSS, JS)
- [ ] No JavaScript console errors
- [ ] SSL certificate valid and HTTPS working

**Functional Testing (5-15 minutes):**

- [ ] User registration flow works
- [ ] User login flow works
- [ ] Password reset flow works
- [ ] Product browsing works
- [ ] Search functionality works
- [ ] Add to cart works
- [ ] Checkout flow works end-to-end
- [ ] Test payment processes successfully (small test purchase)
- [ ] Order confirmation email received
- [ ] Admin panel accessible
- [ ] Calendar integration displays events
- [ ] Google Maps displays correctly
- [ ] Reviews display correctly

**Monitoring Checks (15-60 minutes):**

- [ ] Vercel function logs show no errors
- [ ] Amplitude events flowing correctly
- [ ] Google Analytics receiving data
- [ ] No error spikes in monitoring
- [ ] Response times within acceptable range
- [ ] Database connections healthy

### Step 4: Enable Production Features

- [ ] Enable Vercel Analytics
- [ ] Enable GrowthBook feature flags
- [ ] Configure production cron jobs (if any)
- [ ] Enable scheduled database backups
- [ ] Activate uptime monitoring alerts

### Step 5: Post-Launch Communication

- [ ] Notify stakeholders of successful launch
- [ ] Update status page (if applicable)
- [ ] Post announcement (social media, blog, etc.)
- [ ] Begin monitoring customer feedback channels

## Monitoring and Maintenance (First 24-72 Hours)

### Critical Metrics to Monitor

**Performance:**
- [ ] Page load times (P50, P95, P99)
- [ ] API response times
- [ ] Function execution duration
- [ ] Database query times
- [ ] Error rates

**Business:**
- [ ] Number of signups
- [ ] Number of orders
- [ ] Conversion rate
- [ ] Cart abandonment rate
- [ ] Payment success rate

**Infrastructure:**
- [ ] Function invocations
- [ ] Bandwidth usage
- [ ] Database connections
- [ ] Memory usage
- [ ] CPU usage

### On-Call Procedures

**First 24 Hours: Active Monitoring**
- Check metrics every 2-4 hours
- Review error logs for any unexpected issues
- Monitor customer support channels for issues
- Be prepared for quick rollback if critical issues arise

**24-72 Hours: Regular Monitoring**
- Check metrics twice daily
- Review daily summary reports
- Address any non-critical issues found
- Collect user feedback

**After 72 Hours: Standard Monitoring**
- Transition to regular monitoring cadence
- Schedule post-launch retrospective
- Document lessons learned
- Update runbooks based on experience

## Troubleshooting Common Issues

### Issue: 500 Errors on Auth Routes

**Symptoms:**
- `/api/auth/session` returns HTML instead of JSON
- LOGIN_ERROR or CLIENT_FETCH_ERROR in browser console

**Root Causes:**
- Missing NEXTAUTH_SECRET
- Incorrect NEXTAUTH_URL
- Database connection issue

**Resolution:**
1. Check Vercel environment variables are set
2. Verify DATABASE_URL connectivity
3. Check function logs for specific error
4. See [NEXTAUTH_PRODUCTION_CONFIG.md](./NEXTAUTH_PRODUCTION_CONFIG.md)

### Issue: Payment Processing Fails

**Symptoms:**
- Checkout completes but payment not processed
- Stripe webhook errors in logs

**Root Causes:**
- Incorrect webhook secret
- Webhook endpoint not reachable
- Using test keys instead of live keys

**Resolution:**
1. Verify STRIPE_WEBHOOK_SECRET matches Stripe dashboard
2. Test webhook endpoint: `https://www.josemadrid.net/api/webhooks/stripe`
3. Confirm using live keys (pk_live_, sk_live_)
4. Check Stripe dashboard webhook delivery logs

### Issue: Emails Not Sending

**Symptoms:**
- Order confirmation emails not received
- No errors in application logs

**Root Causes:**
- Resend API key incorrect
- Domain not verified
- DNS records not propagated
- Rate limits exceeded

**Resolution:**
1. Verify RESEND_API_KEY is production key
2. Check domain verification in Resend dashboard
3. Verify DNS records (SPF, DKIM, DMARC)
4. Check Resend dashboard for delivery logs
5. See [EMAIL_SYSTEM.md](./EMAIL_SYSTEM.md)

### Issue: High Response Times

**Symptoms:**
- Slow page loads
- Function timeout errors
- Poor user experience

**Root Causes:**
- Database query performance
- N+1 query problems
- Large payload sizes
- Unoptimized images

**Resolution:**
1. Check database query performance
2. Review function execution logs
3. Analyze bundle size
4. Enable Next.js analytics to identify bottlenecks
5. See [PERFORMANCE.md](./PERFORMANCE.md)

### Issue: Google Maps Not Loading

**Symptoms:**
- Map component shows error
- "This page can't load Google Maps correctly"

**Root Causes:**
- API key not configured
- Billing not enabled
- API restrictions blocking domain
- Quota exceeded

**Resolution:**
1. Verify NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set
2. Check billing in Google Cloud Console
3. Review API key restrictions (allow www.josemadrid.net)
4. Check quota usage and limits
5. See [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md)

## Rollback Procedures

### When to Roll Back

Roll back immediately if:
- Critical functionality broken (checkout, payments)
- Security vulnerability discovered
- Data corruption occurring
- Error rate exceeds 5%
- Site completely unavailable

### Rollback Steps

1. **Identify Previous Stable Version**
   ```bash
   # List recent deployments
   vercel list
   
   # Or check git tags
   git tag -l
   ```

2. **Rollback via Vercel Dashboard**
   - Go to Deployments tab
   - Find last stable deployment
   - Click "..." → "Promote to Production"

3. **Or Rollback via CLI**
   ```bash
   # Deploy specific commit
   vercel --prod --yes --force --target production
   ```

4. **Verify Rollback**
   - [ ] Site loads successfully
   - [ ] Critical paths working
   - [ ] Error rate normalized

5. **Database Rollback (if needed)**
   - Restore from backup taken before deployment
   - Run migration rollback if safe:
     ```bash
     # Review migration before running
     npx prisma migrate diff --from-migrations
     ```
   - **Warning:** Database rollbacks can cause data loss. Only do if absolutely necessary.

6. **Post-Rollback**
   - Document incident
   - Identify root cause
   - Create hotfix plan
   - Communicate status to stakeholders

## Post-Launch Review

Schedule a retrospective 1-2 weeks after launch:

### Review Topics

- [ ] What went well during launch?
- [ ] What issues were encountered?
- [ ] How quickly were issues resolved?
- [ ] Were monitoring and alerting adequate?
- [ ] Was documentation helpful?
- [ ] What would we do differently next time?

### Action Items

- [ ] Update this guide based on experience
- [ ] Create runbooks for common issues encountered
- [ ] Improve monitoring for blind spots discovered
- [ ] Schedule follow-up infrastructure improvements
- [ ] Document any technical debt created during launch

## Ongoing Maintenance

### Weekly Tasks

- [ ] Review error logs and address trends
- [ ] Check performance metrics and optimize if degraded
- [ ] Review security alerts
- [ ] Update dependencies with security patches
- [ ] Review and respond to user feedback

### Monthly Tasks

- [ ] Full security audit
- [ ] Performance baseline comparison
- [ ] Cost optimization review
- [ ] Backup and restore testing
- [ ] Disaster recovery drill
- [ ] Rotate secrets if policy requires

### Quarterly Tasks

- [ ] Infrastructure capacity planning
- [ ] Major dependency updates
- [ ] Accessibility audit
- [ ] SEO optimization review
- [ ] Compliance review (GDPR, CCPA, etc.)

## Support Resources

### Internal Documentation

- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [GitHub Integration](./GITHUB_INTEGRATION.md)
- [Database Setup](./DATABASE.md)
- [Email System](./EMAIL_SYSTEM.md)
- [Performance Guide](./PERFORMANCE.md)
- [API Documentation](./API.md)

### External Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Stripe Production Checklist](https://stripe.com/docs/keys#test-live-modes)
- [Resend Documentation](https://resend.com/docs)
- [Google Cloud Console](https://console.cloud.google.com)

### Emergency Contacts

Document key contacts for production incidents:

- **Development Team Lead:** [Name and contact]
- **DevOps/Infrastructure:** [Name and contact]
- **Product Owner:** [Name and contact]
- **Hosting (Vercel):** support@vercel.com
- **Payment Provider (Stripe):** support@stripe.com
- **Email Provider (Resend):** support@resend.com

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-05-14 | 1.0 | Initial production launch guide | Auto-Claude |

---

**Note:** This is a living document. Update it based on your actual launch experience and evolving best practices.
