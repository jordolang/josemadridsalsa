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

**Status**: PENDING - To be investigated in subtask-1-2

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
1. Were the external repositories ever created?
2. Is the current storefront implementation the intended final state?
3. Should fundraising remain in storefront or be extracted to `apps/fundraising`?
4. What is the relationship between the mentioned external repos and the existing storefront code?

## Blockers
- ❌ Cannot access https://github.com/jordolang/josemadridsalsa-fundraising
- ❌ GitHub CLI authentication failed
- ⚠️ Unclear if external repository exists or is planned

## Resolution Required
- **Authentication**: Provide GitHub credentials or personal access token
- **Clarification**: Confirm whether external repos exist or if current state is correct
- **Decision**: Determine whether to extract fundraising from storefront or keep consolidated
