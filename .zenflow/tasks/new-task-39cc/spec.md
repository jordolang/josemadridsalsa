# Technical Specification: Admin Panel Enhancements

## 1. Technical Context

### 1.1 Technology Stack
- **Framework**: Next.js 16.0.10 (App Router)
- **Language**: TypeScript 5.9.3 (strict mode)
- **Database**: PostgreSQL with Prisma ORM 6.19.0
- **Authentication**: NextAuth 4.24.11
- **Styling**: Tailwind CSS 3.4.18
- **UI Components**: Radix UI + custom components
- **Validation**: Zod 4.1.12
- **Testing**: Vitest 4.0.6

### 1.2 Existing Infrastructure
- **Admin Panel**: `/app/admin/` with layout and permissions
- **RBAC System**: `lib/rbac.ts` with Permission/RolePermission models
- **Audit Logging**: AuditLog model for tracking changes
- **Email System**: Resend + Nodemailer with template library
- **File Processing**: ExcelJS (CSV/Excel), PapaParse (CSV)
- **API Patterns**: `/app/api/admin/` with standardized responses
- **Shopify Integration**: `lib/shopify/` with sync and webhooks
- **Google APIs**: `googleapis` library (Calendar, Places)
- **Payment**: Stripe integration at `lib/stripe.ts`
- **AI/RAG**: `lib/ai-rag/` with indexer and retriever

### 1.3 Current Database Models (Relevant)
```typescript
// Existing models we'll extend:
- Order (with Shopify fields)
- GiftCertificate + GiftCertificateUsage
- RetailLocation
- FeaturedEvent + EventTag
- Tag (with EVENT type)
- TrainingDocument
- ServiceKey (encrypted storage)
- AuditLog
- Conversation + Message
- EmailTemplate + EmailConfiguration
```

## 2. Data Model Changes

### 2.1 New Models

#### 2.1.1 SEO Configuration
```prisma
model SeoConfiguration {
  id                  String   @id @default(cuid())
  
  // Global settings
  siteName            String
  siteDescription     String   @db.Text
  siteUrl             String
  defaultOgImage      String?
  twitterHandle       String?
  facebookAppId       String?
  
  // Meta templates
  productMetaTemplate String?
  recipeMetaTemplate  String?
  categoryMetaTemplate String?
  locationMetaTemplate String?
  
  // Robots & Sitemap
  robotsTxt           String?  @db.Text
  sitemapConfig       Json?    // Configuration for sitemap generation
  
  // Google Search Console
  gscPropertyUrl      String?
  gscVerified         Boolean  @default(false)
  gscLastSync         DateTime?
  
  // Organization schema
  organizationSchema  Json?
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@map("seo_configuration")
}
```

#### 2.1.2 Shipping Labels & Carriers
```prisma
model ShippingCarrier {
  id              String   @id @default(cuid())
  name            String   // "FedEx", "USPS", "UPS"
  code            String   @unique // "fedex", "usps", "ups"
  apiEndpoint     String?
  isActive        Boolean  @default(true)
  
  // Credentials stored in ServiceKey
  requiresAuth    Boolean  @default(true)
  
  config          Json?    // Carrier-specific config
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  labels          ShippingLabel[]
  
  @@map("shipping_carriers")
}

model ShippingLabel {
  id              String   @id @default(cuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id])
  
  carrierId       String
  carrier         ShippingCarrier @relation(fields: [carrierId], references: [id])
  
  trackingNumber  String
  labelUrl        String?  // PDF URL or base64
  cost            Decimal? @db.Decimal(10, 2)
  
  shipDate        DateTime?
  estimatedDelivery DateTime?
  
  // Raw API response
  carrierResponse Json?
  
  createdAt       DateTime @default(now())
  createdById     String?
  
  @@index([orderId])
  @@index([trackingNumber])
  @@map("shipping_labels")
}
```

#### 2.1.3 Third-Party Integrations
```prisma
model ThirdPartyIntegration {
  id              String   @id @default(cuid())
  name            String   // "ShipStation", "Shippo", etc.
  type            IntegrationType
  isActive        Boolean  @default(false)
  isConfigured    Boolean  @default(false)
  
  // Credentials in ServiceKey, referenced by service name
  
  config          Json?    // Integration-specific settings
  webhookUrl      String?
  
  lastSyncAt      DateTime?
  lastError       String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@map("third_party_integrations")
}

enum IntegrationType {
  SHIPPING
  FULFILLMENT
  INVENTORY
  MARKETING
  ANALYTICS
}
```

#### 2.1.4 Chat Conversations
```prisma
model ChatConversation {
  id                String   @id @default(cuid())
  
  // Optional user link
  userId            String?
  user              User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  // Session tracking
  sessionId         String?  @unique
  ipAddress         String?
  userAgent         String?
  
  // Conversation metadata
  status            ChatStatus @default(ACTIVE)
  escalatedAt       DateTime?
  escalatedToConversationId String? // Links to Conversation model
  
  satisfactionRating Int?    // 1-5 stars
  feedbackText      String?
  
  // Analytics
  messageCount      Int      @default(0)
  resolutionStatus  ResolutionStatus?
  primaryDomain     String?  // "orders", "products", "shipping", etc.
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  closedAt          DateTime?
  
  messages          ChatMessage[]
  
  @@index([userId])
  @@index([sessionId])
  @@index([status])
  @@index([createdAt])
  @@map("chat_conversations")
}

model ChatMessage {
  id              String   @id @default(cuid())
  conversationId  String
  conversation    ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  role            ChatRole // "user" or "assistant"
  content         String   @db.Text
  
  // Function calling metadata
  functionCalls   Json?    // Record of API calls made
  
  // Feedback
  helpful         Boolean?
  
  createdAt       DateTime @default(now())
  
  @@index([conversationId])
  @@map("chat_messages")
}

enum ChatStatus {
  ACTIVE
  ESCALATED
  CLOSED
  ABANDONED
}

enum ChatRole {
  USER
  ASSISTANT
}

enum ResolutionStatus {
  RESOLVED
  ESCALATED
  UNRESOLVED
  ABANDONED
}
```

#### 2.1.5 Order Notifications
```prisma
model OrderNotificationRule {
  id              String   @id @default(cuid())
  name            String
  
  // Trigger conditions
  triggerEvent    OrderNotificationEvent
  statusFilter    OrderStatus?
  minAmount       Decimal? @db.Decimal(10, 2)
  
  // Notification channels
  emailEnabled    Boolean  @default(true)
  emailTo         String[] // Recipient addresses
  
  // Optional Slack/SMS
  slackEnabled    Boolean  @default(false)
  slackWebhook    String?
  
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@map("order_notification_rules")
}

enum OrderNotificationEvent {
  ORDER_CREATED
  ORDER_PAID
  ORDER_SHIPPED
  ORDER_DELIVERED
  ORDER_CANCELLED
  ORDER_REFUNDED
  PAYMENT_FAILED
  HIGH_VALUE_ORDER
}
```

### 2.2 Model Extensions

#### Order Model
```prisma
// Add to existing Order model:
model Order {
  // ... existing fields ...
  
  // New relations
  shippingLabels  ShippingLabel[]
  printedInvoiceAt DateTime?
  printedPackingSlipAt DateTime?
  
  // Import metadata
  importSource    String?
  importBatchId   String?
  importedAt      DateTime?
}
```

#### FeaturedEvent Model
```prisma
// Add to existing FeaturedEvent model:
model FeaturedEvent {
  // ... existing fields ...
  
  // Manual override tracking
  manuallyModified Boolean @default(false)
  modifiedFields   Json?   // Track which fields were manually changed
  lastGoogleSync   DateTime?
  
  // Display priority
  displayPriority  Int     @default(0)
  
  // Admin who connected their calendar
  connectedByUserId String?
}
```

## 3. API Endpoints

### 3.1 Orders APIs

```typescript
// /app/api/admin/orders/import/route.ts
POST /api/admin/orders/import
  Body: FormData with CSV/Excel file
  Response: { imported: number, errors: ImportError[], preview: Order[] }

// /app/api/admin/orders/[id]/modify/route.ts
PATCH /api/admin/orders/[id]/modify
  Body: { items?, shippingAddress?, status?, adminNotes? }
  Response: { order: Order, syncedToShopify: boolean }

// /app/api/admin/orders/[id]/shipping-label/route.ts
POST /api/admin/orders/[id]/shipping-label
  Body: { carrierId: string, serviceType: string }
  Response: { label: ShippingLabel, labelUrl: string }

// /app/api/admin/orders/[id]/invoice/route.ts
GET /api/admin/orders/[id]/invoice?type=invoice|packing_slip
  Response: PDF file

// /app/api/admin/orders/batch-labels/route.ts
POST /api/admin/orders/batch-labels
  Body: { orderIds: string[], carrierId: string }
  Response: { labels: ShippingLabel[], zipUrl: string }

// /app/api/admin/orders/notifications/route.ts
GET /api/admin/orders/notifications (list rules)
POST /api/admin/orders/notifications (create rule)
PATCH /api/admin/orders/notifications/[id] (update rule)
DELETE /api/admin/orders/notifications/[id] (delete rule)
```

### 3.2 Gift Certificate APIs

```typescript
// /app/api/admin/gift-certificates/import/route.ts
POST /api/admin/gift-certificates/import
  Body: FormData with CSV/Excel file
  Response: { imported: number, errors: ImportError[] }

// /app/api/admin/gift-certificates/export/route.ts
GET /api/admin/gift-certificates/export?format=csv|xlsx&status=ACTIVE|ALL
  Response: File download

// /app/api/admin/gift-certificates/[id]/adjust-balance/route.ts
PATCH /api/admin/gift-certificates/[id]/adjust-balance
  Body: { amount: number, reason: string }
  Response: { giftCertificate: GiftCertificate }

// /app/api/admin/gift-certificates/[id]/resend/route.ts
POST /api/admin/gift-certificates/[id]/resend
  Response: { sent: boolean }
```

### 3.3 Locations APIs

```typescript
// /app/api/admin/locations/fetch-photos/route.ts (existing, enhance)
POST /api/admin/locations/fetch-photos
  Body: { force?: boolean, locationIds?: string[] }
  Response: Server-Sent Events stream
  
// /app/api/admin/locations/import/route.ts
POST /api/admin/locations/import
  Body: FormData with CSV file
  Response: { imported: number, updated: number, errors: ImportError[] }

// /app/api/admin/locations/export/route.ts
GET /api/admin/locations/export
  Response: CSV file

// /app/api/admin/locations/[id]/geocode/route.ts
POST /app/api/admin/locations/[id]/geocode
  Response: { location: RetailLocation, coordinates: { lat, lng } }
```

### 3.4 Events & Calendar APIs

```typescript
// /app/api/auth/google-oauth/route.ts
GET /api/auth/google-oauth?redirect=/admin/events
  Response: Redirect to Google OAuth consent

// /app/api/admin/events/calendar-sync/route.ts
POST /api/admin/events/calendar-sync
  Body: { forceRefresh?: boolean }
  Response: { synced: number, created: number, updated: number }

// /app/api/admin/events/route.ts
GET /api/admin/events (list with filters)
POST /api/admin/events (create manual event)

// /app/api/admin/events/[id]/route.ts
GET /api/admin/events/[id]
PATCH /api/admin/events/[id] (update/override)
DELETE /api/admin/events/[id]

// /app/api/admin/events/[id]/revert/route.ts
POST /api/admin/events/[id]/revert
  Response: { event: FeaturedEvent } // Revert to Google Calendar data
```

### 3.5 SEO APIs

```typescript
// /app/api/admin/seo/configuration/route.ts
GET /api/admin/seo/configuration
POST /api/admin/seo/configuration
PATCH /api/admin/seo/configuration

// /app/api/admin/seo/analyze/route.ts
POST /api/admin/seo/analyze
  Body: { url: string, type: "product"|"recipe"|"page" }
  Response: { score: number, recommendations: Recommendation[] }

// /app/api/admin/seo/search-console/route.ts
GET /api/admin/seo/search-console/metrics?startDate=...&endDate=...
  Response: { clicks, impressions, ctr, position, queries, pages }

// /app/api/admin/seo/sitemap/generate/route.ts
POST /api/admin/seo/sitemap/generate
  Response: { success: boolean, url: "/sitemap.xml" }

// /app/api/admin/seo/robots/route.ts
GET /api/admin/seo/robots
POST /api/admin/seo/robots
  Body: { content: string }
```

### 3.6 AI Training & Chat APIs

```typescript
// /app/api/admin/training-data/categories/route.ts (new)
GET /api/admin/training-data/categories
POST /api/admin/training-data/categories
  Body: { name: string, priority: number }

// /app/api/admin/training-data/[id]/enable/route.ts
POST /api/admin/training-data/[id]/enable
POST /api/admin/training-data/[id]/disable

// /app/api/ai-chat/route.ts (existing, enhance)
POST /api/ai-chat
  Body: { message: string, conversationId?: string, sessionId?: string }
  Response: { response: string, conversationId: string, canEscalate: boolean }

// /app/api/ai-chat/[id]/escalate/route.ts (new)
POST /api/ai-chat/[id]/escalate
  Body: { email: string, subject: string, message: string }
  Response: { conversation: Conversation, escalated: boolean }

// /app/api/admin/chat-analytics/route.ts
GET /api/admin/chat-analytics?startDate=...&endDate=...
  Response: { metrics: ChatMetrics, topQueries: Query[] }

// /app/api/admin/chat-conversations/route.ts
GET /api/admin/chat-conversations (list with filters)
GET /api/admin/chat-conversations/[id] (detail with messages)
GET /api/admin/chat-conversations/export (CSV export)
```

## 4. Implementation Approach

### 4.1 Orders Management

**Import Orders**:
- Reuse `papaparse` (already installed) for CSV parsing
- Reuse `exceljs` (already installed) for Excel parsing
- Follow pattern from `/app/api/admin/products/import/` (if exists)
- Validation: Zod schemas for order import data
- Auto-generate order numbers using existing pattern
- Shopify sync: Call `queueShopifySync()` from `lib/shopify/sync.ts`

**Modify Orders**:
- Admin page: `/app/admin/orders/[id]/edit/page.tsx`
- Reuse order modification patterns
- Audit logging: Call `lib/audit.ts` createAuditLog()
- Permission check: `hasPermission(user, 'orders:write')`
- Shopify sync: Update Shopify order via Admin API

**Shipping Labels**:
- Create `lib/shipping/` directory with carriers
  - `lib/shipping/fedex.ts`
  - `lib/shipping/usps.ts`
  - `lib/shipping/ups.ts`
  - `lib/shipping/base-carrier.ts` (interface)
- Store carrier credentials in ServiceKey model (already exists)
- PDF generation: Use existing PDF library or add `pdfkit`
- Follow pattern from Stripe integration for external APIs

**Notifications**:
- Email: Reuse `lib/email/automation.ts` patterns
- Real-time: Consider Server-Sent Events for admin dashboard
- Webhook pattern: Similar to `/app/api/webhooks/shopify/`

### 4.2 Gift Certificates

**Import/Export**:
- Import: Similar to order import flow
- Export: Use `exceljs` to generate Excel files
- Page: `/app/admin/gift-certificates/` (already exists, add buttons)

**Frontend Checkout Integration**:
- Existing: `/app/gift-certificates/purchase/` 
- Add to checkout flow: `/app/checkout/` 
- Stripe payment: Integrate with existing Stripe setup
- Apply at checkout: Validate code, check balance, create usage record

### 4.3 Locations

**Photo Fetch Progress**:
- Convert `/api/admin/locations/fetch-photos` to Server-Sent Events
- Frontend: Use EventSource API
- Display progress in modal with live updates
- Pattern:
  ```typescript
  export async function POST(req: Request) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const location of locations) {
          // Fetch photo
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ progress, location })}\n\n`));
        }
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  }
  ```

**Verify 149 Locations**:
- Script: `npm run locations:verify` (new script)
- Check database count: `prisma.retailLocation.count()`
- If < 149: Run `npm run locations:import`
- Validation script in `scripts/verify-locations.ts`

**Backend-Frontend Parity**:
- Shared hook: `hooks/useLocations.ts` (already exists)
- Same API endpoint for both admin and frontend
- Cache with `swr` or React Query
- Admin page uses same data with additional fields

### 4.4 Events & Calendar

**Google OAuth**:
- Add Google provider to NextAuth: `/app/api/auth/[...nextauth]/route.ts`
- Scopes: `calendar.readonly`, `calendar.events`, `webmasters.readonly`
- Store tokens in ServiceKey model
- Migration: Remove service account, use OAuth tokens

**Calendar Sync**:
- Cron job: Use Next.js cron or Vercel Cron
- Sync frequency: Every 15 minutes
- Upsert logic: Match by `googleEventId`
- Track `manuallyModified` flag - skip overwriting modified fields
- Service: `lib/google-calendar-sync.ts` (new)

**Manual Editing**:
- Form: `/app/admin/events/[id]/edit/page.tsx`
- On save: Set `manuallyModified = true`, store `modifiedFields`
- Revert button: Clear `manuallyModified`, re-sync from Google

### 4.5 SEO

**Global Configuration**:
- New model: SeoConfiguration (single row)
- Admin page: `/app/admin/seo/configuration/page.tsx`
- Form with all global settings
- Store in database, retrieve on build/request

**Meta Templates**:
- Template string with variables: `{product_name}`, `{category}`, etc.
- Parsing function in `lib/seo/meta-templates.ts`
- Apply templates in `lib/metadata.ts` (existing)

**Schema.org**:
- JSON-LD generation: `lib/seo/schema-generator.ts`
- Auto-generate for products/recipes/locations/events
- Insert in page head via metadata
- Editor UI for organization schema

**Robots & Sitemap**:
- Next.js native: `app/robots.ts` and `app/sitemap.ts`
- Read config from SeoConfiguration
- Dynamic sitemap: Query all products, recipes, locations, events
- Cache: Revalidate on content changes

**Google Search Console**:
- API client: `googleapis` (already installed)
- OAuth: Same flow as Calendar
- Metrics endpoint: Call Search Console API
- Dashboard: Charts with metrics (use existing chart library if any)

### 4.6 AI Training & Chatbot

**Enhanced Training**:
- Add `category` field to TrainingDocument
- Add `priority` and `isEnabled` fields
- Admin UI: Organize by category with tabs
- Bulk operations: Multi-select with actions

**Customer Support & Escalation**:
- Escalate button in chat widget
- Create Conversation record (existing model)
- Link ChatConversation to Conversation via `escalatedToConversationId`
- Email notification to admin support email
- Admin messaging page: Show escalated chats

**Chat Log Storage**:
- ChatConversation and ChatMessage models (defined above)
- Store every message exchange
- Session tracking via `sessionId` (generate on first message)
- Backup: Database backups (existing infrastructure)
- Export: CSV endpoint for conversations

**Analytics**:
- Dashboard page: `/app/admin/chat-analytics/page.tsx`
- Aggregation queries on ChatConversation
- Charts: Total conversations, resolution rate, avg response time
- Common queries: Group by message content similarity

**Privacy Protections**:
- Remove order lookup functions from RAG system
- Remove customer account functions
- Gift certificate lookup: Public API (no auth required)
- Clear messaging: "I can't access order details, but I can help with..."
- Escalation CTA: "Would you like to speak with a human?"

## 5. Source Code Structure Changes

```
/app
  /admin
    /orders
      /[id]
        /edit
          page.tsx (new - modify order)
        /invoice
          page.tsx (new - print invoice/packing slip)
        /shipping-label
          page.tsx (new - generate label)
      /import
        page.tsx (new - import orders)
      /notifications
        page.tsx (new - notification rules)
    /gift-certificates
      /import
        page.tsx (new)
      /export
        page.tsx (new)
    /locations
      /_components
        FetchPhotosButton.tsx (enhance with progress)
      /import
        page.tsx (new)
    /events
      page.tsx (replace placeholder)
      /[id]
        /edit
          page.tsx (new)
      /new
        page.tsx (new)
      /google-connect
        page.tsx (new - OAuth flow)
    /seo
      page.tsx (replace placeholder)
      /configuration
        page.tsx (new)
      /analysis
        page.tsx (new)
      /robots
        page.tsx (new)
      /search-console
        page.tsx (new)
    /chat-analytics
      page.tsx (new)
    /chat-conversations
      page.tsx (new)
      /[id]
        page.tsx (new - conversation detail)
  /api
    /admin
      /orders
        /import (new)
        /[id]
          /modify (new)
          /shipping-label (new)
          /invoice (new)
        /batch-labels (new)
        /notifications (new)
      /gift-certificates
        /import (new)
        /export (new)
        /[id]
          /adjust-balance (new)
          /resend (new)
      /locations
        /fetch-photos (enhance)
        /import (new)
        /export (new)
        /[id]
          /geocode (new)
      /events
        /calendar-sync (new)
        /[id]
          /revert (new)
      /seo
        /configuration (new)
        /analyze (new)
        /search-console (new)
        /sitemap (new)
        /robots (new)
      /training-data
        /categories (new)
        /[id]
          /enable (new)
          /disable (new)
      /chat-analytics (new)
      /chat-conversations (new)
        /[id] (new)
        /export (new)
    /ai-chat
      /[id]
        /escalate (new)
    /auth
      /google-oauth (new)
  /checkout
    (enhance to support gift certificates)
  robots.ts (new)
  sitemap.ts (new)

/lib
  /shipping (new directory)
    base-carrier.ts
    fedex.ts
    usps.ts
    ups.ts
    label-generator.ts
  /seo (new directory)
    meta-templates.ts
    schema-generator.ts
    analyzer.ts
  /google-calendar-sync.ts (new)
  /google-search-console.ts (new)
  /ai-rag
    indexer.ts (enhance with categories)
    retriever.ts (enhance with priority)
  /pdf (new directory)
    invoice-generator.ts
    packing-slip-generator.ts

/components
  /admin
    /orders
      OrderImportForm.tsx (new)
      OrderEditForm.tsx (new)
      ShippingLabelDialog.tsx (new)
      NotificationRuleForm.tsx (new)
    /gift-certificates
      GiftCertificateImportForm.tsx (new)
    /locations
      LocationImportForm.tsx (new)
      PhotoProgressModal.tsx (new)
    /events
      EventForm.tsx (new)
      CalendarSyncStatus.tsx (new)
      GoogleConnectButton.tsx (new)
    /seo
      SeoConfigForm.tsx (new)
      MetaTemplateEditor.tsx (new)
      SchemaEditor.tsx (new)
      RobotsEditor.tsx (new)
      SeoAnalysisPanel.tsx (new)
    /chat
      ChatAnalyticsDashboard.tsx (new)
      ConversationList.tsx (new)
  /chat
    ai-chat-widget.tsx (enhance with escalation)
  /checkout
    GiftCertificateInput.tsx (new)

/scripts
  verify-locations.ts (new)
  sync-google-calendar.ts (new - for cron)

/prisma
  /migrations
    /[timestamp]_shipping_carriers (new)
    /[timestamp]_chat_conversations (new)
    /[timestamp]_seo_configuration (new)
    /[timestamp]_order_notifications (new)
    /[timestamp]_third_party_integrations (new)
    /[timestamp]_featured_event_enhancements (new)
```

## 6. Delivery Phases

### Phase 1: Orders Core (Week 1-2)
**Goal**: Import, modify, Shopify sync enhancements

**Tasks**:
1. Database migrations: Add Order extensions, ShippingLabel model
2. API: Import orders endpoint
3. API: Modify orders endpoint
4. Admin UI: Import page with preview
5. Admin UI: Order edit page
6. Shopify sync: Enhance sync logic for imports/modifications
7. Testing: Import CSV/Excel, modify orders, verify Shopify sync

**Deliverables**:
- Order import functional (CSV/Excel)
- Order modification functional
- Bi-directional Shopify sync working
- Tests passing

### Phase 2: Gift Certificates & Locations (Week 2-3)
**Goal**: Gift certificate management, location data verification

**Tasks**:
1. API: Gift certificate import/export endpoints
2. Admin UI: Import/export buttons and forms
3. Checkout: Gift certificate application flow
4. Locations: Server-Sent Events for photo fetch
5. Admin UI: Photo fetch progress modal
6. Script: Verify and import 149 locations
7. Locations: Import/export endpoints and UI

**Deliverables**:
- Gift certificate import/export working
- Gift certificates usable at checkout
- Location photo fetch with progress display
- All 149 locations verified in database
- Location import/export functional

### Phase 3: Shipping & Notifications (Week 3-4)
**Goal**: Shipping labels, invoices, order notifications

**Tasks**:
1. Database migrations: ShippingCarrier, OrderNotificationRule
2. Lib: Shipping carrier integrations (FedEx, USPS, UPS)
3. API: Shipping label endpoints
4. API: Invoice/packing slip PDF generation
5. Admin UI: Shipping label pages
6. API: Notification rules CRUD
7. Admin UI: Notification rules management
8. Email: Order notification automation

**Deliverables**:
- Shipping labels generated via carriers
- Invoices and packing slips printable
- Order notifications configured and working
- Tests for shipping and PDF generation

### Phase 4: Events & Calendar (Week 4-5)
**Goal**: Google OAuth, calendar sync, event management

**Tasks**:
1. Database migrations: FeaturedEvent enhancements
2. NextAuth: Add Google OAuth provider
3. API: Google OAuth flow
4. API: Calendar sync endpoint
5. Lib: Calendar sync service with cron
6. Admin UI: Google connection page
7. Admin UI: Events CRUD pages
8. Admin UI: "Where is Jose?" filtering
9. Frontend: Homepage event display

**Deliverables**:
- Google OAuth functional
- Calendar auto-sync every 15 minutes
- Manual event creation/editing working
- Synced events can be manually overridden
- "Where is Jose?" events display correctly

### Phase 5: SEO Management (Week 5-6)
**Goal**: SEO configuration, templates, Search Console

**Tasks**:
1. Database migrations: SeoConfiguration model
2. API: SEO configuration CRUD
3. API: Google Search Console integration
4. Lib: Meta template parser
5. Lib: Schema.org generator
6. Lib: SEO analyzer
7. Admin UI: SEO configuration page
8. Admin UI: Meta template editor
9. Admin UI: Search Console dashboard
10. Next.js: robots.ts and sitemap.ts

**Deliverables**:
- Global SEO settings configurable
- Meta templates working
- Schema.org markup auto-generated
- Robots.txt and sitemap.xml functional
- Search Console data displayed

### Phase 6: AI Enhancements (Week 6-7)
**Goal**: Chat logging, escalation, analytics, privacy controls

**Tasks**:
1. Database migrations: ChatConversation, ChatMessage
2. API: Chat logging (modify existing /api/ai-chat)
3. API: Escalation endpoint
4. API: Chat analytics endpoints
5. Lib: Remove PII access from RAG system
6. Admin UI: Chat analytics dashboard
7. Admin UI: Conversation viewer
8. Frontend: Escalation button in chat widget
9. Email: Escalation notifications

**Deliverables**:
- All chat logs stored and backed up
- Escalation to human support working
- Chat analytics dashboard functional
- No PII access (verified)
- Conversation export working

### Phase 7: Testing & Polish (Week 7)
**Goal**: Integration testing, bug fixes, documentation

**Tasks**:
1. Integration tests for all major flows
2. E2E tests for critical paths
3. Performance optimization
4. Bug fixes
5. Admin user documentation
6. API documentation
7. Deployment preparation

**Deliverables**:
- All tests passing
- Performance benchmarks met
- Documentation complete
- Ready for deployment

## 7. Verification Approach

### 7.1 Automated Testing

**Unit Tests** (`npx vitest run`):
- `tests/order-import.test.ts`: CSV/Excel parsing, validation, import logic
- `tests/gift-certificate.test.ts`: Balance calculations, usage tracking
- `tests/shipping-carriers.test.ts`: Label generation, carrier API mocking
- `tests/seo-templates.test.ts`: Template parsing, variable substitution
- `tests/chat-escalation.test.ts`: Escalation logic, conversation linking

**Integration Tests**:
- `tests/api/orders/import.test.ts`: Full import flow
- `tests/api/events/calendar-sync.test.ts`: Google Calendar sync
- `tests/api/seo/search-console.test.ts`: GSC API integration
- `tests/api/chat/escalate.test.ts`: Chat escalation flow

**E2E Tests** (add if framework available):
- Order import -> Shopify sync -> verification
- Gift certificate purchase -> checkout application -> usage
- Event creation -> Google sync -> homepage display
- Chat conversation -> escalation -> admin notification

### 7.2 Manual Testing Checklist

**Orders**:
- [ ] Import CSV with valid orders
- [ ] Import Excel with validation errors
- [ ] Modify order and verify Shopify sync
- [ ] Generate shipping label for all carriers
- [ ] Print invoice and packing slip
- [ ] Test order notifications for each trigger

**Gift Certificates**:
- [ ] Import gift certificates from CSV
- [ ] Export gift certificates to Excel
- [ ] Purchase gift certificate on frontend
- [ ] Apply gift certificate at checkout
- [ ] Verify balance updates

**Locations**:
- [ ] Fetch photos with progress display
- [ ] Verify 149 locations in database
- [ ] Import locations from CSV
- [ ] Export locations to CSV
- [ ] Edit location and verify frontend update

**Events**:
- [ ] Connect Google Calendar via OAuth
- [ ] Sync events from Google
- [ ] Manually create event
- [ ] Edit synced event (verify manual override)
- [ ] Mark event as "Where is Jose?"
- [ ] Verify homepage event display

**SEO**:
- [ ] Configure global SEO settings
- [ ] Create meta templates
- [ ] Analyze page SEO score
- [ ] Edit robots.txt
- [ ] View Search Console metrics
- [ ] Verify schema.org markup

**AI/Chat**:
- [ ] Start chat conversation
- [ ] Escalate to human support
- [ ] View chat analytics
- [ ] Export conversation logs
- [ ] Verify no PII access

### 7.3 Code Quality

**Linting** (`npm run lint`):
- ESLint with Next.js and Tailwind rules
- No errors or warnings

**Type Checking** (`npm run type-check`):
- TypeScript strict mode
- No type errors

**Build** (`npm run build`):
- Production build successful
- No build warnings

### 7.4 Performance Benchmarks

- Order import: 1000 orders in < 30 seconds
- Photo fetch: 149 locations in < 5 minutes (with rate limiting)
- Calendar sync: < 10 seconds for 100 events
- Shipping label: < 5 seconds per label
- PDF generation: < 2 seconds per invoice
- Chat response: < 3 seconds average
- SEO analysis: < 5 seconds per page
- Page load: < 2 seconds for all admin pages

### 7.5 Security Verification

- [ ] All admin endpoints require authentication
- [ ] RBAC permissions checked on all sensitive operations
- [ ] ServiceKey encryption working for API credentials
- [ ] No PII exposed in chat logs exports
- [ ] SQL injection protection (Prisma parameterized queries)
- [ ] XSS protection (React escaping)
- [ ] CSRF protection (NextAuth)
- [ ] Rate limiting on API endpoints
- [ ] Audit logs for all data modifications

## 8. Dependencies & Libraries

### 8.1 New Dependencies (to install)

```json
{
  "dependencies": {
    "pdfkit": "^0.13.0", // PDF generation
    "@react-pdf/renderer": "^3.1.0", // Alternative PDF approach
    "react-query": "^3.39.0", // Optional: Better data fetching
    "date-fns-tz": "^2.0.0" // Timezone handling for events
  },
  "devDependencies": {
    "@types/pdfkit": "^0.13.0"
  }
}
```

### 8.2 Existing Dependencies (already installed)

- `exceljs`: CSV/Excel import/export
- `papaparse`: CSV parsing
- `googleapis`: Google Calendar, Search Console, Places
- `stripe`: Payment processing
- `zod`: Validation
- `next-auth`: Authentication with OAuth
- `framer-motion`: Animations
- `lucide-react`: Icons

## 9. Deployment Considerations

### 9.1 Environment Variables

```bash
# Shipping Carriers
FEDEX_API_KEY=
FEDEX_API_SECRET=
USPS_API_KEY=
UPS_API_KEY=
UPS_API_SECRET=

# Google OAuth (update existing)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# OpenAI (existing)
OPENAI_API_KEY=

# Shopify (existing)
SHOPIFY_STORE_DOMAIN=
SHOPIFY_ADMIN_API_TOKEN=

# Database (existing)
DATABASE_URL=

# NextAuth (existing)
NEXTAUTH_URL=
NEXTAUTH_SECRET=
```

### 9.2 Database Migrations

- Run migrations in sequence during deployment
- Backup database before migrations
- Test migrations in staging first
- Plan for zero-downtime deployment

### 9.3 Cron Jobs

- Calendar sync: Every 15 minutes
- Chat analytics aggregation: Daily at midnight
- Sitemap regeneration: Daily at 2 AM
- Location photo updates: Weekly on Sunday

### 9.4 Monitoring & Logging

- API endpoint performance monitoring
- Error tracking for carrier integrations
- Google API quota monitoring
- OpenAI token usage tracking
- Chat escalation notifications

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Shipping carrier API rate limits | High | Medium | Implement rate limiting, queue system |
| Google API quota exceeded | High | Low | Monitor usage, implement caching |
| Large file imports timeout | Medium | Medium | Implement chunked processing, progress tracking |
| Shopify sync conflicts | High | Medium | Add conflict resolution logic, manual review UI |
| OpenAI cost overruns | High | Low | Implement token budgeting, rate limiting |
| Data migration failures | High | Low | Extensive testing, rollback procedures |
| OAuth token expiration | Medium | Medium | Automatic refresh, clear user messaging |

## 11. Success Criteria

- All automated tests passing
- All manual test cases verified
- Performance benchmarks met
- Security audit passed
- Code review approved
- Documentation complete
- Staging deployment successful
- User acceptance testing passed

---

**Document Version**: 1.0  
**Last Updated**: December 16, 2025  
**Status**: Ready for Review
