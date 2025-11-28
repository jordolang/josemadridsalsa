# 🌶️ Jose Madrid Salsa - E-Commerce Platform

![Jose Madrid Salsa Website](public/images/Opengraph/main-page.png)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748.svg)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Modern, full-featured e-commerce platform for Jose Madrid Salsa with comprehensive admin panel, fundraising system, wholesale management, and multi-channel capabilities.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Core Features](#-core-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [AI Chatbot Training](#-ai-chatbot-training)
- [Admin Panel](#-admin-panel)
- [Customer Features](#-customer-features)
- [Business Systems](#-business-systems)
- [API Documentation](#-api-documentation)
- [Security & Authentication](#-security--authentication)
- [Integrations](#-integrations)
- [Development](#-development)
- [Deployment](#-deployment)
- [Future Roadmap](#-future-roadmap)
- [Contributing](#-contributing)

---

## 🎯 Overview

Jose Madrid Salsa's e-commerce platform is a production-ready, enterprise-grade web application built with Next.js 15, TypeScript, and modern web technologies. It supports B2C retail, B2B wholesale, fundraising campaigns, gift certificates, and comprehensive business management tools.

**Current Status:** Phase 4 Complete (85% Overall) - Production Ready  
**Lines of Code:** 10,000+  
**Database Models:** 40+  
**API Endpoints:** 80+

---

## ✨ Core Features

### 🛒 E-Commerce
- **27 Premium Salsa Products** - All correctly priced with real images
- **Product Catalog** - Organized by heat level (Mild, Medium, Hot, Extra Hot, Gourmet)
- **Shopping Cart** - Real-time updates with inventory validation
- **Secure Checkout** - Stripe integration with PCI compliance
- **Guest Checkout** - Optional user authentication
- **Order Tracking** - Complete lifecycle management
- **Product Reviews** - Customer feedback and ratings
- **Search & Filter** - Advanced product discovery
- **Wishlist** - Save favorites for later

### 👤 Customer Account System
- **User Registration** - Email/password with validation
- **Google OAuth** - One-click social sign-in
- **Account Dashboard** - Order history and profile management
- **Address Book** - Manage shipping and billing addresses
- **Order History** - Full order details with reorder functionality
- **Password Management** - Secure password reset flow
- **Profile Settings** - Update personal information

### 🎁 Gift Certificates
- **Digital Gift Cards** - Instant delivery via email
- **Custom Amounts** - Flexible pricing options
- **Balance Checking** - Real-time balance lookup
- **Redemption** - Apply at checkout
- **Design Customization** - Multiple templates

### 🤝 Fundraising System
- **Campaign Management** - Create and track fundraisers
- **Commission Tracking** - Automatic calculation and reporting
- **Organization Profiles** - Dedicated pages for each group
- **Goal Tracking** - Visual progress indicators
- **Revenue Reports** - Detailed financial breakdowns
- **Product Assignment** - Custom product selection per campaign

### 🏢 Wholesale Management
- **Application System** - Business verification workflow
- **Approval Process** - Admin review and approval
- **Tiered Pricing** - Volume-based discounts
- **Minimum Orders** - Configurable thresholds
- **Business Types** - Retail, Restaurant, Distributor, Online Store
- **Account Status** - Pending, Approved, Rejected, Suspended

---

## 🔧 Tech Stack

### Core Framework
- **Next.js 15** - App Router with RSC (React Server Components)
- **React 19** - Latest stable with concurrent features
- **TypeScript 5.9** - Full type safety across codebase

### Database & ORM
- **PostgreSQL** - Production database
- **Prisma 6.19** - Type-safe database client
- **Prisma Accelerate** - Connection pooling and caching
- **Prisma Optimize** - Query performance monitoring

### Styling & UI
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icon library
- **CSS Variables** - Dynamic theming support

### Authentication & Security
- **NextAuth.js 4.24** - Complete auth solution
- **bcryptjs** - Password hashing (10 rounds)
- **AES-256-GCM** - Encryption for sensitive data
- **JWT Sessions** - Secure token-based auth
- **RBAC System** - Role-based access control

### Payment Processing
- **Stripe** - Payment gateway and webhooks
- **Stripe Elements** - PCI-compliant card forms
- **Payment Intents** - Secure payment processing

### Forms & Validation
- **React Hook Form** - Performant form management
- **Zod 4.1** - Schema validation
- **@hookform/resolvers** - Validation integration

### Email & Communication
- **Resend** - Transactional email delivery
- **Email Templates** - Dynamic template system
- **Messaging System** - Customer support chat

### File Management
- **ExcelJS** - CSV/Excel export
- **Cheerio** - HTML parsing and scraping
- **Mammoth** - Word document processing
- **PDF Parse** - PDF content extraction

### Google Integrations
- **Google APIs** - Calendar, Places, Reviews
- **Google OAuth** - Social authentication
- **Google Business Profile** - Location management

### Development Tools
- **TypeScript ESLint** - Code quality
- **Vitest** - Unit testing framework
- **Vercel CLI** - Deployment and preview
- **tsx** - TypeScript execution
- **Turbo** - Fast development mode

---

## 📁 Project Structure

```
josemadridsalsa/
├── app/                          # Next.js App Router
│   ├── admin/                    # Admin panel (85% complete)
│   │   ├── analytics/            # Business analytics dashboard
│   │   ├── audit-logs/           # System activity tracking
│   │   ├── categories/           # Product category management
│   │   ├── events/               # Event management (UI ready)
│   │   ├── financials/           # Financial reports
│   │   ├── form-templates/       # Custom form builder
│   │   ├── fundraisers/          # Fundraising campaigns
│   │   ├── gift-certificates/    # Gift card management
│   │   ├── media/                # Media library
│   │   ├── merchandise/          # Merch catalog (UI ready)
│   │   ├── messages/             # Customer messaging
│   │   ├── orders/               # Order management
│   │   ├── products/             # Product CRUD
│   │   ├── recipes/              # Recipe CMS
│   │   ├── seo/                  # SEO manager (UI ready)
│   │   ├── settings/             # System configuration
│   │   ├── social/               # Social media posting
│   │   ├── tags/                 # Universal tagging
│   │   ├── users/                # User management
│   │   └── wholesale/            # B2B accounts
│   ├── account/                  # Customer account
│   │   ├── addresses/            # Address book
│   │   ├── orders/               # Order history
│   │   └── settings/             # Profile settings
│   ├── api/                      # API routes (80+ endpoints)
│   │   ├── admin/                # Admin APIs
│   │   ├── auth/                 # Authentication
│   │   ├── checkout/             # Cart and checkout
│   │   ├── gift-certificates/    # Gift card APIs
│   │   ├── locations/            # Store locator
│   │   ├── messages/             # Messaging APIs
│   │   ├── products/             # Product catalog
│   │   ├── recipes/              # Recipe APIs
│   │   └── webhooks/             # External integrations
│   ├── auth/                     # Auth pages
│   │   ├── forgot-password/      # Password reset request
│   │   ├── reset-password/       # Password reset form
│   │   ├── signin/               # Sign-in page
│   │   └── signup/               # Registration page
│   ├── cart/                     # Shopping cart
│   ├── checkout/                 # Checkout flow
│   ├── find-us/                  # Store locator
│   ├── forms/                    # Public forms
│   ├── fundraise/                # Fundraiser info
│   ├── gift-certificates/        # Gift card purchase
│   ├── merchandise/              # Merch storefront
│   ├── our-story/                # About page
│   ├── products/                 # Product listings
│   ├── recipes/                  # Recipe catalog
│   ├── salsas/                   # Salsa products
│   ├── wholesale/                # B2B application
│   └── layout.tsx                # Root layout
├── components/                   # React components
│   ├── account/                  # Account-related components
│   ├── admin/                    # Admin panel components
│   ├── analytics/                # Analytics widgets
│   ├── chat/                     # AI chat interface
│   ├── forms/                    # Form components
│   ├── messaging/                # Messaging widgets
│   ├── store/                    # Storefront components
│   └── ui/                       # shadcn/ui primitives
├── docs/                         # Documentation
│   ├── PHASE_0_COMPLETE.md       # Foundation complete
│   ├── PHASE_1_COMPLETE.md       # Core admin complete
│   ├── phase2-complete.md        # Content management complete
│   ├── phase3-complete.md        # User management complete
│   ├── phase4-complete.md        # Store management complete
│   ├── PROJECT_STATUS.md         # Current status
│   ├── ADMIN_LOGIN_GUIDE.md      # Admin setup guide
│   ├── AUTH_FIX_SUMMARY.md       # Authentication details
│   ├── STRIPE_WEBHOOK_SETUP.md   # Payment integration
│   ├── GOOGLE_REVIEWS_SETUP.md   # Google integration
│   └── NEXT_STEPS_AUTOMATION.md  # Future plans
├── lib/                          # Utility libraries
│   ├── api.ts                    # API helpers
│   ├── audit.ts                  # Audit logging
│   ├── auth.ts                   # Auth configuration
│   ├── crypto.ts                 # Encryption utilities
│   ├── prisma.ts                 # Database client
│   ├── rbac.ts                   # Access control
│   ├── stripe.ts                 # Payment processing
│   └── permissions-map.ts        # Permission config
├── prisma/                       # Database
│   ├── schema.prisma             # Database schema (40+ models)
│   ├── seed.ts                   # Database seeding
│   ├── seed.permissions.ts       # Permission seeding
│   └── seeds/                    # Seed data files
├── public/                       # Static assets
│   ├── images/                   # Product images
│   └── docs/                     # Public documentation
├── scripts/                      # Automation scripts
│   ├── create-admin.ts           # Create admin user
│   ├── import-locations-from-markdown.ts
│   ├── scrape-products.py        # Product data scraping
│   └── sync-findus.js            # Location sync
├── tests/                        # Test suites
│   └── crypto.test.ts            # Encryption tests
├── types/                        # TypeScript types
│   └── next-auth.d.ts            # Auth type extensions
├── .plans/                       # Feature plans
│   ├── find-us-future-enhancements.md
│   ├── form-template-owner-fields.md
│   └── form-template-rest-endpoints.md
├── AGENTS.md                     # Development guidelines
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── tailwind.config.ts            # Tailwind config
└── next.config.js                # Next.js config
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 8+ or **pnpm** 8+
- **PostgreSQL** 14+ database
- **Git** for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jordolang/josemadridsalsa.git
   cd josemadridsalsa
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment** (see [Environment Variables](#environment-variables))

5. **Set up database**
   ```bash
   npm run db:push
   npm run db:seed
   ```

6. **Create admin user**
   ```bash
   npm run create-admin
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```

8. **Open browser**
   Navigate to `http://localhost:3000`

### Environment Variables

Create `.env.local` with the following:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/josemadrid"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (Resend)
RESEND_API_KEY="re_..."

# Encryption
MASTER_KEY="your-64-character-hex-key"

# Google APIs
GOOGLE_PLACES_API_KEY="your-google-places-key"
GOOGLE_CALENDAR_API_KEY="your-google-calendar-key"

# Optional
NEXT_PUBLIC_MAPBOX_TOKEN="your-mapbox-token"
```

Generate `MASTER_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🤖 AI Chatbot Training

The platform includes an AI-powered customer support chatbot with RAG (Retrieval Augmented Generation) that learns from your business content.

### How It Works

The chatbot automatically indexes content from:
- ✅ All products, recipes, and locations from the database
- ✅ Markdown files in the `/public` folder
- ✅ Custom training documents uploaded via admin panel
- ✅ URLs scraped and indexed

When customers ask questions, the AI retrieves relevant information and provides accurate, context-aware responses.

### Quick Setup

1. **Set OpenAI API Key**
   ```bash
   # Add to .env.local
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```

2. **Access Training Admin**
   ```
   http://localhost:3000/admin/training-data
   ```

3. **Upload Training Documents**
   - Drag and drop files (markdown, PDF, Word, CSV, etc.)
   - Or paste URLs to scrape content
   - Status will update to "Ready" when indexed

4. **Test the Chatbot**
   - Visit your site and use the chat widget
   - Ask product, shipping, or business questions
   - AI will reference your indexed content

### Documentation

- **[Quick Start Guide](docs/AI_CHATBOT_QUICK_START.md)** - Get up and running in 5 minutes
- **[Complete Training Guide](docs/AI_CHATBOT_TRAINING_GUIDE.md)** - Detailed instructions and best practices
- **[Technical Architecture](docs/AI_CHATBOT_ARCHITECTURE.md)** - System design and implementation details

### Example Training Content

Create markdown files with FAQs, policies, and product information:

```markdown
# Frequently Asked Questions

## How long does shipping take?
Orders ship within 1-2 business days. Standard shipping takes 3-5 days.

## Are your salsas gluten-free?
Yes, all Jose Madrid salsas are gluten-free and vegan.

## What's your return policy?
We offer a 30-day money-back guarantee on all products.
```

Upload via `/admin/training-data` and the chatbot will instantly reference this information.

---

## 🎛️ Admin Panel

### Complete Features (Phase 0-4)

#### Phase 0: Foundation ✅ (100%)
- **RBAC System** - 28 granular permissions across 10 categories
- **User Roles** - ADMIN, DEVELOPER, STAFF, CUSTOMER, WHOLESALE
- **Encryption** - AES-256-GCM for sensitive data
- **Audit Logging** - Complete activity tracking
- **Middleware** - Route protection for `/admin` and `/api/admin`
- **Database Schema** - 40+ models with relationships

#### Phase 1: Core Admin ✅ (100%)
- **Dashboard** - Real-time KPIs and metrics
- **Orders Management** - Full lifecycle with search/filter
- **CSV Export** - Orders data export
- **Permission System** - UI elements filtered by role
- **Responsive Design** - Mobile, tablet, desktop support
- **Loading States** - Skeleton screens and spinners

#### Phase 2: Content Management ✅ (100%)
- **Products** - CRUD with 8 API endpoints, bulk operations
- **Recipes** - Full recipe CMS with ingredients and instructions
- **Categories** - Product categorization with SEO
- **Tags** - Universal tagging across entities
- **Media Library** - Upload, organize, tag media (URL-based)
- **SEO Fields** - Meta titles, descriptions, OG images

#### Phase 3: User Management ✅ (100%)
- **Users CRUD** - Complete user management
- **Role Assignment** - Switch roles with permission inheritance
- **Password Management** - Secure bcrypt hashing
- **Audit Logs Viewer** - Browse all system activity
- **Self-Delete Protection** - Prevent accidental lockout

#### Phase 4: Store Management ✅ (100%)
- **Fundraisers** - Campaign tracking with commission calculation
- **Wholesale Accounts** - B2B application review and approval
- **Status Management** - Approve/reject workflows
- **Business Analytics** - Revenue, orders, commissions

### Admin Navigation Structure

```
Admin Panel
├── Dashboard (overview metrics)
├── Orders
│   ├── All Orders (list)
│   └── Order Details (individual)
├── Products
│   ├── All Products (list)
│   ├── Categories (category management)
│   └── Tags (tag management)
├── Content
│   ├── Recipes (recipe CMS)
│   ├── Media Library (asset management)
│   ├── Events (Google Calendar integration)
│   └── SEO Manager (global SEO settings)
├── Customers
│   ├── Users (customer management)
│   ├── Wholesale (B2B accounts)
│   └── Audit Logs (activity tracking)
├── Marketing
│   ├── Fundraisers (campaigns)
│   ├── Gift Certificates (gift cards)
│   └── Social Media (multi-platform posting)
├── Messages (customer support)
├── Analytics (business intelligence)
├── Financials (reports and invoices)
└── Settings
    ├── General (site configuration)
    └── Integrations (API keys)
```

### Permission Categories

1. **Orders** - Read, Write, Export
2. **Products** - Read, Write, Bulk, Export
3. **Users** - Read, Write, Impersonate, Export
4. **Content** - Read, Write, Publish
5. **Analytics** - Read, Export
6. **Settings** - Read, Write
7. **Financials** - Read, Refunds, Export
8. **API Keys** - Manage
9. **Messaging** - Read, Reply, Assign
10. **Social Media** - Compose, Schedule, Publish

---

## 🛍️ Customer Features

### Shopping Experience
- **Product Catalog** - Browse 27+ products
- **Heat Level Filter** - Filter by spice level
- **Product Search** - Full-text search
- **Product Details** - Images, ingredients, reviews
- **Heat Gauge** - Visual spice indicator
- **Add to Cart** - Real-time cart updates
- **Cart Sidebar** - Quick cart access
- **Inventory Checks** - Real-time stock validation

### Checkout Flow
1. Cart review with item management
2. Guest or authenticated checkout
3. Shipping address entry (with saved addresses)
4. Billing address (same or different)
5. Stripe payment form (PCI compliant)
6. Order confirmation with tracking
7. Email notification (order confirmation)

### Account Management
- **Dashboard** - Order count, recent orders, quick actions
- **Order History** - Paginated with status filters
- **Order Details** - Full item breakdown, tracking, reorder
- **Address Book** - CRUD for shipping/billing addresses
- **Default Address** - Auto-select for checkout
- **Profile Settings** - Name, email, phone, date of birth
- **Password Change** - Secure password update
- **Sign Out** - Clear session

### Social Authentication
- **Email/Password** - Traditional signup/signin
- **Google OAuth** - One-click authentication
- **Session Management** - JWT-based tokens
- **Password Reset** - Email-based recovery

---

## 💼 Business Systems

### Fundraising Platform

**Create Campaigns**
- Organization details (name, contact, description)
- Custom commission rates (percentage)
- Start and end dates
- Goal amount (optional)
- Product selection (specific products per campaign)
- Public campaign pages with unique slugs

**Track Performance**
- Total orders per campaign
- Revenue generated
- Commission earned
- Order attribution
- Status management (DRAFT, ACTIVE, ENDED, CANCELLED)

**Commission Calculation**
```
Order Total × Commission Rate = Organization Commission
Remaining = Order Total - Commission
```

Example: $100 order with 20% commission = $20 to organization, $80 to store

### Wholesale Management

**Application Process**
1. Business submits application with:
   - Business name and type (RETAIL_STORE, RESTAURANT, DISTRIBUTOR, ONLINE_STORE, OTHER)
   - Tax ID and resale number
   - Contact information and website
   - Years in business
   - Estimated monthly volume
2. Admin reviews application
3. Admin approves or rejects
4. If approved, set discount rate and minimum order
5. Business receives wholesale pricing

**Discount Application**
```
Product Price × (1 - Discount Rate) = Wholesale Price
```

Example: $10 product with 25% discount = $7.50 wholesale price

**Account Status**
- **PENDING** - Awaiting admin review
- **APPROVED** - Active wholesale pricing
- **REJECTED** - Application denied
- **SUSPENDED** - Temporarily disabled

### Gift Certificates

**Purchase Flow**
1. Select amount ($25, $50, $75, $100, Custom)
2. Recipient email and name
3. Personal message (optional)
4. Sender information
5. Stripe payment
6. Instant email delivery

**Redemption**
- Check balance via certificate number
- Apply at checkout
- Partial redemption supported
- Balance tracking

### Messaging System

**Customer Chat**
- Real-time messaging widget
- Conversation threading
- Message history
- Read receipts
- Admin assignment

**Admin Interface**
- Conversation list with status
- Respond to messages
- Assign conversations to staff
- Close conversations
- Canned responses (future)

---

## 🔌 API Documentation

### Public APIs

#### Products
- `GET /api/products` - List products with filters
- `GET /api/products/featured` - Featured products
- `GET /api/products/[slug]` - Product details

#### Recipes
- `GET /api/recipes` - List recipes
- `GET /api/recipes/[slug]` - Recipe details

#### Locations
- `GET /api/locations` - Store locator data

#### Checkout
- `POST /api/checkout` - Create order
- `POST /api/checkout/complete` - Confirm payment

#### Gift Certificates
- `POST /api/gift-certificates/purchase` - Purchase gift card
- `POST /api/gift-certificates/complete` - Complete purchase
- `GET /api/gift-certificates/balance` - Check balance

#### Messages
- `POST /api/messages/start` - Start conversation
- `GET /api/messages` - List user's conversations
- `POST /api/messages/[id]` - Send message

### Admin APIs

#### Orders
- `GET /api/admin/orders` - List with pagination/filters
- `GET /api/admin/orders/export` - CSV export

#### Products
- `GET /api/admin/products` - List
- `POST /api/admin/products` - Create
- `GET /api/admin/products/[id]` - Get
- `PATCH /api/admin/products/[id]` - Update
- `DELETE /api/admin/products/[id]` - Delete
- `PATCH /api/admin/products/bulk` - Bulk update
- `DELETE /api/admin/products/bulk` - Bulk delete
- `GET /api/admin/products/export` - CSV export

#### Recipes
- `GET /api/admin/recipes` - List
- `POST /api/admin/recipes` - Create
- `GET /api/admin/recipes/[id]` - Get
- `PATCH /api/admin/recipes/[id]` - Update
- `DELETE /api/admin/recipes/[id]` - Delete

#### Categories
- `GET /api/admin/categories` - List
- `POST /api/admin/categories` - Create
- `GET /api/admin/categories/[id]` - Get
- `PATCH /api/admin/categories/[id]` - Update
- `DELETE /api/admin/categories/[id]` - Delete

#### Tags
- `GET /api/admin/tags` - List
- `POST /api/admin/tags` - Create
- `GET /api/admin/tags/[id]` - Get
- `PATCH /api/admin/tags/[id]` - Update
- `DELETE /api/admin/tags/[id]` - Delete

#### Media
- `GET /api/admin/media` - List
- `POST /api/admin/media` - Upload (URL-based)
- `DELETE /api/admin/media/[id]` - Delete

#### Users
- `GET /api/admin/users` - List
- `POST /api/admin/users` - Create
- `GET /api/admin/users/[id]` - Get
- `PATCH /api/admin/users/[id]` - Update
- `DELETE /api/admin/users/[id]` - Delete

---

## 🔒 Security & Authentication

### Authentication Methods

**NextAuth.js Configuration**
- JWT strategy with secure sessions
- Session expiration: 30 days
- Automatic token refresh

**Providers**
1. **Credentials** - Email/password with bcrypt (10 rounds)
2. **Google OAuth** - Social authentication

### Authorization System

**Role-Based Access Control (RBAC)**
- 5 user roles with hierarchical permissions
- 28 granular permissions across 10 categories
- Permission inheritance (ADMIN > DEVELOPER > STAFF)
- Route-level protection via middleware
- API endpoint protection via `requirePermission()`

**Role Hierarchy**
```
ADMIN      → All 28 permissions
DEVELOPER  → All 28 permissions
STAFF      → 13 permissions (operations-focused)
CUSTOMER   → 0 admin permissions
WHOLESALE  → 0 admin permissions
```

### Data Protection

**Encryption**
- AES-256-GCM for sensitive API keys
- bcrypt for password hashing (10 rounds)
- JWT for session tokens
- HTTPS enforced in production

**Audit Logging**
- All admin actions tracked
- IP address and user agent captured
- Before/after change snapshots
- High-risk action flagging
- Compliance-ready audit trail

**Security Headers**
- CSRF protection (NextAuth built-in)
- XSS protection (React escaping)
- SQL injection protection (Prisma)
- Rate limiting (middleware ready)

---

## 🔗 Integrations

### Payment Processing
- **Stripe** - Card processing, payment intents, webhooks
- **PCI Compliance** - Stripe Elements for card data
- **Webhook Events** - Order status updates, payment confirmations

### Commerce & Fulfillment
- **Shopify Admin** - Centralized order management, shipping, and inventory sync (see `docs/shopify-integration.md`)
- **Custom Sync Layer** - `lib/shopify` handles Admin API access, webhook verification, and Prisma mirroring

### Google Services
- **Google OAuth** - Social sign-in
- **Google Calendar** - Event sync (planned)
- **Google Places** - Location data (planned)
- **Google Business Profile** - Reviews and posts (planned)

### Email Delivery
- **Resend** - Transactional email service
- **Email Templates** - Dynamic template system (planned)

### Social Media (Planned)
- **Meta** - Facebook and Instagram posting
- **X (Twitter)** - Tweet scheduling
- **TikTok** - Video posting
- **Google Business** - Post scheduling

---

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with Turbo
npm run dev:fast         # Dev server on fixed port 3000
npm run dev:debug        # Dev server with Node inspect

# Build
npm run build            # Production build
npm run start            # Start production server

# Code Quality
npm run lint             # ESLint check
npm run type-check       # TypeScript check

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate       # Create migration
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio
npm run db:reset         # Reset database

# Utilities
npm run create-admin     # Create admin user
npm run clean            # Clean build artifacts
npm run fresh            # Clean install and restart
```

### Database Schema

**40+ Models Including:**
- User, Address, Order, OrderItem
- Product, Category, Tag, Media
- Recipe, Ingredient, Instruction
- Conversation, Message
- Fundraiser, FundraiserProduct
- WholesaleAccount
- GiftCertificate
- Permission, RolePermission
- AuditLog, ServiceKey
- SocialMediaPost, EmailTemplate
- FeaturedEvent, Location

### Code Standards

**TypeScript**
- Strict mode enabled
- Full type coverage
- No `any` types (except external libs)

**React**
- Server components by default
- Client components only when needed (`'use client'`)
- Functional components with hooks

**Styling**
- Tailwind utility classes
- Component variants with `cva`
- Responsive design (mobile-first)

**API Routes**
- Server-side validation with Zod
- Permission checks on all admin routes
- Audit logging for mutations
- Consistent response format (`ok()`, `fail()`)

### Testing

**Current Coverage**
- Unit tests: Crypto utilities
- Manual testing: All features
- TypeScript: Zero errors
- ESLint: Clean (minor img tag warnings)

**Recommended Testing**
- Integration tests for API routes
- E2E tests with Playwright
- Component tests with Vitest + Testing Library
- Permission boundary tests

---

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect Repository**
   ```bash
   vercel link
   ```

2. **Set Environment Variables**
   - Add all `.env.local` variables in Vercel dashboard
   - Generate new `MASTER_KEY` for production
   - Use production Stripe keys

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Database Setup (Production)

**Recommended: Vercel Postgres or Railway**

```bash
# Run migrations
npx prisma migrate deploy

# Seed database
npm run db:seed

# Create admin user
npm run create-admin
```

### Post-Deployment

1. Set up Stripe webhooks
2. Configure Google OAuth callback URLs
3. Test checkout flow end-to-end
4. Verify email delivery
5. Test admin panel access

---

## 🗺️ Future Roadmap

### Phase 5: Advanced Features (Planned)

#### Social Media Automation
- [ ] OAuth flows for Meta, X, TikTok, Google Business
- [ ] Token storage with encryption
- [ ] Background job queue for scheduled posts
- [ ] Media attachment from library
- [ ] Platform-specific content formatting
- [ ] Retry logic and error handling
- [ ] Analytics and engagement tracking

#### Merchandise Integration
- [ ] Print-on-demand partner API integration
- [ ] Live inventory sync from fulfillment provider
- [ ] Variant management (sizes, colors)
- [ ] Bulk publishing and pricing updates
- [ ] Order push to fulfillment partner
- [ ] Shipment tracking sync
- [ ] Margin simulation tools

#### Events & Calendar
- [ ] Google Calendar OAuth implementation
- [ ] Automatic event sync
- [ ] "Where is Jose?" special tracking
- [ ] Event tagging and categorization
- [ ] Homepage display controls
- [ ] Event registration (optional)

#### Form Templates
- [ ] Publishing workflow with approvals
- [ ] Multi-format export (HTML, PDF)
- [ ] PDF rendering with Playwright/Puppeteer
- [ ] Background job processing
- [ ] Analytics and usage tracking
- [ ] Version history management

#### SEO Manager
- [ ] Global site SEO configuration
- [ ] Meta tag templates with variables
- [ ] Schema.org structured data editor
- [ ] Robots.txt configuration
- [ ] Sitemap generation and submission
- [ ] Google Search Console integration

#### Enhanced Analytics
- [ ] Real-time dashboards with WebSockets
- [ ] Custom report builder
- [ ] Cohort analysis
- [ ] Customer lifetime value (CLV)
- [ ] Product affinity analysis
- [ ] Inventory forecasting

### Phase 6: Optimization & Scale

#### Performance
- [ ] Image optimization with CDN
- [ ] Database query optimization
- [ ] Redis caching layer
- [ ] Edge functions for API routes
- [ ] Static site generation for public pages

#### Advanced Features
- [ ] Multi-language support (i18n)
- [ ] Multi-currency support
- [ ] Subscription products
- [ ] Product bundles
- [ ] Dynamic pricing rules
- [ ] Automated marketing campaigns
- [ ] Customer segmentation
- [ ] Loyalty program

#### Integrations
- [ ] QuickBooks/Xero accounting sync
- [ ] Mailchimp email marketing
- [ ] SMS notifications (Twilio)
- [ ] Inventory management systems
- [ ] Shipping carrier integrations

---

## 📊 Current Status

### Completion Summary

| Phase | Module | Status | Completion |
|-------|--------|--------|-----------|
| 0 | Foundation | ✅ | 100% |
| 0 | RBAC & Security | ✅ | 100% |
| 0 | Database Schema | ✅ | 100% |
| 1 | Admin Infrastructure | ✅ | 100% |
| 1 | Dashboard | ✅ | 100% |
| 1 | Orders Management | ✅ | 100% |
| 2 | Products | ✅ | 100% |
| 2 | Recipes | ✅ | 100% |
| 2 | Categories | ✅ | 100% |
| 2 | Tags | ✅ | 100% |
| 2 | Media Library | ✅ | 90% |
| 2 | Events | ⏳ | 25% UI |
| 2 | SEO Manager | ⏳ | 25% UI |
| 3 | User Management | ✅ | 100% |
| 3 | Audit Logs | ✅ | 100% |
| 4 | Fundraisers | ✅ | 100% |
| 4 | Wholesale | ✅ | 100% |
| - | Storefront | ✅ | 100% |
| - | Authentication | ✅ | 100% |
| - | Checkout | ✅ | 100% |
| - | Gift Certificates | ✅ | 100% |

**Overall: 85% Complete - Production Ready**

### Statistics

- **Lines of Code:** 10,000+
- **Files Created:** 250+
- **API Endpoints:** 80+
- **Database Models:** 40+
- **Permissions:** 28
- **User Roles:** 5
- **Components:** 60+

---

## 🤝 Contributing

### Development Workflow

1. Create feature branch from `development`
2. Make changes following code standards
3. Test locally with `npm run lint` and `npm run type-check`
4. Commit with conventional commit messages
5. Create pull request to `development`
6. After review, merge to `development`
7. Deploy to staging for testing
8. Merge `development` to `main` for production

### Commit Message Format

```
type: brief description

Detailed explanation if needed

- Additional context
- Links to issues
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branch Strategy

- `main` - Production branch
- `development` - Development branch
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) by Vercel
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Database ORM by [Prisma](https://www.prisma.io/)
- Payments by [Stripe](https://stripe.com/)
- Deployment on [Vercel](https://vercel.com/)

---

## 📞 Support

For questions or support:
- **Documentation:** See `/docs` directory
- **Issues:** Create GitHub issue
- **Email:** support@josemadridsalsa.com (update with actual email)

---

<div align="center">

**Made with ❤️ and 🌶️ for Jose Madrid Salsa**

[Website](https://www.josemadridsalsa.com) • [Admin Panel](#-admin-panel) • [Documentation](#-table-of-contents)

</div>
