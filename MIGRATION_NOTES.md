# Repository Migration Investigation Notes

## Investigation Date
2026-06-19

## Fundraising Repository Investigation

### Repository Information
- **URL**: https://github.com/jordolang/josemadridsalsa-fundraising
- **Target Path**: `apps/fundraising`
- **Status**: ⚠️ NOT ACCESSIBLE

### Access Issues
1. **HTTP 404**: Repository returns "Not Found" when accessed via web
2. **GitHub CLI**: Forbidden error when attempting to access via `gh` CLI
3. **Git Clone**: Unable to clone - repository either doesn't exist, is private, or requires authentication

### Current State Analysis

#### Fundraising Functionality Already Exists in Storefront
The fundraising features are **already fully implemented** within `apps/storefront`:

**Key Directories:**
- `apps/storefront/app/(public)/fundraising/` - Public fundraising landing page
- `apps/storefront/app/admin/fundraisers/` - Admin management interface
- `apps/storefront/lib/fundraising/` - Core fundraising logic
- `apps/storefront/components/fundraising/` - Fundraising UI components
- `apps/storefront/components/fundraiser/` - Campaign components
- `apps/storefront/components/fundraiser-portal/` - Portal blocks and analytics

**Major Features Identified:**
1. **Public Pages**:
   - `/fundraising` - Main fundraising landing page with testimonials
   - `/fundraisers/[slug]` - Individual campaign pages
   - `/fundraisers/[slug]/dashboard/[participantCode]` - Participant dashboards
   - `/fundraise/signup` - Campaign signup flow

2. **Fundraising Components**:
   - `FundraiserSignupForm` - Campaign registration
   - `ParticipantDashboard` - Individual fundraiser tracking
   - `FundraisingThermometer` - Visual progress tracking
   - `ReferralLinkDisplay` - Referral tracking
   - `ActiveCampaignsGrid` - Display active campaigns
   - `CampaignStats` - Analytics and metrics

3. **Core Libraries**:
   - `referral-tracker.ts` - Referral system (client/server split)
   - `calculate-commission.ts` - Commission calculations

4. **Database Schema**:
   - Fundraiser tables in `prisma/schema.prisma`
   - Migration: `20260317000000_baseline/migration.sql`

5. **API Routes**:
   - `/api/fundraiser-signups` - Campaign creation
   - `/api/checkout` - Fundraiser checkout integration

6. **Admin Interface**:
   - `/admin/fundraisers` - Campaign list
   - `/admin/fundraisers/new` - Create new campaign
   - `/admin/fundraisers/[id]/participants` - Participant management
   - `/admin/fundraisers/[id]/manage` - Campaign management

7. **Tests**:
   - E2E: `fundraising-campaign-workflow.test.ts`
   - API: `fundraiser-signups.test.ts`, `checkout.test.ts`
   - Email: Campaign emails (launch, summary, participant welcome)
   - Manual test guide: `FUNDRAISING_MANUAL_TEST_GUIDE.md`

### Tech Stack (from existing storefront implementation)
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: Prisma ORM with PostgreSQL
- **UI**: React with custom components + shadcn/ui patterns
- **Forms**: Zod validation
- **Email**: Resend templates for fundraising emails
- **Authentication**: Integrated with storefront auth system

### Dependencies (from existing implementation)
Based on the fundraising code in storefront, these are the key dependencies:
- Next.js
- React
- Prisma
- Zod (validation)
- lucide-react (icons)
- Email template system (Resend)

### Deployment Configuration
The existing storefront fundraising features are deployed as part of the main Next.js application. Configuration includes:
- **Routing**: Subdomain routing for fundraiser portals (`(fundraiser-subdomain)` route group)
- **Public routes**: `/fundraising`, `/fundraisers/[slug]`
- **Protected routes**: Admin interfaces require authentication
- **Database**: Shared Prisma database with storefront

### Next Steps & Recommendations

#### Scenario 1: External Repository Doesn't Exist Yet
If the external repository is planned but not yet created, the migration should:
1. **Skip**: No code to migrate from external source
2. **Document**: Fundraising is already complete in storefront
3. **Consider**: Whether fundraising should remain in storefront or be extracted

#### Scenario 2: External Repository Is Private
If the repository exists but is private:
1. **Action Required**: Obtain access credentials/permissions
2. **Authentication**: Configure `gh auth login` or provide access token
3. **Re-run**: Investigation once access is granted

#### Scenario 3: Already Consolidated
If fundraising was meant to be separated but is already consolidated:
1. **Verify**: Current architecture meets requirements
2. **Document**: No migration needed - already in monorepo
3. **Update**: Spec and documentation to reflect current state

### References in Documentation
- **README.md** (lines 112-114): References external fundraising repository
- **AGENTS.md** (line 51): References external fundraising repository

These references suggest the external repositories were planned or existed at some point but may have been consolidated already, or the separation is still planned.

---

## Admin Repository Investigation

### Repository Information
- **URL**: https://github.com/jordolang/josemadridsalsa-admin
- **Target Path**: `apps/admin`
- **Status**: ⚠️ NOT ACCESSIBLE
- **Investigation Date**: 2026-06-19

### Access Issues
1. **HTTP 404**: Repository returns "Not Found" when accessed via web
2. **GitHub CLI**: Forbidden error when attempting to access via `gh` CLI
3. **Git Clone**: Unable to clone - repository either doesn't exist, is private, or requires authentication

### Current State Analysis

#### Admin Functionality Already Exists in Storefront
The admin interface is **already fully implemented** within `apps/storefront` as a comprehensive, production-ready administration platform.

**Directory Structure:**
```
apps/storefront/app/admin/          - 123+ directories with admin routes
apps/storefront/components/admin/   - Shared admin UI components
apps/storefront/app/api/admin/      - 30+ admin API endpoints
apps/storefront/lib/admin/          - Admin utility libraries
```

**Total Files**: 415+ admin-related TypeScript/TSX/CSS files

**Major Admin Sections:**

1. **Dashboard & Analytics**:
   - `/admin` - Main dashboard with overview
   - `/admin/analytics` - Analytics with charts and metrics
   - `/admin/analytics/orders` - Order analytics
   - `/admin/analytics/inventory` - Inventory analytics
   - `/admin/analytics/fundraisers` - Fundraiser analytics
   - `/admin/analytics/social` - Social media analytics
   - Google Analytics integration
   - Custom chart builder

2. **E-Commerce Management**:
   - `/admin/orders` - Order management and fulfillment
   - `/admin/products` - Product catalog management
   - `/admin/categories` - Category management
   - `/admin/inventory` - Inventory tracking and alerts
   - `/admin/reviews` - Customer reviews moderation
   - `/admin/gift-certificates` - Gift certificate management
   - `/admin/invoices` - Invoice generation and management
   - `/admin/wholesale` - Wholesale accounts management

3. **Fundraising Administration**:
   - `/admin/fundraisers` - Campaign management
   - `/admin/fundraisers/new` - Create new campaigns
   - `/admin/fundraisers/[id]/participants` - Participant management
   - `/admin/fundraisers/[id]/manage` - Campaign settings
   - `/admin/fundraisers/[id]/messages` - Campaign messaging
   - `/admin/fundraisers/accounts` - Fundraiser account management
   - `/admin/fundraisers/battle-arena` - Battle Arena season management
   - `/admin/fundraisers/signups` - Signup management

4. **Content Management**:
   - `/admin/blog` - Blog post management
   - `/admin/blog/categories` - Blog categories
   - `/admin/blog/comments` - Comment moderation
   - `/admin/blog/series` - Blog series management
   - `/admin/content` - General content management
   - `/admin/media` - Media library
   - `/admin/events` - Event management
   - `/admin/seo` - SEO settings and optimization

5. **Marketing & Communications**:
   - `/admin/email-campaigns` - Email campaign builder
   - `/admin/email-marketing` - Email marketing dashboard
   - `/admin/email-marketing/automations` - Email automation workflows
   - `/admin/email-marketing/brand-kit` - Brand kit management
   - `/admin/email-marketing/logs` - Email delivery logs
   - `/admin/email-templates` - Template management
   - `/admin/communications` - Communication hub
   - `/admin/communications/lists` - Mailing list management
   - `/admin/communications/suppressions` - Email suppression lists
   - `/admin/lead-generation` - Lead generation campaigns
   - `/admin/social` - Social media management
   - `/admin/growth` - Growth tools and analytics

6. **User & Access Management**:
   - `/admin/users` - User management
   - `/admin/credentials` - Credential management with breach checking
   - `/admin/audit-logs` - Security audit logs
   - Role-Based Access Control (RBAC) with permissions system
   - Roles: ADMIN, DEVELOPER, STAFF, WHOLESALE, FUNDRAISER, CUSTOMER

7. **Financial Management**:
   - `/admin/financials` - Financial dashboard
   - `/admin/financials/expenses` - Expense tracking
   - `/admin/financials/taxes` - Tax management
   - `/admin/financials/payroll` - Payroll management

8. **Developer Tools**:
   - `/admin/developer` - Developer dashboard
   - `/admin/developer/blog` - Developer blog management
   - `/admin/developer/content` - Developer content
   - `/admin/developer/files` - File management
   - `/admin/developer/salsadocs` - Documentation management

9. **Settings & Configuration**:
   - `/admin/settings` - General settings
   - `/admin/settings/profile` - Profile settings
   - `/admin/settings/email` - Email configuration (SMTP, Resend)
   - `/admin/settings/payments` - Payment gateway settings
   - `/admin/settings/shipping` - Shipping configuration
   - `/admin/settings/discount-codes` - Discount code management
   - `/admin/settings/integrations` - Third-party integrations

10. **Additional Features**:
    - `/admin/messages` - Message management
    - `/admin/messages/live` - Live chat interface
    - `/admin/forms` - Form builder and management
    - `/admin/locations` - Location management with photo galleries
    - `/admin/tags` - Tag management
    - `/admin/training-data` - AI training data management
    - `/admin/merchandise` - Merchandise management

### Tech Stack (from existing storefront implementation)

**Framework & Core**:
- Next.js 14+ (App Router)
- TypeScript
- React Server Components & Client Components
- Server Actions for mutations

**UI & Styling**:
- shadcn/ui components
- Tailwind CSS
- Radix UI primitives
- lucide-react icons
- Mobile-responsive with dedicated mobile admin shell

**Data & Validation**:
- Prisma ORM with PostgreSQL
- Zod validation schemas
- Server-side validation

**Authentication & Authorization**:
- Role-Based Access Control (RBAC)
- Permission-based navigation filtering
- Protected routes with middleware
- Allowed roles: ADMIN, DEVELOPER, STAFF

**Email & Communications**:
- Resend for transactional emails
- Email template system
- Campaign builder with live preview
- Email automation workflows

**Analytics & Monitoring**:
- Google Analytics integration
- Custom analytics charts
- Audit logging
- Live chat notifications

### Dependencies (from existing implementation)

Key dependencies for admin functionality:
- Next.js
- React
- Prisma
- Zod (validation)
- lucide-react (icons)
- Radix UI (component primitives)
- date-fns or similar (date handling)
- Email template system (Resend)
- Chart library (for analytics)
- File upload (UploadThing)

### Deployment Configuration

The existing admin interface is deployed as part of the main Next.js storefront application:

**Routing**: 
- Base path: `/admin`
- Protected by authentication middleware
- Role-based access control

**Authentication**:
- Integrated with storefront auth system
- Required roles: ADMIN, DEVELOPER, or STAFF
- Redirects to `/auth/signin?callbackUrl=/admin` if not authenticated

**Database**: 
- Shared Prisma database with storefront
- Admin-specific tables for audit logs, permissions, etc.

**Mobile Support**:
- Dedicated mobile admin shell (`MobileAdminShell`)
- Mobile-optimized navigation
- Responsive layouts for all admin pages
- Mobile live chat interface

**Real-time Features**:
- Live chat notifier
- Real-time order updates
- Live campaign monitoring

### Architecture Patterns

**Layout Structure**:
```typescript
// apps/storefront/app/admin/layout.tsx
- Authentication check (getCurrentUser)
- Role validation (ADMIN, DEVELOPER, STAFF)
- Permission-based navigation filtering
- Dual layout: Desktop (AdminLayoutClient) + Mobile (MobileAdminShell)
- Live chat notifications
- Toast notifications (Sonner)
```

**Permission System**:
- `getUserPermissions()` - Retrieves user permissions
- `filterNavByPermissions()` - Filters navigation by permissions
- `adminNavigation` - Central navigation configuration
- Fine-grained access control per feature

**API Routes**:
30+ admin API endpoints in `apps/storefront/app/api/admin/`:
- Analytics endpoints
- Campaign management
- Product/inventory management
- User management
- Email operations
- And more...

### Next Steps & Recommendations

#### Scenario 1: External Repository Doesn't Exist
If the external repository was planned but never created:
1. **✅ COMPLETE**: Admin functionality is already fully implemented in storefront
2. **ACTION**: Update documentation to remove references to external repo
3. **DECISION**: Determine if admin should remain in storefront or be extracted

#### Scenario 2: External Repository Is Private
If the repository exists but is private:
1. **ACTION REQUIRED**: Obtain access credentials/permissions
2. **ACTION**: Configure `gh auth login` or provide access token
3. **QUESTION**: Compare external repo with current implementation to determine source of truth

#### Scenario 3: Already Consolidated (Most Likely)
If admin was meant to be separated but is already consolidated:
1. **VERIFY**: Current architecture meets requirements (appears production-ready)
2. **DOCUMENT**: No migration needed - already in monorepo with 415+ files
3. **UPDATE**: Spec and documentation to reflect current state
4. **CONSIDER**: Whether to extract to `apps/admin` or keep in storefront

### Shared Code Extraction Candidates

Based on existing admin code, candidates for `packages/shared-types`:
- User role types (UserRole enum)
- Permission types
- Admin navigation types
- Analytics types
- Campaign types
- Order/product types (if shared with frontend)

Candidates for `packages/shared-utils`:
- RBAC utilities (`getUserPermissions`, `filterNavByPermissions`)
- Role badge utilities (`getRoleBadgeVariant`, `formatUserRole`)
- Permission validation utilities
- Audit logging utilities
- Mobile navigation split utilities

### References in Documentation
- **README.md** (lines 112-114): References external admin repository
  > "fundraising and admin deployment boundaries live in their own repositories"
  > "and [josemadridsalsa-admin](https://github.com/jordolang/josemadridsalsa-admin)."

- **AGENTS.md** (line 51): References external admin repository
  > "The fundraising and admin deployment boundaries live in the [josemadridsalsa-fundraising](https://github.com/jordolang/josemadridsalsa-fundraising) and [josemadridsalsa-admin](https://github.com/jordolang/josemadridsalsa-admin) repositories."

These references suggest the external repositories were **planned** but may have never been created, OR the functionality was consolidated back into the storefront after being separated.

---

## Migration Strategy Considerations

### If External Repositories Exist and Are Accessible:
1. Clone repositories to temporary location
2. Analyze differences between external repo and current storefront implementation
3. Determine which is the "source of truth"
4. Plan merge strategy to consolidate features

### If External Repositories Don't Exist:
1. Treat current storefront implementation as complete
2. Focus on extracting shared code to `packages/`
3. Update documentation to remove references to external repos
4. Verify all fundraising features work correctly

### Shared Code Extraction (applies to both scenarios):
Based on existing fundraising code, candidates for `packages/shared-types`:
- Fundraiser types
- Participant types
- Campaign types
- Commission calculation types
- Referral tracking types

Candidates for `packages/shared-utils`:
- Commission calculation logic
- Referral tracking utilities
- Date/time helpers for campaigns
- Validation schemas (if reused)

---

## Open Questions
1. ❓ Were the external repositories (fundraising/admin) ever created?
2. ❓ Is the current storefront implementation (with integrated fundraising and admin) the intended final state?
3. ❓ Should fundraising remain in storefront or be extracted to `apps/fundraising`?
4. ❓ Should admin remain in storefront or be extracted to `apps/admin`?
5. ❓ What is the relationship between the mentioned external repos and the existing storefront code?
6. ❓ Were the repos created and then consolidated back, or never created at all?
7. ❓ Does "deployment boundaries" in documentation refer to separate deployments from the same codebase, or separate repos?

## Blockers
- ❌ Cannot access https://github.com/jordolang/josemadridsalsa-fundraising (404/Forbidden)
- ❌ Cannot access https://github.com/jordolang/josemadridsalsa-admin (404/Forbidden)
- ❌ GitHub CLI authentication failed for both repositories
- ⚠️ Unclear if external repositories exist or were ever created
- ⚠️ Conflicting information: Documentation references external repos, but full implementations exist in storefront

## Current State Summary

**Fundraising**: ✅ Fully implemented in `apps/storefront`
- 107+ files with fundraising functionality
- Complete feature set including campaigns, participant management, referrals, commissions
- Production-ready with tests and documentation

**Admin**: ✅ Fully implemented in `apps/storefront`
- 415+ files with comprehensive admin interface
- 10+ major admin sections covering all business functions
- Role-based access control with RBAC
- Mobile-responsive with dedicated mobile shell
- Production-ready with extensive features

**Conclusion**: Both "external" repositories appear to already be fully consolidated into the monorepo. The external repository references in README.md and AGENTS.md may be outdated or refer to a planned architecture that was never implemented.

## Resolution Required

### Critical Decision Needed
**Option A: Repositories Don't Exist (Most Likely)**
- External repos were planned but never created
- All functionality already consolidated in storefront
- **Action**: Update documentation to reflect current state
- **Action**: Skip migration phases 2 and 3 (no code to migrate)
- **Action**: Focus on shared package extraction (phase 4)
- **Action**: Update README.md and AGENTS.md to remove external repo references

**Option B: Repositories Are Private**
- External repos exist but require authentication
- **Action Required**: Provide GitHub credentials or personal access token
- **Action Required**: Re-investigate once access is granted
- **Action Required**: Compare implementations to determine source of truth

**Option C: Extract from Storefront**
- Current consolidated state is temporary
- Should extract fundraising and admin to separate apps
- **Action Required**: Confirm this is the desired architecture
- **Action Required**: Plan extraction strategy (reverse migration)
- **Risk**: High complexity, potential for regressions

### Recommended Next Steps
1. **IMMEDIATE**: Clarify with project owner which scenario applies
2. **IF OPTION A**: Update implementation plan to skip phases 2-3, focus on shared packages
3. **IF OPTION B**: Provide authentication and re-investigate
4. **IF OPTION C**: Revise implementation plan for extraction instead of migration

### Authentication Note
If repositories are private and access is needed:
```bash
# Configure GitHub CLI authentication
gh auth login

# Or set personal access token
export GITHUB_TOKEN=your_token_here
```
