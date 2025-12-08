# Cherry-Pick Integration Plan

## Strategy
Starting from `integration-final` (based on GitHub main with working products), we'll cherry-pick commits from `lucid-hodgkin` in logical groups, testing after each group.

## Current Status
- **Base Branch:** `integration-final` (created from `origin/main`)
- **Source Branch:** `lucid-hodgkin` (149 commits ahead)
- **Goal:** Integrate all features while maintaining products functionality

---

## Phase 1: Foundation & Schema Updates (CRITICAL)

### 1.1 Database Schema - Complete Extension
**Priority:** HIGHEST - Must do first
**Risk:** Medium (schema changes affect everything)

**Action:** Instead of cherry-picking schema commits, we'll directly copy the updated schema from `lucid-hodgkin`

**New Schema Features:**
- `AnalyticsSetting` model (Google Analytics config)
- `EmailTemplate` with enhanced fields (category, sentCount, lastSentAt)
- `EmailConfiguration` model (SMTP settings)
- `EmailCampaign` model (mass mailing)
- `EmailRecipient` model (campaign tracking)
- `EngagementRequest` model (newsletter/contact tracking)
- `DocumentationEntry` model (docs management)
- Enhanced `Order` model (confirmationEmailSentAt, shopify fields reordered)
- New enums: EmailTemplateCategory, EmailCampaignStatus, EmailRecipientStatus, EngagementType, EngagementStatus, DocumentationVisibility

**Test After:**
- `npm install`
- `npx prisma db push`
- `npx prisma generate`
- Verify dev server starts

---

## Phase 2: Package Dependencies

### 2.1 Update package.json
**Priority:** HIGH
**Risk:** Medium (version conflicts)

**New Dependencies (from lucid-hodgkin):**
- `@types/nodemailer: ^7.0.4`
- `@vercel/analytics: ^1.5.0`
- `framer-motion: ^12.23.25`
- `gray-matter: ^4.0.3`
- `nodemailer: ^7.0.11`
- `next: ^16.0.5` (upgrade from 15.5.7)

**New Scripts:**
- `db:seed:email-templates`
- `shopify:test-webhook`
- `db:production:sync`
- `db:production:seed`
- `db:production:pull-env`

**Test After:**
- `npm install`
- Verify no dependency conflicts
- Test dev server

---

## Phase 3: Email Campaign System

### 3.1 Email Templates & Configuration
**Commits:** Will identify specific commits
**Files:**
- `app/admin/settings/email/` (entire directory)
- `app/api/admin/email-templates/` (entire directory)
- `scripts/seed-email-templates.ts`
- `lib/email/sender.ts`
- `lib/email/automation.ts`
- `lib/email/template-library.ts`

### 3.2 Email Campaigns
**Files:**
- `app/admin/email-campaigns/` (entire directory)
- Related API routes

**Test After:**
- Visit `/admin/settings/email`
- Visit `/admin/email-campaigns`
- Check for TypeScript errors

---

## Phase 4: Newsletter & Engagement

### 4.1 Newsletter API
**Files:**
- `app/api/newsletter/route.ts`
- `app/api/fundraiser-signups/route.ts`
- `lib/engagements.ts`

### 4.2 Engagement Components
**Files:**
- `components/fundraising/fundraiser-signup-form.tsx`

**Test After:**
- Test newsletter signup flow
- Check API endpoints respond

---

## Phase 5: Analytics Enhancements

### 5.1 Google Analytics Integration
**Commits:** f87409c7, ff27a8ee, f04c403b
**Files:**
- `lib/google-analytics-config.ts`
- `lib/google-analytics-reports.ts`
- `lib/analytics/date-range.ts`
- `app/admin/analytics/page.tsx` (major update)
- `types/analytics.ts`

**Test After:**
- Visit `/admin/analytics`
- Check dashboard loads
- Verify no TypeScript errors

---

## Phase 6: API Enhancements

### 6.1 Salsas-Specific Routes
**Files:**
- `app/api/salsas/route.ts`
- `app/api/salsas/featured/route.ts`

### 6.2 Places Photo Proxy
**Files:**
- `app/api/places/photo/route.ts`

**Test After:**
- Test API endpoints
- Verify products still work

---

## Phase 7: UI Components & Features

### 7.1 New Components
**Files:**
- `components/store/animated-testimonials.tsx`
- `components/store/location-map.tsx`
- `components/ui/footer-column.tsx`
- `components/ui/sidebar.tsx`
- `components/ui/demo.tsx`

### 7.2 Location Features
**Files:**
- Location map updates
- Street View integration

**Test After:**
- Check homepage
- Test location pages
- Verify no visual regressions

---

## Phase 8: Configuration & Infrastructure

### 8.1 Production Scripts
**Files:**
- `scripts/seed-production.js`
- `scripts/sync-production-schema.js`
- `scripts/test-production-webhook.sh`
- `scripts/test-training-page.mjs`
- `scripts/seed-email-templates.ts`

### 8.2 ESLint & Config Updates
**Files:**
- `eslint.config.mjs`
- Updated `.gitignore`
- Updated `.vercelignore`

**Test After:**
- `npm run lint`
- `npm run type-check`

---

## Phase 9: Documentation & Assets

### 9.1 Documentation
**Files:**
- All new `.md` files in `docs/`
- Updated README

### 9.2 Assets
**Files:**
- New images
- Fundraiser forms PDFs
- Updated product images

**Test After:**
- Quick visual check

---

## Phase 10: Final Testing

### 10.1 Critical Path Testing
- [ ] Products page displays correctly
- [ ] Product detail pages work
- [ ] Cart functionality works
- [ ] Checkout flow works
- [ ] Admin panel accessible
- [ ] Email campaigns work
- [ ] Analytics dashboard loads
- [ ] Newsletter signup works

### 10.2 Build Testing
```bash
npm run type-check
npm run lint
npm run build
```

### 10.3 Database Testing
```bash
npm run db:push
npm run db:seed
npm run db:seed:email-templates
```

---

## Rollback Plan

If anything breaks critically:
1. Identify the breaking commit
2. `git revert <commit-hash>`
3. Test again
4. Analyze what went wrong
5. Fix and re-apply

---

## Progress Tracking

- [ ] Phase 1: Schema Updates
- [ ] Phase 2: Package Dependencies
- [ ] Phase 3: Email Campaign System
- [ ] Phase 4: Newsletter & Engagement
- [ ] Phase 5: Analytics Enhancements
- [ ] Phase 6: API Enhancements
- [ ] Phase 7: UI Components
- [ ] Phase 8: Configuration
- [ ] Phase 9: Documentation
- [ ] Phase 10: Final Testing

---

## Notes

- We're NOT cherry-picking individual commits due to the complex history
- Instead, we'll selectively copy entire feature directories
- This approach is safer and cleaner for such a large integration
- Each phase can be committed separately for granular rollback capability
