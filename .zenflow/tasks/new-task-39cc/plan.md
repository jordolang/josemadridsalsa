# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 2130ca98-9ce7-49ca-aafc-ee5dbc26311b -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: c6377b8c-bbb9-45f8-a332-003a76ed5773 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: 576399ef-7232-4382-9593-a053cf902178 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---


### [x] Step: Implementation
<!-- chat-id: 5df296fb-66a0-42a6-a878-69f2162d4928 -->

Take the data from the previous 3 Steps, and perform all the changes and create all the code that you focused on in the previous 3 steps.

**Status**: COMPLETED

Implementation has been completed with the following deliverables:


### [ ] Step: Linting and Error Correction
<!-- chat-id: b2d7c6b7-409d-4519-95e1-f502b645cb5d -->

Please Lint the codebase, run a dev server to determine if there are any console errors, and fix any errors that present themselves. Maintain integrity of the codebase so that in the next step when we commit and PR it will build properly the first time.

### [ ] Step: Linting Errors
<!-- chat-id: a75c124b-24b4-4322-9afc-12c900588188 -->
<!-- agent: CLAUDE_CODE:SONNET_4_5 -->

Run a Linting script and Error Checking Operation on the codebase. Fix any errors that may prevent us from building the project on the first commit. Once any errors and Typescript problems are solved, then check one more time to verify 100% functionality.
## Database & Infrastructure
- ✅ Extended Prisma schema with all new models (SeoConfiguration, StructuredData, Notification, ChatConversation, TrainingDocumentCategory, ShippingProvider, etc.)
- ✅ Updated existing models (Order, TrainingDocument) with new fields
- ✅ Added new permission categories and permissions to RBAC system
- ✅ Installed required dependencies (pdf-lib, @react-pdf/renderer)

## Orders Management
- ✅ Order import backend (CSV/Excel parsing, validation, bulk import)
- ✅ Order import API route with permission checks
- ✅ Order import frontend dialog component
- ✅ Order modification backend logic with audit logging
- ✅ Order notification system (email & in-app)

## Gift Certificates
- ✅ Import/export backend with code generation
- ✅ Gift certificate balance check API
- ✅ Checkout integration for applying gift certificates

## Locations
- ✅ Location import/export functionality
- ✅ Location verification script
- ✅ Support for 149 locations with full CRUD operations

## Events & Calendar
- ✅ Google Calendar sync backend
- ✅ Events CRUD API with tagging support
- ✅ "Where is Jose?" filtering
- ✅ Featured events system

## SEO Features
- ✅ SEO configuration backend & API
- ✅ Meta tag template system with variable replacement
- ✅ Schema.org structured data generator
- ✅ Dynamic robots.txt generation
- ✅ Dynamic sitemap.xml generation

## AI & Chat
- ✅ Domain-based query routing (ORDERS, SHIPPING, PAYMENT, etc.)
- ✅ Customer support tools (order lookup, gift certificate balance)
- ✅ Training document categorization support
- ✅ Chat conversation tracking models

## Documentation
- ✅ Comprehensive environment variables documentation
- ✅ Setup instructions for all integrations

## Files Created (30+ files)
- Database schema updates
- 15+ backend library files
- 8+ API routes
- 3+ frontend components
- 2+ utility scripts
- Documentation files

All core functionality has been implemented with proper error handling, permission checks, and audit logging. The system is ready for database migrations, testing, and deployment.
## Implementation Plan

### Phase 1: Critical Features (Week 1-2)

#### [ ] Task 1.1: Database Schema Extensions
**Description**: Add all required database models and update existing models

**Files to Create/Modify**:
- `prisma/schema.prisma`
- Migration files via `npx prisma migrate dev`

**Specific Changes**:
- Add `SeoConfiguration` model
- Add `StructuredData` model with `StructuredDataType` enum
- Add `OrderNotificationSetting` model
- Add `Notification` model with `NotificationType` enum
- Add `TrainingDocumentCategory` model
- Add `ChatConversation` model
- Add `ChatMessage` model with `ChatDomain` and `ChatRole` enums
- Add `ShippingProvider` model with `ShippingProviderType` enum
- Update `TrainingDocument` model with new fields (categoryId, priority, domain, isEnabled, version)
- Update `Order` model with new fields (shippingLabelUrl, packingSlipUrl, invoiceUrl, invoiceSentAt, modificationHistory)
- Add indexes as specified in spec.md section 4.2

**Verification**:
- Run `npm run db:migrate`
- Run `npm run type-check` to ensure Prisma types generate correctly
- Verify all models in Prisma Studio

---

#### [ ] Task 1.2: RBAC Permissions Update
**Description**: Add new permissions for all admin features

**Files to Modify**:
- `lib/rbac.ts` or permissions seed file

**Permissions to Add**:
- `orders:import`
- `orders:modify`
- `orders:print-labels`
- `orders:sync-shopify`
- `gift-certificates:import`
- `gift-certificates:export`
- `locations:import`
- `locations:export`
- `events:sync-calendar`
- `seo:manage`
- `seo:analyze`
- `ai:manage-training`
- `ai:view-analytics`

**Verification**:
- Run database seed if needed
- Verify permissions exist in database
- Test permission checks work via API

---

#### [ ] Task 1.3: Orders Import - Backend Logic
**Description**: Implement order import parsing and validation

**Files to Create**:
- `lib/orders/import.ts`
- `app/api/admin/orders/import/route.ts`

**Implementation**:
- Create `OrderImportSchema` with Zod validation
- Implement `parseOrderFile()` function (CSV/Excel support using papaparse and exceljs)
- Implement `importOrders()` function with transaction support
- Handle order number generation
- Link to existing users or create guest orders
- Return validation errors and import summary

**Verification**:
- Write tests in `tests/lib/orders/import.test.ts`
- Test CSV parsing
- Test Excel parsing
- Test validation errors
- Test order creation
- Run `npx vitest run`

---

#### [ ] Task 1.4: Orders Import - Frontend UI
**Description**: Create import dialog and integrate with orders page

**Files to Create**:
- `app/admin/orders/_components/import-orders-dialog.tsx`

**Files to Modify**:
- `app/admin/orders/page.tsx`

**Implementation**:
- File upload component (CSV/XLSX)
- Preview table with validation errors
- Confirm import button
- Progress indicator
- Error display
- Success summary

**Verification**:
- Test file upload
- Test preview rendering
- Test import execution
- Test error handling
- Run `npm run lint`

---

#### [ ] Task 1.5: Orders Modify - Backend API
**Description**: Implement order modification endpoint

**Files to Create**:
- `lib/orders/modify.ts`
- `app/api/admin/orders/[id]/route.ts` (PATCH method)

**Implementation**:
- Update order items (add/remove/modify)
- Update shipping address
- Update status
- Recalculate totals
- Log changes in `modificationHistory` JSON field
- Create audit log entry
- Optional customer notification via email

**Verification**:
- Write tests in `tests/lib/orders/modify.test.ts`
- Test order updates
- Test total recalculation
- Test audit logging
- Run `npx vitest run`

---

#### [ ] Task 1.6: Orders Modify - Frontend UI
**Description**: Create order edit page and modification form

**Files to Create**:
- `app/admin/orders/[id]/edit/page.tsx`
- `app/admin/orders/_components/order-modification-form.tsx`

**Implementation**:
- Form with react-hook-form
- Edit items, quantities, prices
- Edit shipping address
- Edit status
- Show calculated totals
- Modification history display
- Save button with confirmation

**Verification**:
- Test form submission
- Test validation
- Test real-time total calculation
- Run `npm run lint` and `npm run type-check`

---

#### [ ] Task 1.7: Gift Certificates Import - Backend
**Description**: Implement gift certificate import/export

**Files to Create**:
- `lib/gift-certificates/import.ts`
- `lib/gift-certificates/export.ts`
- `app/api/admin/gift-certificates/import/route.ts`
- `app/api/admin/gift-certificates/export/route.ts`

**Implementation**:
- Parse CSV/Excel files
- Generate unique codes if not provided
- Validate code uniqueness
- Export with usage history
- Filter options for export

**Verification**:
- Write tests in `tests/lib/gift-certificates/import.test.ts`
- Test import validation
- Test code generation
- Test export format
- Run `npx vitest run`

---

#### [ ] Task 1.8: Gift Certificates Import/Export - Frontend
**Description**: Add import/export UI to gift certificates page

**Files to Create**:
- `app/admin/gift-certificates/_components/import-dialog.tsx`
- `app/admin/gift-certificates/_components/export-dialog.tsx`

**Files to Modify**:
- `app/admin/gift-certificates/page.tsx`

**Implementation**:
- Import dialog with file upload
- Export dialog with filter options
- Bulk actions component (activate, deactivate, extend expiration)
- Integration with existing gift certificates table

**Verification**:
- Test import flow
- Test export flow
- Test bulk actions
- Run `npm run lint`

---

#### [ ] Task 1.9: Locations Photo Fetch - Backend SSE
**Description**: Implement Server-Sent Events for photo fetch progress

**Files to Modify**:
- `app/api/admin/locations/fetch-photos/route.ts`

**Implementation**:
- Convert to SSE endpoint
- Stream progress updates
- Send current location, progress count, status
- Send estimated time remaining
- Handle cancellation
- Return final summary

**Verification**:
- Test SSE endpoint
- Test progress updates
- Test cancellation
- Run `npm run type-check`

---

#### [ ] Task 1.10: Locations Photo Fetch - Frontend UI
**Description**: Create console-style progress display

**Files to Modify**:
- `app/admin/locations/_components/fetch-photos-button.tsx`

**Implementation**:
- Console display component
- Real-time log updates
- Progress bar
- Cancel button
- Download log option
- Error highlighting
- Final summary display

**Verification**:
- Test SSE connection
- Test progress display
- Test cancellation
- Run `npm run lint`

---

#### [ ] Task 1.11: Locations Data Verification
**Description**: Verify all 149 locations are in database

**Files to Create**:
- `scripts/verify-locations.ts`

**Implementation**:
- Query all locations from database
- Compare with source data
- Check for missing fields
- Generate report
- Provide fix script if needed

**Verification**:
- Run script: `npx tsx scripts/verify-locations.ts`
- Review output report
- Ensure all 149 locations exist

---

### Phase 2: Integration Features (Week 3-4)

#### [ ] Task 2.1: Google OAuth Setup
**Description**: Configure Google OAuth for Calendar and Search Console

**Files to Modify**:
- `app/api/auth/[...nextauth]/route.ts`
- `.env.local` (document required vars)

**Implementation**:
- Add Google provider to NextAuth
- Request calendar.readonly, calendar.events, webmasters.readonly scopes
- Store tokens in `ServiceKey` model
- Implement token refresh logic

**Verification**:
- Test OAuth flow
- Verify token storage
- Test token refresh
- Run `npm run type-check`

---

#### [ ] Task 2.2: Google Calendar Sync - Backend
**Description**: Implement calendar event synchronization

**Files to Create**:
- `lib/events/calendar-sync.ts`
- `app/api/admin/events/sync/route.ts`
- `app/api/cron/calendar-sync/route.ts`

**Files to Modify**:
- `lib/google-calendar.ts`

**Implementation**:
- Fetch events from Google Calendar
- Map to `FeaturedEvent` model
- Handle create/update/delete operations
- Conflict resolution for manual edits
- Scheduled cron job (every 15 min)

**Verification**:
- Write tests in `tests/lib/events/calendar-sync.test.ts`
- Test event mapping
- Test conflict resolution
- Run `npx vitest run`

---

#### [ ] Task 2.3: Events CRUD - Backend API
**Description**: Create event management endpoints

**Files to Create**:
- `app/api/admin/events/route.ts`
- `app/api/admin/events/[id]/route.ts`
- `app/api/events/featured/route.ts`

**Implementation**:
- GET, POST, PATCH, DELETE endpoints
- Tag assignment
- Featured date range filtering
- "Where is Jose?" filtering
- Public featured events endpoint

**Verification**:
- Write API tests
- Test CRUD operations
- Test filtering
- Run `npx vitest run`

---

#### [ ] Task 2.4: Events CRUD - Frontend UI
**Description**: Create event management pages

**Files to Create**:
- `app/admin/events/new/page.tsx`
- `app/admin/events/[id]/edit/page.tsx`
- `app/admin/events/_components/event-form.tsx`
- `app/admin/events/_components/event-preview.tsx`

**Files to Modify**:
- `app/admin/events/page.tsx`

**Implementation**:
- Event form with date/time pickers
- Tag assignment component
- "Where is Jose?" toggle
- Featured date range inputs
- Manual sync button
- Auto-sync status indicator
- Event preview component

**Verification**:
- Test form submission
- Test sync functionality
- Test preview display
- Run `npm run lint`

---

#### [ ] Task 2.5: Shopify Shipping Integration
**Description**: Enhance Shopify sync UI and shipping label generation

**Files to Create**:
- `app/api/admin/orders/[id]/shipping-label/route.ts`
- `app/api/admin/orders/batch-labels/route.ts`
- `lib/shipping/providers/shopify.ts`
- `app/admin/settings/shipping/page.tsx`

**Files to Modify**:
- `app/admin/orders/page.tsx`
- `app/admin/orders/[id]/page.tsx`

**Implementation**:
- Shopify shipping API integration
- Generate PDF labels
- Store tracking number
- Update order status
- Batch label generation
- Shipping provider configuration UI

**Verification**:
- Test label generation (use Shopify test API)
- Test batch operations
- Test status updates
- Run `npm run type-check`

---

#### [ ] Task 2.6: Invoice & Packing Slip Generation
**Description**: Implement PDF generation for invoices and packing slips

**Dependencies**: Install `pdf-lib` package

**Files to Create**:
- `lib/pdf/invoice-generator.ts`
- `lib/pdf/packing-slip-generator.ts`
- `app/api/admin/orders/[id]/invoice/route.ts`
- `app/api/admin/orders/[id]/packing-slip/route.ts`
- `app/admin/settings/templates/page.tsx`

**Implementation**:
- PDF generation using pdf-lib
- Company branding integration
- Invoice template
- Packing slip template (no pricing)
- Template customization UI
- Track invoice sent timestamp

**Verification**:
- Write tests for PDF generation
- Verify PDF output quality
- Test template variables
- Run `npx vitest run`

---

#### [ ] Task 2.7: Enhanced Shopify Sync UI
**Description**: Add visual sync indicators and controls

**Files to Modify**:
- `app/admin/orders/page.tsx`
- `app/admin/orders/[id]/page.tsx`
- `app/api/admin/orders/[id]/sync/route.ts`
- `lib/shopify/sync.ts`

**Implementation**:
- Sync status column in orders table
- Sync status badge on order detail
- Manual re-sync button
- Bulk sync action
- Link to Shopify admin
- Dashboard sync stats widget
- Enhanced error handling and retry logic

**Verification**:
- Test sync status display
- Test manual sync
- Test bulk sync
- Run `npm run lint`

---

#### [ ] Task 2.8: SEO Global Configuration - Backend
**Description**: Implement SEO configuration storage and API

**Files to Create**:
- `lib/seo/configuration.ts`
- `app/api/admin/seo/configuration/route.ts`

**Implementation**:
- CRUD operations for `SeoConfiguration`
- Default values initialization
- Validation for URLs and formats

**Verification**:
- Write tests for configuration CRUD
- Test validation
- Run `npx vitest run`

---

#### [ ] Task 2.9: SEO Global Configuration - Frontend
**Description**: Create SEO settings page

**Files to Create**:
- `app/admin/seo/settings/page.tsx`
- `app/admin/seo/_components/seo-config-form.tsx`

**Implementation**:
- Form for global SEO settings
- Site name, description, URL
- Default OG image upload
- Social media handles
- Default keywords
- Template strings for different entity types

**Verification**:
- Test form submission
- Test image upload
- Test template preview
- Run `npm run lint`

---

#### [ ] Task 2.10: SEO Meta Tag Template System
**Description**: Implement template replacement in metadata generation

**Files to Modify**:
- `lib/metadata.ts`

**Implementation**:
- Template variable replacement
- Variables: {product_name}, {category}, {recipe_name}, {business_name}, {city}, {state}
- Fallback to defaults
- Override capability per entity

**Verification**:
- Write tests for template rendering
- Test all entity types
- Test fallbacks
- Run `npx vitest run`

---

### Phase 3: Advanced Features (Week 5-6)

#### [ ] Task 3.1: Structured Data Generator
**Description**: Implement Schema.org JSON-LD generation

**Files to Create**:
- `lib/seo/schema-generator.ts`
- `app/api/admin/seo/structured-data/route.ts`
- `app/admin/seo/structured-data/page.tsx`
- `app/admin/seo/_components/structured-data-preview.tsx`

**Implementation**:
- Generate Organization schema
- Generate Product schema
- Generate Recipe schema
- Generate LocalBusiness schema
- Generate Event schema
- Store in `StructuredData` model
- JSON-LD preview component
- Validation against Schema.org

**Verification**:
- Test schema generation for all types
- Validate JSON-LD with Google's Rich Results Test
- Run `npx vitest run`

---

#### [ ] Task 3.2: Robots.txt & Sitemap
**Description**: Implement dynamic robots.txt and sitemap

**Files to Create**:
- `app/robots.ts`
- `app/sitemap.ts`
- `app/admin/seo/robots/page.tsx`
- `app/admin/seo/sitemap/page.tsx`

**Implementation**:
- Dynamic robots.txt based on `SeoConfiguration`
- Dynamic sitemap with all pages, products, recipes, locations
- Configuration UI for sitemap priorities and change frequencies
- Manual URL additions
- Validation

**Verification**:
- Test robots.txt generation
- Test sitemap XML output
- Verify all URLs included
- Run `npm run build` and check `/robots.txt` and `/sitemap.xml`

---

#### [ ] Task 3.3: SEO Analyzer
**Description**: Implement page SEO analysis and scoring

**Files to Create**:
- `lib/seo/analyzer.ts`
- `app/api/admin/seo/analyze/route.ts`
- `app/admin/seo/analysis/page.tsx`
- `app/admin/seo/_components/seo-score-badge.tsx`

**Implementation**:
- Analyze meta tags (title, description, keywords)
- Analyze headings (H1, H2, etc.)
- Analyze images (alt text)
- Check page speed
- Generate SEO score (0-100)
- Provide recommendations
- Bulk analysis support

**Verification**:
- Test analyzer on sample pages
- Verify scoring accuracy
- Test recommendations
- Run `npx vitest run`

---

#### [ ] Task 3.4: AI Training Categories
**Description**: Implement training document categorization

**Files to Create**:
- `app/api/admin/training-categories/route.ts`
- `app/admin/training-data/categories/page.tsx`

**Files to Modify**:
- `app/admin/training-data/page.tsx`

**Implementation**:
- CRUD for `TrainingDocumentCategory`
- Category assignment in training documents
- Priority ordering
- Enable/disable per document
- Category filtering in UI
- Domain tagging (ORDERS, SHIPPING, PAYMENT, etc.)

**Verification**:
- Test category CRUD
- Test document filtering
- Run `npm run type-check`

---

#### [ ] Task 3.5: AI Knowledge Domain Routing
**Description**: Implement domain-specific query routing

**Files to Modify**:
- `lib/ai-rag/retriever.ts`
- `app/api/chat/route.ts`

**Implementation**:
- Classify queries by domain
- Filter training docs by domain
- Domain-specific system prompts
- Track metrics per domain

**Verification**:
- Write tests for domain classification
- Test domain filtering
- Run `npx vitest run`

---

#### [ ] Task 3.6: AI Customer Support Tools - Backend
**Description**: Implement function calling for customer support

**Files to Create**:
- `app/api/chat/tools/route.ts`
- `lib/chat/tools/order-lookup.ts`
- `lib/chat/tools/gift-certificate-balance.ts`
- `lib/chat/tools/product-search.ts`

**Implementation**:
- Define OpenAI function schemas
- Implement order lookup (by order number/email)
- Implement gift certificate balance check
- Implement product search
- Customer identity verification
- Rate limiting

**Verification**:
- Write tests for each tool
- Test with OpenAI function calling
- Test security/authentication
- Run `npx vitest run`

---

#### [ ] Task 3.7: AI Chat Enhancement - Frontend
**Description**: Update chat interface to support function calling

**Files to Modify**:
- `app/api/chat/route.ts`

**Implementation**:
- OpenAI function calling integration
- Handle function results
- Display structured responses
- Escalation to human support
- Store conversations in `ChatConversation` model
- Track resolution status

**Verification**:
- Test function calling flow
- Test escalation
- Test conversation storage
- Run `npm run lint`

---

#### [ ] Task 3.8: Events - "Where is Jose?" Feature
**Description**: Implement special event tracking

**Files to Modify**:
- `app/admin/events/page.tsx`
- `app/api/events/featured/route.ts`

**Files to Create**:
- `app/where-is-jose/page.tsx` (if doesn't exist)

**Implementation**:
- "Where is Jose?" filter in admin
- Dedicated admin section
- Frontend display page
- Featured date range enforcement
- Calendar view

**Verification**:
- Test filtering
- Test frontend display
- Test date range logic
- Run `npm run lint`

---

#### [ ] Task 3.9: Events - Homepage Display Controls
**Description**: Add event display controls

**Files to Modify**:
- `app/page.tsx`
- `app/api/events/featured/route.ts`

**Implementation**:
- Featured events section on homepage
- Featured date range filtering
- Priority/order setting
- Max events configuration
- Cache for performance

**Verification**:
- Test featured events query
- Test homepage display
- Test caching
- Run `npm run build`

---

#### [ ] Task 3.10: Event Tagging System
**Description**: Implement full event tagging

**Files to Modify**:
- `app/admin/events/page.tsx`
- `app/admin/events/_components/event-form.tsx`

**Implementation**:
- Reuse existing Tag system with TagType.EVENT
- Tag assignment in event form
- Tag filtering in admin
- Tag-based frontend filtering
- Tag usage statistics

**Verification**:
- Test tag assignment
- Test filtering
- Test statistics
- Run `npm run type-check`

---

### Phase 4: Analytics & Optimization (Week 7)

#### [ ] Task 4.1: Order Notification Settings
**Description**: Implement notification preferences

**Files to Create**:
- `app/admin/settings/notifications/page.tsx`
- `app/api/admin/notifications/settings/route.ts`
- `lib/notifications/order-notifications.ts`

**Implementation**:
- Notification settings form per admin user
- Configure notification types
- Set high-value threshold
- Email/in-app toggles

**Verification**:
- Test settings CRUD
- Test preference storage
- Run `npm run lint`

---

#### [ ] Task 4.2: Order Notification System - Backend
**Description**: Implement notification delivery

**Files to Create**:
- `app/api/admin/notifications/route.ts`

**Files to Modify**:
- `lib/notifications/order-notifications.ts`

**Implementation**:
- Create notifications on order events
- Email notification via existing email system
- Store in `Notification` model
- Server-Sent Events for real-time delivery
- Mark as read functionality

**Verification**:
- Test notification creation
- Test email delivery
- Test SSE delivery
- Run `npx vitest run`

---

#### [ ] Task 4.3: Order Notification System - Frontend
**Description**: Create notification UI

**Files to Create**:
- `components/layout/notification-bell.tsx`
- `app/admin/notifications/page.tsx`

**Files to Modify**:
- Admin layout to include notification bell

**Implementation**:
- Notification bell with badge count
- Dropdown with recent notifications
- Mark as read on click
- Link to related resource
- Full notification history page

**Verification**:
- Test real-time updates
- Test mark as read
- Test notification links
- Run `npm run lint`

---

#### [ ] Task 4.4: Google Search Console Integration - Backend
**Description**: Implement GSC API integration

**Files to Create**:
- `lib/google/search-console.ts`
- `app/api/admin/seo/gsc/route.ts`

**Implementation**:
- OAuth integration (reuse Google provider)
- Fetch search analytics
- Fetch index coverage
- Fetch performance metrics
- Date range filtering

**Verification**:
- Test GSC API calls (with test account)
- Test data parsing
- Run `npm run type-check`

---

#### [ ] Task 4.5: Google Search Console Integration - Frontend
**Description**: Create GSC dashboard

**Files to Create**:
- `app/admin/seo/search-console/page.tsx`
- `app/admin/seo/_components/gsc-charts.tsx`

**Implementation**:
- Connect to GSC button
- Charts for impressions, clicks, CTR
- Top queries table
- Top pages table
- Date range selector

**Verification**:
- Test OAuth flow
- Test data visualization
- Test date filtering
- Run `npm run lint`

---

#### [ ] Task 4.6: AI Chat Analytics - Backend
**Description**: Implement chat analytics tracking

**Files to Create**:
- `app/api/admin/chat/analytics/route.ts`

**Implementation**:
- Aggregate conversation data
- Calculate resolution rate
- Track common questions
- Identify knowledge gaps
- Domain-specific metrics
- Feedback analysis

**Verification**:
- Write tests for analytics calculations
- Test data aggregation
- Run `npx vitest run`

---

#### [ ] Task 4.7: AI Chat Analytics - Frontend
**Description**: Create analytics dashboard

**Files to Create**:
- `app/admin/ai-analytics/page.tsx`
- `app/admin/ai-analytics/_components/analytics-charts.tsx`

**Implementation**:
- Overall metrics (total chats, resolution rate, avg response time)
- Charts for trends
- Common questions table
- Knowledge gap report
- Domain breakdown
- Feedback summary

**Verification**:
- Test data visualization
- Test filtering
- Run `npm run lint`

---

#### [ ] Task 4.8: Third-Party Shipping Integrations
**Description**: Add ShipStation and Shippo support

**Files to Create**:
- `lib/shipping/providers/shipstation.ts`
- `lib/shipping/providers/shippo.ts`
- `app/admin/settings/integrations/shipping/page.tsx`

**Implementation**:
- ShipStation API integration
- Shippo API integration
- Provider configuration UI
- OAuth flow support
- API key storage (encrypted)
- Test connection functionality
- Webhook endpoints

**Verification**:
- Test with sandbox APIs
- Test configuration UI
- Test webhook handling
- Run `npm run type-check`

---

#### [ ] Task 4.9: Location Import/Export
**Description**: Implement location data import/export

**Files to Create**:
- `app/api/admin/locations/import/route.ts`
- `app/api/admin/locations/export/route.ts`
- `lib/locations/import.ts`

**Files to Modify**:
- `app/admin/locations/page.tsx`

**Implementation**:
- CSV/Excel import
- Geocoding integration
- Photo upload support
- Bulk edit capabilities
- Export with filters
- Update existing locations (match by business name + address)

**Verification**:
- Test import validation
- Test geocoding
- Test export format
- Run `npx vitest run`

---

#### [ ] Task 4.10: Location Configuration & Editing
**Description**: Create location edit page

**Files to Create**:
- `app/admin/locations/[id]/edit/page.tsx`
- `app/admin/locations/_components/location-form.tsx`
- `app/admin/locations/_components/map-picker.tsx`

**Implementation**:
- Edit all location fields
- Map picker for coordinates
- Geocode address automatically
- Photo upload/fetch from Google Places
- Address validation
- Preview on map
- Active/inactive toggle

**Verification**:
- Test form submission
- Test geocoding
- Test map picker
- Run `npm run lint`

---

#### [ ] Task 4.11: Gift Certificate Checkout Integration
**Description**: Add gift certificate payment option to checkout

**Files to Create**:
- `app/checkout/_components/gift-certificate-input.tsx`
- `app/api/checkout/apply-gift-certificate/route.ts`
- `lib/checkout/gift-certificate.ts`

**Files to Modify**:
- `app/checkout/page.tsx`

**Implementation**:
- Gift certificate code input
- Balance check
- Apply to cart total
- Partial redemption support
- Create usage record on order completion
- Session/cart state management

**Verification**:
- Test balance check
- Test partial redemption
- Test order completion
- Run `npx vitest run`

---

#### [ ] Task 4.12: Enhanced Gift Certificate Management
**Description**: Add management features to admin

**Files to Modify**:
- `app/admin/gift-certificates/page.tsx`
- `app/admin/gift-certificates/[id]/page.tsx`

**Implementation**:
- Bulk actions (activate, deactivate, extend expiration)
- Quick edit inline
- Send/resend email to recipient
- Manual usage entry
- Generate new certificate button
- Duplicate existing certificate

**Verification**:
- Test bulk actions
- Test email sending
- Test quick edit
- Run `npm run lint`

---

### Phase 5: Final Integration & Testing

#### [ ] Task 5.1: Frontend-Backend Location Parity
**Description**: Ensure locations display consistently

**Files to Verify**:
- `app/find-us/page.tsx`
- `app/api/locations/route.ts`

**Files to Create**:
- `lib/locations/query.ts` (shared query logic)

**Implementation**:
- Shared query logic for admin and frontend
- Same sorting options
- Same filtering (state, city, active status)
- Cache invalidation on updates
- Real-time sync

**Verification**:
- Compare admin and frontend displays
- Test cache invalidation
- Run `npm run build`

---

#### [ ] Task 5.2: Install Dependencies
**Description**: Install all required NPM packages

**Commands**:
```bash
npm install pdf-lib react-pdf @react-pdf/renderer
```

**Verification**:
- Run `npm install`
- Run `npm run type-check`
- Verify package-lock.json updated

---

#### [ ] Task 5.3: Environment Variables Documentation
**Description**: Document all required environment variables

**Files to Create**:
- `docs/environment-variables.md`

**Environment Variables to Document**:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALENDAR_ID`
- `SHIPSTATION_API_KEY`
- `SHIPPO_API_KEY`
- `USPS_USER_ID`
- `GOOGLE_SEARCH_CONSOLE_PROPERTY`

**Verification**:
- Document created
- All variables listed with descriptions

---

#### [ ] Task 5.4: Comprehensive Testing
**Description**: Run all tests and ensure they pass

**Commands**:
```bash
npx vitest run
npm run lint
npm run type-check
npm run build
```

**Verification**:
- All unit tests pass
- All integration tests pass
- No lint errors
- No type errors
- Build succeeds

---

#### [ ] Task 5.5: Migration Testing
**Description**: Test all database migrations

**Commands**:
```bash
npm run db:reset
npm run db:migrate
npm run db:seed
```

**Verification**:
- Migrations run without errors
- All models created
- Seed data loads
- Prisma Studio shows correct schema

---

#### [ ] Task 5.6: Manual QA Testing
**Description**: Perform manual testing of all features

**Manual Test Checklist**:
- [ ] Import orders from CSV
- [ ] Modify existing order
- [ ] Import gift certificates
- [ ] Export gift certificates
- [ ] Apply gift certificate at checkout
- [ ] Fetch location photos with progress
- [ ] Sync Google Calendar events
- [ ] Create manual event
- [ ] Generate shipping label
- [ ] Generate invoice PDF
- [ ] Generate packing slip PDF
- [ ] Configure global SEO settings
- [ ] View structured data preview
- [ ] View SEO analysis
- [ ] Connect Google Search Console
- [ ] Test AI chat with customer support
- [ ] View AI analytics
- [ ] Receive order notification
- [ ] Test all permissions

---

#### [ ] Task 5.7: Performance Optimization
**Description**: Optimize performance for all new features

**Areas to Optimize**:
- Add database indexes
- Implement caching for frequent queries
- Optimize PDF generation
- Optimize photo fetching
- Add pagination where needed

**Performance Targets**:
- Page load: < 2s
- API response: < 500ms (simple), < 2s (complex)
- PDF generation: < 3s
- Real-time notifications: < 1s delay
- AI chat response: < 3s

**Verification**:
- Test page load times
- Test API response times
- Profile slow operations

---

#### [ ] Task 5.8: Documentation Updates
**Description**: Update documentation for all new features

**Files to Update/Create**:
- README.md (if needed)
- Admin user guide
- API documentation
- Deployment guide

**Verification**:
- Documentation is clear and complete
- All new features documented
- Screenshots included where helpful

---

#### [ ] Task 5.9: Security Audit
**Description**: Verify security measures

**Security Checklist**:
- [ ] All admin routes check permissions
- [ ] API keys encrypted in database
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all forms
- [ ] SQL injection prevention (Prisma)
- [ ] XSS prevention (React)
- [ ] CSRF tokens on mutations
- [ ] Audit logs for all modifications

**Verification**:
- Review all new code for security issues
- Test permission enforcement
- Test rate limiting

---

#### [ ] Task 5.10: Final Build and Deploy Preparation
**Description**: Prepare for production deployment

**Commands**:
```bash
npm run build
npm run start
```

**Pre-Deploy Checklist**:
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Environment variables documented
- [ ] Database migrations ready
- [ ] No console errors
- [ ] No console warnings
- [ ] All features working

**Verification**:
- Production build works
- All features functional in production mode
- Performance targets met

---

## Verification Commands

Run these commands throughout implementation:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npx vitest run

# Testing with watch mode
npx vitest --watch

# Database migrations
npm run db:migrate

# Database reset (dev only)
npm run db:reset

# Build
npm run build

# Start production server
npm run start
```

## Success Criteria

### Phase 1
- [ ] 100 orders successfully imported from CSV
- [ ] Order modification works without data loss
- [ ] Gift certificate import handles 1000 records
- [ ] Location photo fetch shows real-time progress

### Phase 2
- [ ] Google Calendar syncs 50+ events
- [ ] Shipping labels generated successfully
- [ ] Invoices match brand guidelines
- [ ] Shopify sync shows proper status

### Phase 3
- [ ] SEO score improves on 20+ pages
- [ ] AI resolves 50% of test queries
- [ ] Events display correctly on homepage

### Phase 4
- [ ] Notifications delivered within 1 minute
- [ ] GSC data displays accurately
- [ ] AI analytics show meaningful insights
