# Changelog

All notable changes to the Jose Madrid Salsa e-commerce platform are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

---

## [1.10.1] — 2026-04-18 — Prisma Error Utilities & Credential Vault Refactor

### Added
- **`lib/prisma-errors.ts`** — Shared module exporting `isMissingTableError` (Prisma P2021 detection, including Accelerate-wrapped errors) and `logMissingTableWarning` (greppable warning format)
- **`tests/lib/prisma-errors.test.ts`** — 12 unit tests covering Prisma `KnownRequestError`, message-based heuristics, false-positive resistance, and standardised warning output

### Changed
- **Consolidated missing-table detection** — `lib/credentials.ts` and `lib/rbac.ts` now both call into `isMissingTableError` from `lib/prisma-errors.ts` instead of maintaining two parallel implementations (`isMissingTableError` + `shouldFallbackToDefaultPermissions`)
- **Tightened heuristics** — Cached `error.message.toLowerCase()` and added explicit precedence parentheses around the `relation` + `does not exist` check for clarity and a small perf win
- **Combined access-grant queries on `/admin/credentials`** — Page now performs a single `findUnique({ email })` and derives both grant existence and the per-permission flags from the result, halving DB roundtrips on every credentials-page render
- **Standardised warning format** — All "missing table" warnings across the admin surface now follow `[<scope>] <table_name> table does not exist. Run \`prisma migrate deploy\`.` for log greppability

### Removed
- **Redundant `shouldFallbackToDefaultPermissions`** in `lib/rbac.ts` (replaced with shared helper)
- **Closed PR #265** (`claude/beautiful-heisenberg`) and **PR #266** (`fix/credentials-page-runtime-error`) as superseded — the credential vault tables, indexes, and P2021 fallback behaviour are already in main via the `20260317000000_baseline` migration; this refactor addresses the shared reviewer feedback from both

---

## [1.10.0] — 2026-04-17 — Mobile App, Lead Gen & Admin Overhaul

### Added
- **iOS mobile app** — React Native Expo scaffold with full auth system, multi-provider payment integration, and native iOS Swift components
- **Mobile API endpoints** — Product by ID, account profile, and addresses for mobile client
- **Lead-generation scraper v2** — Google Business scraper with SerpAPI integration, Browserless.io remote browser, custom URL scraping with live progress dialog, and streaming `/parse` endpoint for Find Contacts step
- **Lead-gen UI overhaul** — Live feed redesign, collapsible table, pagination, toast notifications, progress bar, pause/resume dialog, skeleton loaders, tabbed activity log, and lead-selection checkboxes
- **PDF export for leads** with customizable options
- **Constant Contact CSV import** for existing contact lists
- **Resend email-template system** — Branded templates with sync pipeline; campaigns now support resume, cancel, and improved retry controls
- **Fundraiser Battle Arena port** — Ported Battle-Arena to the fundraiser subsystem across phases 0–5: pure game rules with vitest coverage, read-only spectator arena at `/arena/[period]`, server-authoritative damage and shield endpoints, realtime polling, and mobile/reduced-motion polish with Playwright smoke tests
- **Givebutter-style fundraiser pages** — `/fundraise/[slug]` restructured to a 2:1 layout with shadcn/ui donation UI and real donor identity on sale events (live supporter feed)
- **Admin panel redesign** — shadcn/ui sidebar-09 block with single-rail collapsible groups, theme-token migration, theme toggle, and bell-notifications fix
- **Sentry observability** — Error tracking and performance instrumentation wired up
- **Reviews section redesign** — Card grid with a leaning silhouette, theme-aware shadow/glow, and a 6th CTA card
- **Growth dashboard refactor** — Real database queries replacing placeholder data across admin dashboards
- **Feature images** added to the developer-page timeline
- **Developer-page profile photo** — Real photo inserted into the hero circle with flush framing

### Changed
- **Auth consolidation** — Removed Clerk; standardized on NextAuth.js with GitHub, Facebook, and Apple OAuth providers
- **Admin UI** — Completed shadcn migration across admin theme tokens; switched to CSS Grid with explicit column widths; plain-div content area to avoid SidebarInset overflow
- **Documentation site** — Removed fumadocs integration; public docs moved to `salsadocs.vercel.app`
- **Email pipeline** — Switched primary transactional provider from SMTP to Resend; slower rate limit for sync; `RESEND_UNSUBSCRIBE_URL` wired into outbound mail
- **Find-Us map** — Upgraded to Google Embed API v1 `/place` endpoint so the map zooms to the selected store
- **Event ticker** slowed to a comfortable reading speed
- **Dependabot** tightened to security-only npm updates and monthly GitHub Actions bumps
- **Package type** declared as ES module; CommonJS scripts renamed to `.cjs`
- **Developer-page faith statement** — Replaced with 1 Peter 4:10 and Galatians 6:9–10

### Fixed
- **Admin sidebar overlap** — CSS Grid layout fixes, SidebarInset bypassed for the content area, clickable parent nav with expand behavior, and single-rail collapsible groups
- **Scraper reliability** — Browser connection rotated every 3 domains, anti-detection measures, smarter contact parser (directory scanning + domain dedup), SSE `TextEncoder` bug, and event-bus subscriber mismatch
- **Vercel build** — TypeScript build errors resolved; `.vercelignore` patterns anchored to prevent admin-route exclusion; dead `fumadocs.config.ts` removed; `esbuild` pinning for legacy fumadocs-mdx
- **SMTP encryption failures** hardened via config validation
- **Rate-limit bypass** for mobile clients resolved
- **Email campaigns** — Missing campaign detail page (404 on create) and campaign sending both fixed
- **Google Places / Maps API key rotation** to restore Find-Us photos
- **Reviews section** — Silhouette positioning (~1.25in right shift) and theme-aware shadow/glow
- **Dependencies** — Next.js bumped to 16.2.3, Nodemailer to 8.0.5, `@prisma/client` aligned to 6.19.3, `defu` to 6.1.6

### Security
- **Auth surface reduced** — Removing Clerk eliminates a duplicate auth stack; NextAuth.js is now the single source of truth for OAuth
- **Sentry instrumentation** enables production error and regression monitoring
- **Scraper hardened** — Rotating remote browsers with anti-detection measures reduce the risk of IP-level bans and credential leakage

---

## [1.9.0] — 2026-04-02 — Developer Page & Blog Platform

### Added
- **Developer Page** (`/developer`) — Comprehensive developer hub honoring God's role in the project with Soli Deo Gloria faith statement and jlang.dev link
- **Parallax hero section** with developer bio, animated background effects, and scroll-driven interactions
- **Feature timeline** — 8 development phases rendered as scroll-driven timeline with cursor parallax, glow effects, and expand/zoom interactions
- **Tech stack grid** — 18 technologies across 4 categories with hover animations
- **Blog publishing system** (`/developer/blog`) — Full CRUD with Prisma model, admin-authenticated API, and markdown rendering via rehype-sanitize
- **Blog detail pages** (`/developer/blog/[slug]`) with sanitized markdown content
- **Contact form** — React Hook Form + Zod validation with rate limiting (3 requests per 5 minutes) and email notification via backend API
- **Changelog module** — Renders CHANGELOG.md on the developer page with collapsible version sections and changelog parser (`lib/developer/parse-changelog.ts`)
- **Developer link** added to global site footer across all pages
- **JSON-LD structured data** for developer page SEO
- **Full SEO metadata** with OpenGraph and Twitter card support (`lib/developer/metadata.ts`)
- **Loading skeleton** for developer page with animated placeholders
- **Dynamic imports** for code-split developer components (`lib/developer/dynamic-imports.tsx`)
- **Developer schemas** for input validation (`lib/developer/schemas.ts`)
- **Timeline data module** with 8 project phases (`lib/developer/timeline-data.ts`)
- Prisma schema extended with DeveloperBlogPost model (title, slug, content, excerpt, published, coverImage, tags)

### Security
- All 11 mandatory security audit items passed
- XSS sanitization via rehype-sanitize on blog markdown content
- Authentication required for blog CRUD API endpoints
- Rate limiting on contact form submissions
- Input validation with Zod schemas on all API endpoints

### Changed
- CHANGELOG.md expanded from stub to full 12-version history (v0.1.0 through v1.8.0)
- Footer updated with Developer link in About Us column
- `lib/metadata.ts` updated with developer page reference

---

## [1.8.0] — 2026-04-01 — Multi-Payment & Optimization

### Added
- Multi-payment provider support: PayPal, Square, and POS alongside Stripe
- Order analytics dashboard with enhanced tracking and reporting
- Shipping label generation system

### Fixed
- SSR enabled for dynamic components to resolve hydration issues
- Square SDK version corrected for production compatibility
- Google API calls reduced to max 1 per page load with server-side caching

---

## [1.7.0] — 2026-03-26 — Fundraiser Battle Arena

### Added
- Fundraiser Battle Arena — competitive gamification system for fundraiser campaigns
- Battle arena signup flow with Clerk authentication
- Admin tools for managing battle arena competitions

### Fixed
- Vercel build errors in battle arena files resolved
- PR #226 review comments addressed: Clerk auth, checkout tamper protection, E2E helpers

---

## [1.6.0] — 2026-03-16 — Fundraising Platform

### Added
- Fundraising Portal with dedicated subdomain for school and organization campaigns
- Participant tracking with real-time sales dashboards and referral ordering
- Fundraiser Account Portal with page builder and file uploads
- Homepage fundraising section with promotional content
- "Where Is Jose" schedule map on homepage
- Fundraiser admin detail page with product selection, pricing, branding, and commission controls
- Community message board with Google OAuth, supporter posts, and admin moderation
- Advanced fundraiser profiles with custom CSS, team management, and analytics
- Fundraiser page editor with 10 block types, inline GUI editor, and drag-and-drop
- Email campaigns system with sports team scraper integration
- Fundraising Portal button on account page for FUNDRAISER role users

### Fixed
- Fundraising portal build errors and admin 404s resolved
- Fundraising icon container aspect ratio corrected on homepage
- Fundraising portal button visibility — shows for any user with a fundraiserAccount, not just FUNDRAISER role
- Broken FacebookProvider removed; social-features stubs and FundraiserForm type fixed

---

## [1.5.0] — 2026-03-10 — Real Shipping & Infrastructure

### Added
- Real shipping cost calculation with carrier rate lookups
- Repository documentation overhaul: restructured docs/, removed junk files

### Changed
- Shipping module refactored per CodeRabbit review recommendations
- Express shipping cost calculation refactored for accuracy

### Fixed
- `calculateShipping()` calls properly awaited to resolve Promise type errors
- Shipping module Zod validation using `.issues` instead of `.errors`

---

## [1.4.0] — 2026-02-12 — Security & Inventory

### Added
- AES-256-GCM encryption for SMTP passwords and sensitive credentials
- Shipping and tax calculation integration into checkout flow
- File validation for uploads
- Admin credentials vault with encrypted storage and access control
- Inventory admin system with full management UI
- Refund API endpoint with inventory restoration on refunds

### Changed
- Sourcery suggestions integrated: params type improvements, encryption key validation, CSV case-sensitivity

### Fixed
- Inventory restoration on refunds optimized
- Critical bugs in API route handlers: payment double-charging, 403 status codes, cart inventory, params await, rate limiting, enum validation, error leakage

---

## [1.3.0] — 2026-01-03 — Analytics & Intelligence

### Added
- Discount code system with coupon and promo code support (`lib/discounts.ts`)
- AI-powered product recommendations engine (`lib/recommendations.ts`)
- Loyalty rewards program with points and rewards system (`lib/loyalty.ts`)
- Abandoned cart recovery with automated email sequences
- Email template block composition system
- Checkout API with authentication, audit logging, and tests
- Fundraiser signups API route with auth and auditing
- Forms API enhanced with audit logging and comprehensive tests

### Fixed
- Cart tracking now works without requiring guest email initially
- 401 Unauthorized errors fixed by normalizing email consistently
- EmailTemplateComposition model reverted to fix broken DB connection

---

## [1.2.0] — 2025-12-27 — Tax, Analytics & Inventory

### Added
- Real-time tax calculation using Stripe Tax API (`lib/tax-calculator.ts`)
- AI Chat API route with authentication, validation, and audit logging
- Amplitude analytics integration for behavior tracking and session replay
- Real-time inventory management system (`lib/inventory-manager.ts`)

---

## [1.1.0] — 2025-11-25 — Business Tools & Email

### Added
- 12 new branded business form templates with logo letterhead
- Fundraiser order tally sheet for campaign tracking
- Complete email template system with mass mailing capabilities
- Interactive location map with Google Maps and Street View
- Email campaigns system with analytics settings and engagement features

### Fixed
- Admin panel navigation fixed by seeding permissions tables
- Nodemailer import removed from client component to fix Vercel build

---

## [1.0.0] — 2025-11-06 — Production Launch

### Added
- **Storefront** — Full product catalog with heat-level filtering, search, and side-by-side comparison
- **Shopping Cart** — Cart sidebar with add, remove, and update quantities
- **Checkout** — Multi-step checkout with Stripe PaymentIntents, 3D Secure, Apple Pay, Google Pay
- **Gift Certificates** — Purchase, balance check, admin management, and custom themes
- **Authentication** — NextAuth.js with credential sign-in/sign-up and password reset with email verification
- **Account Management** — User dashboard, order history, saved addresses, and profile settings
- **Admin Panel** — Comprehensive dashboard: products, orders, customers, settings CRUD (Phases 1-4)
- **Recipe System** — 16 database-backed recipes with detail pages
- **Store Locator** — 77+ retail locations loaded from database with Google Places photo fetching
- **Location Detail Pages** — Individual pages for each retail location
- **RBAC System** — 5 user roles, 28 granular permissions with admin seeding script
- **Email System** — Transactional emails via Resend with branded templates
- **Google Analytics** — Tag integration (G-HG4QV5GFKH) for behavior tracking
- **Google Reviews** — Homepage section displaying random customer reviews
- **Dark Mode** — Site-wide dark mode support across all pages
- **OpenGraph Metadata** — Centralized OG images for social sharing
- **Vercel Analytics** — Performance monitoring integration
- **WordPress Bot Protection** — Middleware to block probe bots
- **Product Import** — CSV support with SKU tracking and restoration tools
- **i18n Foundation** — Intl.DisplayNames for region formatting
- **Admin Locations** — Location management panel with Google Places photo fetching
- **Stripe Webhooks** — Production webhook endpoint for payment processing
- **Prisma Accelerate** — Production database optimization layer

### Changed
- Migrated from static data to PostgreSQL-backed API for salsas and products
- Production-ready infrastructure and deployment configuration on Vercel
- Site URL configured to josemadrid.net

### Fixed
- Product image loading errors with missing images and enhanced error handling
- Prisma initialization for deployment environments
- NextAuth session endpoint CLIENT_FETCH_ERROR resolved
- Database schema sync with missing tables added
- Auth 401 errors resolved by optimizing SessionProvider and adding error handling

---

## [0.2.0] — 2025-10-30 — Core E-Commerce

### Added
- Stripe checkout flow with PaymentIntents
- Credential sign-up and sign-in flows
- Resend dependency for email functionality
- Recipe model with 16 recipes and API endpoint
- Google Calendar integration for "On the Move" page
- GitHub Actions workflow for Next.js deployment

### Changed
- Salsas page updated to fetch products from PostgreSQL API

### Fixed
- Stripe initialization guarded for build environments
- Auth pages wrapped in Suspense for router hooks

---

## [0.1.0] — 2025-10-10 — Foundation

### Added
- Next.js 15 project setup with TypeScript and Tailwind CSS
- Comprehensive database schema with Prisma ORM (PostgreSQL)
- UI design system with modern components (Radix UI + Shadcn)
- Product catalog with salsas, products, and recipes pages
- Cart sidebar with shopping cart functionality
- NextAuth SessionProvider configuration

### Fixed
- Package.json structure corrected for basic Next.js setup
- Tailwind CSS configuration fixed for successful build
- Cart-sidebar import errors resolved
