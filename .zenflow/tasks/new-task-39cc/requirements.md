# Product Requirements Document: Admin Panel Enhancements

## Executive Summary

This PRD outlines comprehensive enhancements to the Jose Madrid Admin Panel across six major feature areas: Orders Management, Gift Certificates, Location Management, Events & Calendar Integration, SEO Management, and AI Training/Chatbot capabilities.

## 1. Orders Management Enhancements

### 1.1 Current State
- Basic order listing and detail pages exist (`/app/admin/orders/page.tsx`)
- Export functionality present (`/api/admin/orders/export`)
- Shopify integration exists with basic sync capabilities
- Order model includes fields for tracking numbers, shipping, and Shopify sync

### 1.2 Required Features

#### 1.2.1 Import Orders
**User Story**: As an admin, I want to import orders from CSV/Excel files to bulk-create orders or migrate from other systems.

**Acceptance Criteria**:
- Support CSV and Excel (.xlsx) file formats
- Map columns to order fields (customer info, items, pricing, shipping)
- Validate data before import
- Show preview with error detection
- Create orders with PENDING status by default
- Generate unique order numbers
- Support both authenticated user orders and guest orders

**Questions**:
- Should imported orders automatically sync to Shopify?
- What's the expected file format/template?
- Should we support order item SKU lookup or require product IDs?

#### 1.2.2 Modify Orders
**User Story**: As an admin, I want to edit existing orders to correct mistakes or accommodate customer requests.

**Acceptance Criteria**:
- Edit order items (add/remove/modify quantities)
- Update shipping address
- Modify order status
- Add/edit admin notes
- Recalculate totals automatically
- Track order modification history in audit logs
- Option to notify customer of changes

**Questions**:
- Should order modifications sync back to Shopify?
- Are there any order statuses that should prevent editing (e.g., DELIVERED)?
- Should price changes be allowed after payment?

#### 1.2.3 Print Shipping Labels
**User Story**: As an admin, I want to print shipping labels directly from the admin panel.

**Acceptance Criteria**:
- Integration with shipping provider APIs (USPS, UPS, FedEx)
- Generate shipping labels from order details
- Support batch label printing for multiple orders
- Store tracking numbers automatically
- Update order status to SHIPPED
- PDF download of labels

**Questions**:
- Which shipping carriers should be supported initially?
- Should we use Shopify's shipping API or direct carrier integrations?
- Are there existing shipping accounts/credentials?

#### 1.2.4 Third-Party Service Connections
**User Story**: As an admin, I want to connect and manage third-party services for order fulfillment.

**Acceptance Criteria**:
- Settings page for third-party integrations
- Support for:
  - ShipStation
  - Shippo
  - EasyPost
  - Other fulfillment services
- OAuth/API key configuration
- Test connection functionality
- Webhook setup for status updates

**Questions**:
- Which specific third-party services are required?
- Are there existing accounts with these services?

#### 1.2.5 Enhanced Shopify Integration
**User Story**: As an admin, I want better visibility and control over Shopify synchronization.

**Acceptance Criteria**:
- Display Shopify sync status on order list
- Manual re-sync button per order
- Bulk sync for multiple orders
- View sync errors with retry option
- Link to Shopify admin for each order
- Dashboard showing sync statistics
- Webhook status monitoring

**Technical Notes**:
- Shopify integration already exists (`lib/shopify/`)
- Build on existing sync infrastructure
- Enhance error handling and retry logic

#### 1.2.6 Print Invoices & Packing Slips
**User Story**: As an admin, I want to print professional invoices and packing slips.

**Acceptance Criteria**:
- Generate PDF invoices with company branding
- Include all order details, items, pricing, taxes
- Generate packing slips (simplified version without pricing)
- Support batch printing
- Customizable templates
- Download or direct print options
- Track when invoices were sent

**Technical Notes**:
- Invoice model already exists in schema
- Use PDF generation library (pdf-lib or similar)

#### 1.2.7 Order Notifications
**User Story**: As an admin, I want to receive notifications for new orders and order changes.

**Acceptance Criteria**:
- Real-time notifications for:
  - New orders placed
  - Order status changes
  - Payment failures
  - Refund requests
  - High-value orders (threshold configurable)
- Notification channels:
  - Email notifications
  - In-admin notifications badge/panel
  - Optional SMS/Slack integration
- Configurable notification preferences per admin user
- Notification history/log

**Technical Notes**:
- Email infrastructure already exists (Resend, email templates)
- Consider WebSocket or Server-Sent Events for real-time updates

## 2. Gift Certificate Management

### 2.1 Current State
- GiftCertificate model exists with full schema
- Basic CRUD pages exist (`/app/admin/gift-certificates/`)
- Purchase flow implemented on frontend
- Support for themes, balances, and usage tracking

### 2.2 Required Features

#### 2.2.1 Import Gift Certificates
**User Story**: As an admin, I want to import gift certificates in bulk.

**Acceptance Criteria**:
- CSV/Excel import support
- Fields: code, amount, purchaser/recipient info, expiration
- Generate unique codes if not provided
- Validate code uniqueness
- Preview before import
- Set status (ACTIVE by default)

#### 2.2.2 Export Gift Certificates
**User Story**: As an admin, I want to export gift certificate data for reporting.

**Acceptance Criteria**:
- Export to CSV/Excel
- Filters: status, date range, amount range
- Include usage history
- Configurable column selection

#### 2.2.3 Enhanced Management UI
**User Story**: As an admin, I want improved gift certificate management tools.

**Acceptance Criteria**:
- Bulk actions: activate, deactivate, extend expiration
- Quick edit for balance adjustments
- Manual usage entry
- Generate new certificate button
- Duplicate existing certificate
- Send/resend certificate email to recipient

#### 2.2.4 Frontend Integration
**User Story**: As a customer, I want to purchase and use gift certificates seamlessly.

**Acceptance Criteria**:
- Gift certificate purchase on storefront (already exists)
- Apply gift certificate at checkout
- Check balance page (already exists)
- Display available balance in account section
- Email notification upon purchase
- Recipient email with certificate code
- Support partial redemption

**Technical Notes**:
- Frontend purchase flow exists at `/app/gift-certificates/`
- Integrate with checkout process
- Payment gateway already configured (Stripe)

## 3. Location Management

### 3.1 Current State
- RetailLocation model with 149 locations in database
- Admin page exists (`/app/admin/locations/page.tsx`)
- FetchPhotosButton component exists but basic
- Location data seeded from markdown files
- Google Places integration exists

### 3.2 Required Features

#### 3.2.1 Fetch Photos Progress Display
**User Story**: As an admin, I want to see real-time progress when fetching location photos.

**Acceptance Criteria**:
- Console/log display showing:
  - Current location being processed
  - Progress (e.g., "45 of 149")
  - Success/failure status per location
  - Total time elapsed
  - Estimated time remaining
- Visual progress bar
- Ability to cancel operation
- Final summary with errors
- Download log file option

**Technical Notes**:
- API endpoint exists at `/api/admin/locations/fetch-photos`
- Implement Server-Sent Events or polling for progress updates
- Store progress in Redis or database

#### 3.2.2 Import 149 Locations
**User Story**: As an admin, I want to ensure all 149 retail locations are properly imported and synced.

**Acceptance Criteria**:
- Verify all 149 locations exist in database
- Run seed script if needed (`npm run locations:import`)
- Validate data completeness:
  - Business name, address, city, state
  - Phone numbers (where available)
  - Google Places IDs
  - Coordinates (lat/lng)
  - Photos
- Report on missing data
- Provide fix/update script

**Technical Notes**:
- Seed data exists in `prisma/seeds/retail-locations.ts`
- Import script exists: `scripts/import-locations-from-markdown.ts`

#### 3.2.3 Backend-Frontend Parity
**User Story**: As an admin, I want the admin panel location list to match the frontend display.

**Acceptance Criteria**:
- Same data displayed on both admin and frontend
- Same sorting options
- Same filtering (by state, city, active status)
- Admin shows additional fields (edit buttons, status toggles)
- Real-time sync between admin changes and frontend display
- Cache invalidation on updates

**Questions**:
- What's the current frontend location display? (Need to check `/app/find-us/`)
- Should filters persist across sessions?

#### 3.2.4 Location Configuration
**User Story**: As an admin, I want to fully configure each location entry.

**Acceptance Criteria**:
- Edit all fields:
  - Business name, address, city, state, zip
  - Phone, website
  - Coordinates (with map picker)
  - Photo URL (with upload option)
  - Active/inactive toggle
  - Sort order
- Geocode address automatically
- Fetch photo from Google Places
- Validate address format
- Preview on map
- Bulk edit capabilities

#### 3.2.5 Location Import/Export
**User Story**: As an admin, I want to import and export location data.

**Acceptance Criteria**:
- Export current locations to CSV/Excel
- Import from CSV/Excel with validation
- Update existing locations (match by business name + address)
- Add new locations
- Preview changes before applying
- Support coordinate formats (decimal degrees)

## 4. Events & Calendar Management

### 4.1 Current State
- FeaturedEvent model exists with full schema
- EventTag support for categorization
- Placeholder admin page exists (`/app/admin/events/page.tsx`)
- Google Calendar basic integration exists (`lib/google-calendar.ts`)
- Uses service account for calendar access

### 4.2 Required Features

#### 4.2.1 Google OAuth Integration
**User Story**: As an admin, I want to authenticate with Google to access calendar data.

**Acceptance Criteria**:
- OAuth 2.0 flow for Google Calendar
- Scope: read/write calendar events
- Store access/refresh tokens securely (ServiceKey model)
- Token refresh handling
- Disconnect/reconnect functionality
- Support for multiple Google accounts (if needed)

**Technical Notes**:
- NextAuth already configured (`app/api/auth/[...nextauth]/`)
- Add Google provider to NextAuth config
- Store tokens in ServiceKey model

**Questions**:
- Should this use service account (current) or OAuth?
- Multiple admin users accessing same calendar or individual calendars?

#### 4.2.2 Automatic Google Calendar Sync
**User Story**: As an admin, I want events to automatically sync from Google Calendar.

**Acceptance Criteria**:
- Scheduled sync (every 15 minutes)
- Manual sync button
- Sync events from specified date range (default: 1 year future)
- Map Google event fields to FeaturedEvent:
  - title, description, location
  - start/end dates
  - Google event ID
- Handle event updates (update existing FeaturedEvent)
- Handle event deletions (mark as inactive or delete)
- Sync status display
- Error logging and notification

**Technical Notes**:
- Existing `getUpcomingScheduleEvents()` in `lib/google-calendar.ts`
- Implement using cron job or Next.js background task

#### 4.2.3 Manual Event Creation & Editing
**User Story**: As an admin, I want to manually create and edit featured events.

**Acceptance Criteria**:
- Create event form with fields:
  - Title, description, location
  - Start/end date/time
  - Featured date range
  - "Where is Jose?" checkbox
  - Custom description override
  - Tags
- Edit existing events (both manual and synced)
- Delete events
- Duplicate event
- Preview event display
- Validation (dates, required fields)

#### 4.2.4 "Where is Jose?" Event Tracking
**User Story**: As an admin, I want to mark special events as "Where is Jose?" for prominent display.

**Acceptance Criteria**:
- Toggle "Where is Jose?" flag on any event
- Dedicated "Where is Jose?" section in admin
- Filter events by this flag
- Display on frontend "Where is Jose?" page
- Only show currently featured events (featuredFrom/To range)
- Support multiple concurrent "Where is Jose?" events
- Calendar view of "Where is Jose?" events

#### 4.2.5 Homepage Event Display Controls
**User Story**: As an admin, I want to control which events appear on the homepage.

**Acceptance Criteria**:
- Set featured date range per event
- Events only show during featured period
- Order/priority setting
- Maximum events to display (configurable)
- Preview homepage event section
- Quick enable/disable featured status
- Scheduled featuring (auto-show/hide based on dates)

#### 4.2.6 Event Tagging System
**User Story**: As an admin, I want to categorize events with tags.

**Acceptance Criteria**:
- Create/edit/delete event tags
- Assign multiple tags to event
- Tag types: EVENT type already exists in TagType enum
- Filter events by tags
- Tag-based frontend filtering
- Auto-suggest existing tags
- Tag usage statistics

**Technical Notes**:
- Tag and EventTag models already exist
- Reuse existing tag management patterns from products/recipes

## 5. SEO Management

### 5.1 Current State
- Placeholder SEO page exists (`/app/admin/seo/page.tsx`)
- Individual pages (Products, Recipes, Categories) have SEO fields
- Basic metadata generation exists (`lib/metadata.ts`)
- Products and Recipes have metaTitle, metaDescription, ogImage fields

### 5.2 Required Features

#### 5.2.1 Global Site SEO Configuration
**User Story**: As an admin, I want to manage global SEO settings.

**Acceptance Criteria**:
- Database model for SEO settings (new SeoConfiguration model)
- Global settings:
  - Site name
  - Default site description
  - Site URL
  - Default OG image URL
  - Twitter/X handle
  - Facebook App ID
  - Default meta keywords
- Settings persist to database
- API to retrieve settings
- Use in metadata generation

#### 5.2.2 Meta Tag Template System
**User Story**: As an admin, I want to create templates for meta tags with variables.

**Acceptance Criteria**:
- Templates for:
  - Product pages: `{product_name} | {category} - Jose Madrid Salsa`
  - Recipe pages: `{recipe_name} Recipe | Jose Madrid`
  - Category pages: `{category_name} | Jose Madrid Salsa`
  - Location pages: `Find Jose Madrid Salsa at {business_name} in {city}, {state}`
- Supported variables per template type
- Variable preview/testing
- Default templates provided
- Override per entity (product, recipe, etc.)
- Template validation

#### 5.2.3 Schema.org Structured Data Editor
**User Story**: As an admin, I want to manage structured data markup.

**Acceptance Criteria**:
- Organization schema editor:
  - Name, logo, contact info
  - Social media profiles
  - Address
- Product schema (auto-generated from product data):
  - Name, description, image
  - Price, availability
  - Brand, SKU
  - Reviews/ratings
- Recipe schema (auto-generated):
  - Name, image, description
  - Ingredients, instructions
  - Prep/cook time, servings
  - Nutrition information
- LocalBusiness schema for locations
- Event schema for calendar events
- Preview JSON-LD output
- Validation against schema.org specs

#### 5.2.4 Robots.txt & Sitemap Configuration
**User Story**: As an admin, I want to configure robots.txt and manage sitemaps.

**Acceptance Criteria**:
- Robots.txt editor:
  - Visual editor or text mode
  - Preset rules (allow all, disallow admin, etc.)
  - Test/validate syntax
  - Preview before publish
- Sitemap configuration:
  - Auto-generate from routes
  - Include/exclude page types
  - Set change frequency per section
  - Set priority per section
  - Manual URL additions
  - Validate sitemap XML
- Automatic submission to Google Search Console (if integrated)

**Technical Notes**:
- Next.js supports `app/robots.ts` and `app/sitemap.ts`
- Implement configuration storage in database

#### 5.2.5 SEO Analysis & Recommendations
**User Story**: As an admin, I want SEO analysis for each page with improvement recommendations.

**Acceptance Criteria**:
- Per-page SEO score (0-100)
- Analysis checks:
  - Meta title length (50-60 chars optimal)
  - Meta description length (150-160 chars optimal)
  - H1 tag presence and optimization
  - Image alt text coverage
  - Internal linking
  - Keyword usage
  - URL structure
  - Mobile-friendliness
  - Page load speed
- Color-coded results (green/yellow/red)
- Specific recommendations per issue
- Bulk analysis report
- Historical tracking

#### 5.2.6 Google Search Console Integration
**User Story**: As an admin, I want to view Google Search Console data within the admin panel.

**Acceptance Criteria**:
- OAuth integration with Google Search Console
- Display metrics:
  - Total clicks, impressions
  - Average CTR
  - Average position
  - Top queries
  - Top pages
- Date range selector
- Search performance charts
- Index coverage status
- Mobile usability issues
- Core Web Vitals
- Manual actions/security issues
- Sitemap submission status

**Questions**:
- Should this use the same Google OAuth as calendar or separate?
- Which Google Search Console properties to track?

## 6. AI Training & Chatbot Enhancements

### 6.1 Current State
- RAG-based chatbot architecture implemented
- TrainingDocument model with upload/scrape capability
- Admin UI for managing training data (`/app/admin/training-data/`)
- Integration with multiple content sources (products, recipes, locations, markdown)
- AI chat widget on frontend (`components/chat/ai-chat-widget.tsx`)

### 6.2 Required Features

#### 6.2.1 Enhanced Training Control
**User Story**: As an admin, I want full control over AI training content.

**Acceptance Criteria**:
- Organize training documents by category:
  - Product information
  - Order/shipping policies
  - Payment/Stripe information
  - Account management
  - General FAQ
  - Troubleshooting
- Assign priority/weight to documents
- Enable/disable specific documents
- Version control for training content
- A/B testing different training sets
- Bulk operations (delete, re-index, update)

#### 6.2.2 Specialized Knowledge Domains
**User Story**: As an admin, I want to train the chatbot on specific operational domains.

**Acceptance Criteria**:
- Create knowledge bases for:
  - **Orders**: Order statuses, tracking, modifications, cancellations
  - **Shipping**: Shipping methods, costs, delivery times, tracking
  - **Payment**: Payment methods, Stripe integration, refunds, gift certificates
  - **Stripe**: Payment processing, failed payments, refund procedures
  - **Accounts**: Registration, login, password reset, profile management
  - **Documentation**: Product info, ingredient lists, heat levels, recipes
- Domain-specific prompt templates
- Route queries to appropriate domain
- Domain performance metrics

#### 6.2.3 Customer Support Capabilities
**User Story**: As a customer, I want the chatbot to help resolve common issues.

**Acceptance Criteria**:
- Issue resolution workflows:
  - Order status lookup (by order number or email)
  - Tracking number retrieval
  - Return/refund request initiation
  - Gift certificate balance check
  - Account password reset assistance
  - Product recommendations
  - Recipe suggestions
- Escalation to human support when needed
- Conversation handoff to admin messaging system
- Collect customer info for support tickets
- Integration with existing Conversation/Message models

#### 6.2.4 Training Content Management
**User Story**: As an admin, I want to easily manage and update training content.

**Acceptance Criteria**:
- Rich text editor for manual content creation
- Template library for common topics
- Import from existing documentation
- Auto-detect duplicate content
- Content quality scoring
- Suggest missing topics based on chat logs
- Search and filter training documents
- Preview how content affects responses

#### 6.2.5 Chatbot Analytics & Improvement
**User Story**: As an admin, I want insights into chatbot performance.

**Acceptance Criteria**:
- Analytics dashboard:
  - Total conversations
  - Resolution rate
  - Average response time
  - User satisfaction ratings
  - Common questions
  - Unanswered queries
  - Domain usage breakdown
- Conversation logs with filtering
- Export conversations for analysis
- Identify knowledge gaps
- A/B testing results
- Response accuracy feedback loop
- Continuous learning recommendations

**Technical Notes**:
- Store chat interactions in database
- Implement feedback mechanism (thumbs up/down)
- Track successful resolutions

#### 6.2.6 Advanced Integrations
**User Story**: As an admin, I want the chatbot to access live data for accurate responses.

**Acceptance Criteria**:
- Real-time data access:
  - Order status from database
  - Product availability
  - Current promotions
  - Store hours/locations
  - Event schedules
- API function calling:
  - Look up order by number
  - Check gift certificate balance
  - Find nearest retail location
  - Get product information
- Secure data access (user authentication for personal data)
- Rate limiting on database queries
- Fallback to static knowledge when APIs unavailable

## 7. Cross-Cutting Requirements

### 7.1 Authentication & Authorization
- All admin features require authentication
- Role-based access control (use existing RBAC system)
- Permission checks for each feature area
- Audit logging for sensitive operations

### 7.2 Performance
- Page load times < 2 seconds
- API responses < 500ms for standard queries
- Support for 100+ concurrent admin users
- Efficient database queries with proper indexing
- Caching strategies for frequently accessed data

### 7.3 Data Validation & Error Handling
- Client-side validation for all forms
- Server-side validation for all APIs
- User-friendly error messages
- Detailed error logging for debugging
- Graceful degradation when services unavailable

### 7.4 UI/UX Consistency
- Follow existing admin panel design patterns
- Use shared component library
- Responsive design (desktop, tablet, mobile)
- Accessibility compliance (WCAG 2.1 AA)
- Keyboard navigation support
- Loading states and progress indicators

### 7.5 Testing
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Test coverage > 80%
- Performance testing for bulk operations

### 7.6 Documentation
- API documentation (in-code comments)
- Admin user guides for new features
- Developer documentation for integrations
- Deployment procedures
- Troubleshooting guides

## 8. Implementation Priorities

### Phase 1: Critical Features (Weeks 1-2)
1. Orders: Import, Modify, Enhanced Shopify Integration
2. Gift Certificates: Import/Export
3. Locations: Progress Display, Data Verification

### Phase 2: Integration Features (Weeks 3-4)
4. Events: Google OAuth, Calendar Sync, Manual CRUD
5. Orders: Print Labels, Invoices/Packing Slips
6. SEO: Global Config, Meta Templates

### Phase 3: Advanced Features (Weeks 5-6)
7. SEO: Schema.org, Robots/Sitemap, Analysis
8. AI: Enhanced Training, Customer Support Capabilities
9. Events: "Where is Jose?", Homepage Display, Tagging

### Phase 4: Analytics & Optimization (Week 7)
10. Orders: Notifications
11. SEO: Google Search Console Integration
12. AI: Analytics Dashboard, Advanced Integrations

## 9. Open Questions & Clarifications Needed

### Orders
1. Should order imports automatically sync to Shopify?
2. Are there specific shipping carriers required beyond what Shopify offers?
3. What third-party fulfillment services are currently in use?
4. Should SMS notifications be supported in addition to email?

### Gift Certificates
5. Should gift certificates sync to Shopify as products?
6. Are there limits on gift certificate amounts?
7. Should there be a separate gift certificate expiration policy?

### Locations
8. Are all 149 locations currently in the database, or do they need to be imported?
9. Should location changes trigger notifications to any external systems?

### Events
10. Should Google Calendar integration use service account (current) or OAuth per admin user?
11. Can one event be both synced from Google AND manually edited?
12. How many events should display on homepage (max)?

### SEO
13. Should SEO recommendations be automated or manual review?
14. Which Google Search Console property should be tracked?
15. Should sitemap updates trigger automatic GSC submission?

### AI/Chatbot
16. What's the budget/plan for OpenAI API usage?
17. Should the chatbot have access to customer order details (PII concerns)?
18. Should there be an escalation path to human support? How?
19. What data retention policies apply to chat logs?

### General
20. What's the deployment schedule? (staging -> production timeline)
21. Are there specific third-party services already contracted?
22. What's the expected concurrent admin user count?
23. Any regulatory compliance requirements (PCI DSS, GDPR, etc.)?

## 10. Success Metrics

### Orders Management
- 50% reduction in time spent on manual order processing
- 90% of orders successfully sync to Shopify
- < 5% error rate on order imports
- Average order modification time < 2 minutes

### Gift Certificates
- Support for 1000+ active gift certificates
- < 1% duplicate code generation rate
- 100% balance accuracy

### Locations
- All 149 locations verified and complete
- Photo fetch success rate > 95%
- Location data update sync < 5 minutes

### Events
- 100% of Google Calendar events synced
- < 5 minute sync delay
- Zero missed featured events

### SEO
- Average SEO score > 85/100
- Increase organic search traffic by 30%
- All critical pages indexed in GSC

### AI/Chatbot
- 70% query resolution rate without human intervention
- < 2 second average response time
- 80% user satisfaction rating
- 50% reduction in support tickets for common issues

## 11. Technical Debt & Maintenance

- Ensure all new features follow existing code conventions
- Maintain TypeScript strict mode compliance
- Update tests for all new functionality
- Keep dependencies updated (security patches)
- Document all new APIs
- Ensure all features work with existing permission system
- Validate against production database schema

## 12. Dependencies

### External Services
- Google Calendar API
- Google Search Console API
- Google Places API (already integrated)
- Shopify Admin API (already integrated)
- Shipping carrier APIs (USPS, UPS, FedEx)
- OpenAI API (already integrated)
- Stripe API (already integrated)

### Infrastructure
- PostgreSQL database (existing)
- Redis for caching/job queues (may need to add)
- File storage for PDFs (invoices, labels)
- Background job processing system

### Libraries/Tools
- PDF generation library (pdf-lib or pdfkit)
- Excel parsing/generation (exceljs - already installed)
- CSV parsing (papaparse - already installed)
- OAuth libraries (next-auth - already installed)
- Calendar API wrapper (googleapis - already installed)

---

**Document Version**: 1.0  
**Last Updated**: December 16, 2025  
**Status**: Pending Review & Approval
