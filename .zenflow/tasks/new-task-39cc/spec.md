# Technical Specification: Jose Madrid Admin Panel Enhancements

## 1. Technical Context

### 1.1 Technology Stack
- **Framework**: Next.js 16.0.10 (App Router)
- **Runtime**: Node.js with TypeScript 5.9.3
- **Database**: PostgreSQL via Prisma 6.19.0
- **UI Framework**: React 19.2.0
- **Styling**: Tailwind CSS 3.4.18 with shadcn/ui components
- **Authentication**: NextAuth 4.24.11
- **Email**: Resend 6.3.0 with Nodemailer fallback
- **Payment**: Stripe 19.1.0
- **Analytics**: Vercel Analytics

### 1.2 Key Dependencies
- **Data Processing**: exceljs 4.4.0, papaparse 5.5.3
- **Google Services**: googleapis 143.0.0 (Calendar, Places, Search Console)
- **AI/RAG**: @openai/codex-sdk 0.57.0
- **PDF Generation**: pdf-lib or pdfkit (to be added)
- **Forms**: react-hook-form 7.64.0, zod 4.1.12
- **State Management**: zustand 5.0.8

### 1.3 Existing Architecture Patterns
- **Server Components**: Default rendering strategy
- **API Routes**: `/app/api/admin/[resource]/route.ts`
- **RBAC**: Permission-based access control via `lib/rbac.ts`
- **Audit Logging**: Automatic via `lib/audit.ts`
- **Data Validation**: Zod schemas for all inputs
- **File Organization**: Co-located components in `_components/` folders

### 1.4 Database Schema Extensions Required

#### New Models
```prisma
model SeoConfiguration {
  id                String   @id @default(cuid())
  siteName          String
  siteDescription   String   @db.Text
  siteUrl           String
  defaultOgImage    String?
  twitterHandle     String?
  facebookAppId     String?
  defaultKeywords   String[]
  
  // Meta templates
  productTitleTemplate     String   @default("{product_name} | {category} - Jose Madrid Salsa")
  recipeTitleTemplate      String   @default("{recipe_name} Recipe | Jose Madrid")
  categoryTitleTemplate    String   @default("{category_name} | Jose Madrid Salsa")
  locationTitleTemplate    String   @default("Find Jose Madrid Salsa at {business_name} in {city}, {state}")
  
  // Robots.txt config
  robotsTxt         String?  @db.Text
  
  // Sitemap config
  sitemapConfig     Json?    // {products: {priority: 0.8, changefreq: 'weekly'}}
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@map("seo_configurations")
}

model StructuredData {
  id                String   @id @default(cuid())
  type              StructuredDataType
  entityId          String?  // Product/Recipe/Location ID
  
  // JSON-LD content
  jsonLd            Json
  
  // Status
  isActive          Boolean  @default(true)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([type, entityId])
  @@map("structured_data")
}

enum StructuredDataType {
  ORGANIZATION
  PRODUCT
  RECIPE
  LOCAL_BUSINESS
  EVENT
}

model OrderNotificationSetting {
  id                String   @id @default(cuid())
  userId            String   @unique
  
  // Email notifications
  emailNewOrder         Boolean  @default(true)
  emailStatusChange     Boolean  @default(true)
  emailPaymentFailed    Boolean  @default(true)
  emailRefundRequest    Boolean  @default(true)
  emailHighValue        Boolean  @default(true)
  highValueThreshold    Decimal  @default(500) @db.Decimal(10, 2)
  
  // In-app notifications
  inAppNewOrder         Boolean  @default(true)
  inAppStatusChange     Boolean  @default(false)
  
  // SMS notifications (future)
  smsEnabled            Boolean  @default(false)
  smsPhone              String?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@map("order_notification_settings")
}

model Notification {
  id                String           @id @default(cuid())
  userId            String
  type              NotificationType
  title             String
  message           String           @db.Text
  link              String?
  
  isRead            Boolean          @default(false)
  readAt            DateTime?
  
  createdAt         DateTime         @default(now())
  
  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}

enum NotificationType {
  ORDER_NEW
  ORDER_STATUS_CHANGE
  ORDER_PAYMENT_FAILED
  ORDER_REFUND_REQUEST
  ORDER_HIGH_VALUE
  SYSTEM
}

model TrainingDocumentCategory {
  id                String   @id @default(cuid())
  name              String   @unique
  slug              String   @unique
  description       String?
  priority          Int      @default(0)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@map("training_document_categories")
}

model ChatConversation {
  id                String           @id @default(cuid())
  sessionId         String
  userId            String?
  
  // Customer info (for guest users)
  guestEmail        String?
  guestName         String?
  
  // Conversation metadata
  topic             String?
  domain            ChatDomain?
  
  // Resolution tracking
  isResolved        Boolean          @default(false)
  resolvedAt        DateTime?
  escalatedToHuman  Boolean          @default(false)
  escalatedAt       DateTime?
  
  // Feedback
  userSatisfaction  Int?             // 1-5 rating
  feedbackComment   String?
  
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  
  messages          ChatMessage[]
  
  @@index([sessionId])
  @@index([userId])
  @@index([createdAt])
  @@map("chat_conversations")
}

model ChatMessage {
  id                String           @id @default(cuid())
  conversationId    String
  conversation      ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  role              ChatRole
  content           String           @db.Text
  
  // Function calls (for AI)
  functionName      String?
  functionArgs      Json?
  functionResult    Json?
  
  // Response quality
  wasHelpful        Boolean?
  
  createdAt         DateTime         @default(now())
  
  @@index([conversationId])
  @@map("chat_messages")
}

enum ChatDomain {
  ORDERS
  SHIPPING
  PAYMENT
  STRIPE
  ACCOUNTS
  PRODUCTS
  RECIPES
  GENERAL
}

enum ChatRole {
  USER
  ASSISTANT
  SYSTEM
}

model ShippingProvider {
  id                String   @id @default(cuid())
  name              String   // "USPS", "UPS", "FedEx", "ShipStation", etc.
  type              ShippingProviderType
  
  // Configuration
  isActive          Boolean  @default(false)
  apiKey            String?  @db.Text
  apiSecret         String?  @db.Text
  accountNumber     String?
  
  // Settings
  settings          Json?    // Provider-specific config
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@map("shipping_providers")
}

enum ShippingProviderType {
  CARRIER           // Direct carrier (USPS, UPS, FedEx)
  AGGREGATOR        // ShipStation, Shippo, EasyPost
  SHOPIFY           // Use Shopify's shipping
}
```

#### Schema Updates to Existing Models
```prisma
// Update TrainingDocument model
model TrainingDocument {
  // ... existing fields
  categoryId        String?
  category          TrainingDocumentCategory? @relation(fields: [categoryId], references: [id])
  priority          Int      @default(0)
  domain            ChatDomain?
  isEnabled         Boolean  @default(true)
  version           Int      @default(1)
}

// Update Order model
model Order {
  // ... existing fields
  shippingLabelUrl  String?
  packingSlipUrl    String?
  invoiceUrl        String?
  invoiceSentAt     DateTime?
  
  // Modification history
  modificationHistory Json[]  @default([])
}
```

## 2. Implementation Approach

### 2.1 Orders Management

#### 2.1.1 Import Orders
**Files to Create:**
- `app/api/admin/orders/import/route.ts`
- `app/admin/orders/_components/import-orders-dialog.tsx`
- `lib/orders/import.ts`

**Implementation:**
```typescript
// lib/orders/import.ts
import { parse } from 'papaparse'
import { read, utils } from 'exceljs'
import { z } from 'zod'

const OrderImportSchema = z.object({
  orderNumber: z.string().optional(),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  items: z.array(z.object({
    sku: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })),
  shippingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
  }),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING']).default('PENDING'),
})

export async function parseOrderFile(file: File) {
  // Parse CSV/XLSX
  // Validate each row
  // Return validated orders + errors
}

export async function importOrders(orders: ValidatedOrder[]) {
  // Create orders in transaction
  // Generate order numbers
  // Link to existing users or create guest orders
  // Optional: sync to Shopify
}
```

**API Route:**
- POST `/api/admin/orders/import`: Accepts multipart/form-data
- Returns preview with validation errors
- Second request confirms import

#### 2.1.2 Modify Orders
**Files to Create:**
- `app/admin/orders/[id]/edit/page.tsx`
- `app/api/admin/orders/[id]/route.ts` (PATCH method)
- `lib/orders/modify.ts`

**Implementation:**
- Form with react-hook-form
- Recalculate totals automatically
- Log changes in `modificationHistory` JSON field
- Audit log entry via `lib/audit.ts`
- Optional customer notification via email

#### 2.1.3 Print Shipping Labels
**Files to Create:**
- `app/api/admin/orders/[id]/shipping-label/route.ts`
- `app/api/admin/orders/batch-labels/route.ts`
- `lib/shipping/providers/` (carrier integrations)
- `app/admin/settings/shipping/page.tsx`

**Implementation Strategy:**
1. Start with Shopify Shipping API (already integrated)
2. Add direct carrier support later
3. Shipping provider configuration in `ShippingProvider` model
4. Generate PDF labels, store in public/shipping-labels or S3
5. Update order with tracking number and label URL

#### 2.1.4 Third-Party Integrations
**Files to Create:**
- `app/admin/settings/integrations/shipping/page.tsx`
- `lib/shipping/providers/shipstation.ts`
- `lib/shipping/providers/shippo.ts`

**Implementation:**
- OAuth flow for providers that support it
- API key storage in `ShippingProvider` model (encrypted)
- Webhook endpoints for status updates
- Test connection functionality

#### 2.1.5 Enhanced Shopify Integration
**Files to Modify:**
- `app/admin/orders/page.tsx` (add sync columns)
- `app/admin/orders/[id]/page.tsx` (add sync panel)
- `app/api/admin/orders/[id]/sync/route.ts`
- `lib/shopify/sync.ts` (enhance with retry logic)

**Implementation:**
- Dashboard widget showing sync stats
- Visual indicators for sync status
- Manual re-sync button per order
- Bulk sync action
- Link to Shopify admin

#### 2.1.6 Invoices & Packing Slips
**Files to Create:**
- `app/api/admin/orders/[id]/invoice/route.ts`
- `app/api/admin/orders/[id]/packing-slip/route.ts`
- `lib/pdf/invoice-generator.ts`
- `lib/pdf/packing-slip-generator.ts`
- `app/admin/settings/templates/page.tsx`

**PDF Library:** Use `pdf-lib` for generation
**Templates:** Store as React components, render to HTML, convert to PDF
**Branding:** Configurable company logo, colors via settings

#### 2.1.7 Order Notifications
**Files to Create:**
- `app/api/admin/notifications/route.ts`
- `app/admin/settings/notifications/page.tsx`
- `lib/notifications/order-notifications.ts`
- `components/layout/notification-bell.tsx`

**Implementation:**
- Server-Sent Events for real-time notifications
- Email via existing email system
- Notification preferences per admin user
- Mark as read functionality

### 2.2 Gift Certificates

#### 2.2.1 Import/Export
**Files to Create:**
- `app/api/admin/gift-certificates/import/route.ts`
- `app/api/admin/gift-certificates/export/route.ts`
- `app/admin/gift-certificates/_components/import-dialog.tsx`
- `lib/gift-certificates/import.ts`

**Implementation:**
- Reuse CSV/Excel parsing from orders
- Generate unique codes if not provided
- Validate code uniqueness
- Export with usage history

#### 2.2.2 Enhanced Management
**Files to Modify:**
- `app/admin/gift-certificates/page.tsx`
- `app/admin/gift-certificates/[id]/page.tsx`

**Features:**
- Bulk actions component
- Quick edit inline
- Send/resend email
- Manual usage entry

#### 2.2.3 Checkout Integration
**Files to Create/Modify:**
- `app/checkout/_components/gift-certificate-input.tsx`
- `app/api/checkout/apply-gift-certificate/route.ts`
- `lib/checkout/gift-certificate.ts`

**Implementation:**
- Apply during checkout
- Store in session/cart state
- Deduct from total
- Create usage record on order completion
- Support partial redemption

### 2.3 Location Management

#### 2.3.1 Fetch Photos Progress
**Files to Modify:**
- `app/api/admin/locations/fetch-photos/route.ts`
- `app/admin/locations/_components/fetch-photos-button.tsx`

**Implementation:**
- Server-Sent Events for progress updates
- Store progress in memory (could use Redis for scale)
- Console-style display component
- Cancel operation support
- Error tracking and reporting

#### 2.3.2 Location Import/Export/Edit
**Files to Create:**
- `app/api/admin/locations/import/route.ts`
- `app/api/admin/locations/export/route.ts`
- `app/admin/locations/[id]/edit/page.tsx`

**Implementation:**
- Map picker for coordinates
- Geocoding API integration (Google Maps)
- Photo upload to media library
- Bulk edit modal

#### 2.3.3 Frontend Parity
**Files to Verify:**
- `app/find-us/page.tsx`
- `app/api/locations/route.ts`

**Implementation:**
- Shared query logic in `lib/locations/query.ts`
- Cache with revalidation
- Same filtering/sorting
- Real-time updates via cache invalidation

### 2.4 Events & Calendar

#### 2.4.1 Google OAuth Integration
**Files to Modify:**
- `app/api/auth/[...nextauth]/route.ts`
- `lib/google-calendar.ts`

**Implementation:**
- Add Google provider to NextAuth
- Request calendar.readonly and calendar.events scopes
- Store tokens in `ServiceKey` model
- Token refresh logic

#### 2.4.2 Calendar Sync
**Files to Create:**
- `app/api/admin/events/sync/route.ts`
- `app/api/cron/calendar-sync/route.ts` (scheduled)
- `lib/events/calendar-sync.ts`

**Implementation:**
- Scheduled cron job (every 15 min)
- Map Google Calendar fields to FeaturedEvent
- Handle create/update/delete
- Conflict resolution (manual edits vs synced events)

#### 2.4.3 Manual Event CRUD
**Files to Create:**
- `app/admin/events/new/page.tsx`
- `app/admin/events/[id]/edit/page.tsx`
- `app/api/admin/events/route.ts`
- `app/api/admin/events/[id]/route.ts`

**Implementation:**
- Form with date/time pickers
- Tag assignment
- "Where is Jose?" toggle
- Featured date range
- Preview component

#### 2.4.4 Event Tagging
**Files to Modify:**
- `app/admin/events/page.tsx` (add tag filters)
- Reuse existing Tag system with TagType.EVENT

#### 2.4.5 Homepage Display
**Files to Modify:**
- `app/page.tsx` (if not already showing events)
- `app/api/events/featured/route.ts`

**Implementation:**
- Query events within featured date range
- Order by priority/date
- Configurable max count
- Cache for performance

### 2.5 SEO Management

#### 2.5.1 Global SEO Configuration
**Files to Create:**
- `app/admin/seo/settings/page.tsx`
- `app/api/admin/seo/configuration/route.ts`
- `lib/seo/configuration.ts`

**Implementation:**
- Single-row configuration table
- Form for all global settings
- Used by `lib/metadata.ts`

#### 2.5.2 Meta Tag Templates
**Files to Modify:**
- `lib/metadata.ts`

**Implementation:**
- Template string replacement
- Variables per entity type
- Override capability on entities
- Preview functionality

#### 2.5.3 Structured Data Editor
**Files to Create:**
- `app/admin/seo/structured-data/page.tsx`
- `lib/seo/schema-generator.ts`

**Implementation:**
- JSON-LD generator functions
- Organization schema (site-wide)
- Product/Recipe/Event schemas (auto-generated)
- Preview and validation
- Inject in page layouts

#### 2.5.4 Robots.txt & Sitemap
**Files to Create:**
- `app/robots.ts` (Next.js dynamic robots.txt)
- `app/sitemap.ts` (Next.js dynamic sitemap)
- `app/admin/seo/robots/page.tsx`
- `app/admin/seo/sitemap/page.tsx`

**Implementation:**
- Store config in SeoConfiguration model
- Generate dynamically based on DB content
- Manual URL additions
- Validation

#### 2.5.5 SEO Analysis
**Files to Create:**
- `app/api/admin/seo/analyze/route.ts`
- `lib/seo/analyzer.ts`
- `app/admin/seo/analysis/page.tsx`

**Implementation:**
- Analyze meta tags, headings, images
- Score calculation
- Recommendations engine
- Bulk analysis

#### 2.5.6 Google Search Console Integration
**Files to Create:**
- `app/api/admin/seo/gsc/route.ts`
- `app/admin/seo/search-console/page.tsx`
- `lib/google/search-console.ts`

**Implementation:**
- OAuth integration (reuse Google provider)
- Fetch metrics via API
- Charts and visualizations
- Date range filtering

### 2.6 AI Training & Chatbot

#### 2.6.1 Enhanced Training Control
**Files to Create:**
- `app/admin/training-data/categories/page.tsx`
- `app/api/admin/training-categories/route.ts`

**Files to Modify:**
- `app/admin/training-data/page.tsx` (add category filter, priority, enable/disable)
- `lib/ai-rag/retriever.ts` (respect priority, enabled status)

#### 2.6.2 Knowledge Domains
**Files to Modify:**
- `lib/ai-rag/retriever.ts` (add domain filtering)
- `app/api/chat/route.ts` (add domain routing)

**Implementation:**
- Classify queries by domain
- Domain-specific prompts
- Route to appropriate knowledge base
- Metrics per domain

#### 2.6.3 Customer Support Capabilities
**Files to Create:**
- `app/api/chat/tools/route.ts` (function calling endpoints)
- `lib/chat/tools/order-lookup.ts`
- `lib/chat/tools/gift-certificate-balance.ts`
- `lib/chat/tools/product-search.ts`

**Implementation:**
- OpenAI function calling
- Secure data access (verify customer identity)
- Escalation to human via Conversation model
- Rate limiting

#### 2.6.4 Content Management
**Files to Modify:**
- `app/admin/training-data/page.tsx` (add rich text editor)
- `app/admin/training-data/templates/page.tsx` (template library)

#### 2.6.5 Analytics
**Files to Create:**
- `app/admin/ai-analytics/page.tsx`
- `app/api/admin/chat/analytics/route.ts`

**Implementation:**
- Store conversations in ChatConversation model
- Feedback thumbs up/down
- Analytics dashboard
- Common questions report
- Knowledge gap detection

#### 2.6.6 Advanced Integrations
**Files to Modify:**
- `app/api/chat/route.ts` (add function calling)

**Implementation:**
- Define functions for AI to call
- Real-time data access
- Authentication for personal data
- Rate limiting

## 3. Source Code Structure

### 3.1 New Directories
```
app/
  admin/
    orders/
      [id]/
        edit/                     # Order modification
      _components/
        import-orders-dialog.tsx
        order-modification-form.tsx
    gift-certificates/
      _components/
        import-dialog.tsx
        bulk-actions.tsx
    locations/
      [id]/
        edit/                     # Location editor
    events/
      new/
      [id]/
        edit/
    seo/
      settings/
      structured-data/
      robots/
      sitemap/
      analysis/
      search-console/
    ai-analytics/
    settings/
      notifications/
      shipping/
      templates/
  api/
    admin/
      orders/
        import/
        [id]/
          sync/
          invoice/
          packing-slip/
          shipping-label/
        batch-labels/
      gift-certificates/
        import/
        export/
      locations/
        import/
        export/
      events/
        sync/
      seo/
        configuration/
        analyze/
        gsc/
      notifications/
      training-categories/
      chat/
        analytics/
    chat/
      tools/                      # AI function calling
    cron/
      calendar-sync/
  checkout/
    _components/
      gift-certificate-input.tsx

lib/
  orders/
    import.ts
    modify.ts
  shipping/
    providers/
      shopify.ts
      shipstation.ts
      shippo.ts
  gift-certificates/
    import.ts
    export.ts
  pdf/
    invoice-generator.ts
    packing-slip-generator.ts
  events/
    calendar-sync.ts
  seo/
    configuration.ts
    analyzer.ts
    schema-generator.ts
  google/
    search-console.ts
  chat/
    tools/
      order-lookup.ts
      gift-certificate-balance.ts
      product-search.ts
  notifications/
    order-notifications.ts

components/
  layout/
    notification-bell.tsx
  admin/
    orders/
      shipping-label-generator.tsx
    seo/
      seo-score-badge.tsx
      structured-data-preview.tsx
```

### 3.2 Files to Modify
- `prisma/schema.prisma` - Add new models
- `lib/metadata.ts` - Template system
- `lib/rbac.ts` - Add new permissions
- `app/api/chat/route.ts` - Enhanced AI capabilities
- `app/admin/orders/page.tsx` - Add import/sync UI
- `app/admin/gift-certificates/page.tsx` - Add import/export
- `app/admin/locations/page.tsx` - Enhanced UI
- `app/admin/events/page.tsx` - Full implementation

## 4. Data Model Changes

### 4.1 New Permissions
```typescript
// Add to Permission model seed
const newPermissions = [
  // Orders
  { name: 'orders:import', category: 'ORDERS' },
  { name: 'orders:modify', category: 'ORDERS' },
  { name: 'orders:print-labels', category: 'ORDERS' },
  { name: 'orders:sync-shopify', category: 'ORDERS' },
  
  // Gift Certificates
  { name: 'gift-certificates:import', category: 'CONTENT' },
  { name: 'gift-certificates:export', category: 'CONTENT' },
  
  // Locations
  { name: 'locations:import', category: 'CONTENT' },
  { name: 'locations:export', category: 'CONTENT' },
  
  // Events
  { name: 'events:sync-calendar', category: 'CONTENT' },
  
  // SEO
  { name: 'seo:manage', category: 'SETTINGS' },
  { name: 'seo:analyze', category: 'ANALYTICS' },
  
  // AI
  { name: 'ai:manage-training', category: 'SETTINGS' },
  { name: 'ai:view-analytics', category: 'ANALYTICS' },
]
```

### 4.2 Indexes to Add
```prisma
@@index([status, shopifySyncedAt]) on Order
@@index([isEnabled, domain]) on TrainingDocument
@@index([isResolved, escalatedToHuman]) on ChatConversation
```

## 5. API Design

### 5.1 RESTful Endpoints

#### Orders
- `POST /api/admin/orders/import` - Import orders from file
- `PATCH /api/admin/orders/[id]` - Modify order
- `POST /api/admin/orders/[id]/sync` - Sync to Shopify
- `GET /api/admin/orders/[id]/invoice` - Generate invoice PDF
- `GET /api/admin/orders/[id]/packing-slip` - Generate packing slip
- `POST /api/admin/orders/[id]/shipping-label` - Generate shipping label
- `POST /api/admin/orders/batch-labels` - Batch label generation

#### Gift Certificates
- `POST /api/admin/gift-certificates/import`
- `GET /api/admin/gift-certificates/export`
- `POST /api/checkout/apply-gift-certificate`
- `GET /api/gift-certificates/balance?code=XXX`

#### Locations
- `POST /api/admin/locations/import`
- `GET /api/admin/locations/export`
- `GET /api/admin/locations/fetch-photos` (SSE)

#### Events
- `POST /api/admin/events/sync` - Manual calendar sync
- `POST /api/cron/calendar-sync` - Scheduled sync
- `GET /api/events/featured` - Public featured events

#### SEO
- `GET/PUT /api/admin/seo/configuration`
- `POST /api/admin/seo/analyze` - Analyze page SEO
- `GET /api/admin/seo/gsc` - Search Console data

#### Notifications
- `GET /api/admin/notifications` (SSE or polling)
- `PATCH /api/admin/notifications/[id]` - Mark as read

#### AI/Chat
- `POST /api/chat` - Enhanced with function calling
- `GET /api/admin/chat/analytics`
- `POST /api/admin/training-categories`

### 5.2 Response Formats
All endpoints follow existing pattern:
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }
```

### 5.3 Rate Limiting
- Public endpoints: 100 req/min per IP
- Admin endpoints: 1000 req/min per user
- AI chat: 20 req/min per session
- Use existing `lib/rateLimit.ts`

## 6. Delivery Phases

### Phase 1: Critical Features (Week 1-2)
**Goal:** Core administrative improvements

1. **Orders - Import & Modify**
   - Schema updates (modificationHistory)
   - Import API and UI
   - Modify order form
   - Audit logging
   - Tests: import validation, order modification

2. **Gift Certificates - Import/Export**
   - Import/Export APIs
   - UI dialogs
   - Code generation
   - Tests: import validation, export format

3. **Locations - Progress Display & Verification**
   - SSE progress endpoint
   - Console UI component
   - Data verification script
   - Tests: fetch photos endpoint

**Deliverable:** Admin can import orders, modify existing orders, import/export gift certificates, see location photo fetch progress

### Phase 2: Integration Features (Week 3-4)
**Goal:** External system connections

4. **Events - Google Calendar Integration**
   - OAuth setup
   - Calendar sync logic
   - Manual CRUD
   - Event management UI
   - Tests: sync logic, CRUD operations

5. **Orders - Shipping & Documents**
   - Shopify shipping integration
   - Invoice/packing slip PDF generation
   - Enhanced sync UI
   - Tests: PDF generation, sync operations

6. **SEO - Global Config & Templates**
   - SeoConfiguration model
   - Settings page
   - Meta template system
   - Tests: template rendering

**Deliverable:** Calendar events sync, shipping labels can be generated, invoices/packing slips work, SEO templates configured

### Phase 3: Advanced Features (Week 5-6)
**Goal:** Advanced capabilities

7. **SEO - Structured Data & Analysis**
   - Schema.org generators
   - SEO analyzer
   - Robots.txt/Sitemap
   - Tests: schema validation, SEO scoring

8. **AI - Enhanced Training & Support**
   - Training categories
   - Domain-specific knowledge
   - Customer support tools
   - Function calling
   - Tests: query routing, function calls

9. **Events - Advanced Features**
   - "Where is Jose?" tracking
   - Homepage display controls
   - Event tagging
   - Tests: featured events query

**Deliverable:** Full SEO management, AI chatbot can handle support queries, events fully featured

### Phase 4: Analytics & Optimization (Week 7)
**Goal:** Insights and monitoring

10. **Notifications System**
    - Order notifications
    - In-app notification center
    - Email alerts
    - Tests: notification delivery

11. **SEO - Search Console**
    - GSC integration
    - Analytics dashboard
    - Tests: API integration

12. **AI - Analytics Dashboard**
    - Chat analytics
    - Knowledge gap detection
    - Performance metrics
    - Tests: analytics calculations

**Deliverable:** Full notification system, GSC integration, AI analytics dashboard

## 7. Verification Approach

### 7.1 Testing Strategy

#### Unit Tests
- All import/export functions
- PDF generators
- SEO analyzers
- AI function calling tools
- Template renderers

#### Integration Tests
- API endpoints
- Database transactions
- External API calls (mocked)
- Shopify sync
- Google Calendar sync

#### E2E Tests (Key Flows)
- Import orders workflow
- Apply gift certificate at checkout
- Generate shipping label
- Sync calendar events
- Chat with AI assistant

### 7.2 Verification Commands
```bash
# Before committing
npm run lint
npm run type-check
npm run test

# After implementation
npm run db:migrate
npm run build
```

### 7.3 Manual Testing Checklist
Per phase:
- [ ] All new UI pages render correctly
- [ ] Permissions enforced properly
- [ ] Audit logs created for sensitive operations
- [ ] Error states handled gracefully
- [ ] Loading states shown
- [ ] Mobile responsive
- [ ] Accessibility (keyboard nav, screen reader)

### 7.4 Performance Targets
- Page load: < 2s
- API response: < 500ms (simple), < 2s (complex like import)
- PDF generation: < 3s
- Real-time notifications: < 1s delay
- AI chat response: < 3s

### 7.5 Security Checklist
- [ ] All admin routes check permissions
- [ ] API keys encrypted in database
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all forms
- [ ] SQL injection prevention (Prisma handles)
- [ ] XSS prevention (React handles)
- [ ] CSRF tokens on mutations
- [ ] Audit logs for all modifications

## 8. Dependencies & Prerequisites

### 8.1 New NPM Packages
```json
{
  "pdf-lib": "^1.17.1",          // PDF generation
  "react-pdf": "^7.7.0",         // PDF preview
  "@react-pdf/renderer": "^3.1.0" // Alternative PDF
}
```

### 8.2 Environment Variables
```bash
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_ID=

# Shipping
SHIPSTATION_API_KEY=
SHIPPO_API_KEY=
USPS_USER_ID=

# Google Search Console
GOOGLE_SEARCH_CONSOLE_PROPERTY=
```

### 8.3 External Services Setup
1. Google Cloud Console
   - Enable Calendar API
   - Enable Search Console API
   - Create OAuth credentials
   
2. Shipping Providers
   - ShipStation account
   - Carrier accounts (USPS, UPS, FedEx)

3. Redis (optional, for caching)
   - For job queues
   - For progress tracking

### 8.4 Database Migrations
Migration files to create:
1. `add_seo_models` - SeoConfiguration, StructuredData
2. `add_notification_models` - Notification, OrderNotificationSetting
3. `add_chat_models` - ChatConversation, ChatMessage, TrainingDocumentCategory
4. `add_shipping_models` - ShippingProvider
5. `update_order_fields` - shippingLabelUrl, invoiceUrl, modificationHistory
6. `update_training_document` - categoryId, priority, domain, isEnabled

## 9. Rollback Strategy

### 9.1 Feature Flags
Implement feature flags for major features:
```typescript
const features = {
  ordersImport: true,
  shippingLabels: false, // Can disable if issues
  aiChatTools: false,
  gscIntegration: false,
}
```

### 9.2 Database Rollback
- All migrations reversible
- Backup database before Phase 1
- Test rollback locally

### 9.3 Gradual Rollout
1. Test in development
2. Deploy to staging
3. Beta test with 2-3 admin users
4. Full rollout

## 10. Success Criteria

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

---

**Document Version**: 1.0  
**Created**: December 16, 2025  
**Status**: Ready for Planning Phase
