<div align="center">

  <img src="public/images/shared/jose-madrid-salsa-logo.png" alt="Jose Madrid Salsa Logo" width="300" />

  <h1>Jose Madrid Salsa</h1>
  <p><strong>Artisan Hot Sauce &amp; E-Commerce Platform</strong></p>

  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe&logoColor=white)](https://stripe.com/)
  [![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)
  [![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)

  <p>
    <a href="https://www.josemadrid.net">🌐 Live Site</a> ·
    <a href="docs/index.md">📚 Documentation</a> ·
    <a href="CONTRIBUTING.md">🤝 Contributing</a> ·
    <a href="CHANGELOG.md">📋 Changelog</a> ·
    <a href="SECURITY.md">🔒 Security</a>
  </p>

</div>

---

## Overview

**Jose Madrid Salsa** is a modern, full-featured e-commerce platform purpose-built for selling artisan hot sauces and specialty food products. It powers the complete business lifecycle — from product catalog and online sales to fundraising campaigns and retail distribution through physical partner locations.

Built on **Next.js 15** with the App Router, it delivers a production-ready storefront with an enterprise-grade admin dashboard, seamless Stripe payment processing, and a powerful data management layer backed by PostgreSQL.

> **Version 1.0 (Production)** is live at [josemadrid.net](https://www.josemadrid.net)

---

## ✨ Features

### 🛒 Customer Storefront
- Full product catalog with heat-level filtering, search, and side-by-side comparison
- Seamless shopping cart and multi-step checkout with Stripe (cards, Apple Pay, Google Pay)
- Digital gift certificates with custom themes and scheduled delivery
- User account management — order history, saved addresses, and profile settings
- Interactive retail store locator powered by Google Maps & Places
- Mobile-first, fully responsive design

### 📈 Fundraising Portal
- Dedicated fundraising subdomain for school and organization campaigns
- Participant tracking with real-time sales dashboards
- Automated participant onboarding and order attribution

### 🗂️ Admin Dashboard
- Comprehensive order management with search, filtering, and CSV export
- Full product CRUD with SKU tracking, inventory control, and image management
- Customer management with role-based visibility
- Tag and category system for flexible product organization
- Media library for image uploads and management
- Role-based access control (RBAC): 5 user roles, 28 granular permissions
- Audit logging for all sensitive operations

### 🔧 Platform & Infrastructure
- **Authentication** — Secure sign-in/sign-up with NextAuth.js, password reset, and email verification
- **Payments** — Stripe PaymentIntents, webhooks, 3D Secure, real-time tax calculation
- **Email** — Transactional emails via Resend with branded templates
- **Analytics** — Amplitude for behavior tracking and session replay; Vercel Analytics for performance
- **Monitoring** — Sentry error tracking in production
- **Internationalization** — English and Spanish via next-intl
- **Security** — AES-256-GCM encryption, CodeQL scanning, secret detection, pre-commit hooks

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router + RSC) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS + Shadcn UI (Radix UI) |
| **Animations** | Framer Motion |
| **Database** | PostgreSQL via Prisma ORM |
| **Auth** | NextAuth.js |
| **Payments** | Stripe |
| **Email** | Resend + Nodemailer |
| **State** | Zustand |
| **Forms** | React Hook Form + Zod |
| **Testing** | Vitest + Testing Library + MSW |
| **Deployment** | Vercel + Prisma Accelerate |

### Project Structure

```
josemadridsalsa/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Public storefront (home, products, cart, checkout)
│   ├── (fundraiser-portal)/      # Fundraising management portal
│   ├── (fundraiser-subdomain)/   # Fundraiser participant storefront
│   ├── (auth)/                   # Authentication pages
│   ├── admin/                    # Admin dashboard (RBAC-protected)
│   ├── account/                  # User account pages
│   └── api/                      # Serverless API routes
│
├── components/                   # Shared React components
│   ├── ui/                      # Primitive UI (Radix UI + custom)
│   ├── store/                   # Storefront components
│   └── admin/                   # Admin-specific components
│
├── lib/                          # Business logic and utilities
│   ├── auth.ts                  # NextAuth configuration
│   ├── prisma.ts                # Prisma client (lazy init + Accelerate)
│   ├── crypto.ts                # AES-256-GCM encryption
│   ├── rbac.ts                  # Permission system
│   ├── stripe/                  # Stripe integration
│   └── email/                   # Email service clients
│
├── prisma/                       # Database schema and migrations
├── public/                       # Static assets (images, icons)
├── scripts/                      # Data and maintenance scripts
├── tests/                        # Automated test suite
├── docs/                         # Project documentation
└── messages/                     # i18n translations (en.json, es.json)
```

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 20 or 22 (see `.nvmrc`) |
| PostgreSQL | 14+ |
| Stripe account | — |
| Resend account | — |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/jordolang/josemadridsalsa.git
cd josemadridsalsa

# 2. Use the correct Node version
nvm use

# 3. Install dependencies
npm install

# 4. Configure environment variables
cp .env.example .env.local
# Open .env.local and fill in the required values
# See docs/ENVIRONMENT_VARIABLES.md for full reference

# 5. Apply database migrations
npm run db:migrate

# 6. Seed initial data (permissions, roles, sample products)
npm run db:seed

# 7. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the storefront should be running.

> **Admin access:** Run `npx tsx scripts/create-admin.ts` to create the first admin user.

### Environment Variables

Copy `.env.example` to `.env.local` and configure the required variables. See [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md) for the complete reference.

**Required to start:**

```bash
DATABASE_URL="postgresql://..."    # PostgreSQL connection string
NEXTAUTH_SECRET="..."              # Strong random secret (32+ chars)
NEXTAUTH_URL="http://localhost:3000"
MASTER_KEY="..."                   # AES-256 key (64 hex chars)
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
RESEND_API_KEY="re_..."
```

> ⚠️ **Never commit `.env` files.** Always set production secrets through the Vercel dashboard.

---

## 🛠️ Development

### Available Commands

```bash
# Development
npm run dev             # Start development server (Turbo)
npm run dev:fast        # Start on fixed port 3000
npm run build           # Build for production
npm run start           # Serve production build

# Quality Checks
npm run lint            # ESLint (Next.js + Tailwind rules)
npm run type-check      # TypeScript compiler check
npx vitest run          # Run full test suite
npx vitest run --watch  # TDD watch mode

# Database
npm run db:migrate      # Apply pending migrations
npm run db:generate     # Regenerate Prisma client
npm run db:seed         # Seed database
npm run db:reset        # Drop and recreate database (⚠️ destructive)
```

### Before Every Commit

```bash
npx vitest run && npm run lint && npm run type-check
```

### Running Tests

The test suite uses **Vitest** with jsdom, jest-dom, Testing Library, and MSW for API mocking:

```bash
npx vitest run           # Run all tests
npx vitest run --coverage  # With coverage report
```

Tests live in `tests/` and mirror the source structure:
```
tests/
├── lib/           # Unit tests for lib/ modules
├── components/    # Component tests
└── api/           # API route tests
```

---

## 💳 Payment Integration

Payments are processed through **Stripe** with full webhook support.

### Supported Payment Methods
- 💳 Credit / debit cards (Visa, Mastercard, Amex, Discover)
- 🍎 Apple Pay
- 🔵 Google Pay
- 🎁 Gift certificates

### Architecture

```
Checkout Page
  └─► POST /api/payment (Create PaymentIntent)
        └─► Stripe API
              └─► Stripe Webhook → /api/stripe/webhook
                    └─► Order creation + fulfillment
```

### Test Cards

```
4242 4242 4242 4242  → Success
4000 0025 0000 3155  → 3D Secure required
4000 0000 0000 9995  → Card declined
```

**Reference:** [`docs/stripe/README.md`](docs/stripe/README.md) · [`docs/STRIPE_WEBHOOK_SETUP.md`](docs/STRIPE_WEBHOOK_SETUP.md)

---

## 📦 Deployment

The platform deploys automatically to **Vercel** on push to `main`.

```
main branch push
  └─► Vercel CI/CD
        ├─► lint + type-check
        ├─► Next.js build
        └─► Deploy to https://www.josemadrid.net
```

### Production Requirements

| Service | Purpose |
|---------|---------|
| Vercel | Hosting + serverless functions |
| Vercel Postgres (Neon) | Primary database |
| Prisma Accelerate | Database connection pooling |
| Resend | Transactional email delivery |
| Stripe | Payment processing |
| Sentry | Error monitoring |
| Amplitude | Analytics |

---

## 🔐 Security

Security is a first-class concern in this platform.

### Measures in Place

| Layer | Implementation |
|-------|---------------|
| Secrets management | AES-256-GCM encryption for stored credentials |
| Authentication | NextAuth.js with secure session handling |
| Authorization | RBAC with middleware-enforced route protection |
| Input validation | Zod schemas on all API routes |
| Code scanning | GitHub CodeQL on every push |
| Secret scanning | Gitleaks + TruffleHog |
| Dependency monitoring | Dependabot alerts |
| Payment security | Stripe-hosted Elements (PCI DSS compliant) |
| Webhook verification | Signed Stripe webhook signatures |

### Reporting Vulnerabilities

Please **do not** open public issues for security vulnerabilities. Follow the responsible disclosure process in [`SECURITY.md`](SECURITY.md).

---

## 📊 Data Import

The platform includes a bulk import system for migrating existing data:

| Data Type | Formats Supported |
|-----------|------------------|
| Products | CSV, Excel (.xlsx), JSON |
| Orders | CSV, Excel |
| Gift Certificates | CSV |
| Retail Locations | CSV, JSON |

**Features:** Validation before import · batch processing · detailed error reporting · template downloads

**Reference:** [`docs/PRODUCT_IMPORT.md`](docs/PRODUCT_IMPORT.md) · [`docs/import-infrastructure/`](docs/import-infrastructure/)

---

## 📚 Documentation

Full documentation is available in the [`docs/`](docs/) directory.

| Document | Description |
|----------|-------------|
| [`docs/index.md`](docs/index.md) | Documentation hub and index |
| [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md) | Local dev setup |
| [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md) | All env var definitions |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Database config & troubleshooting |
| [`docs/stripe/README.md`](docs/stripe/README.md) | Stripe payment integration |
| [`docs/API.md`](docs/API.md) | REST API reference |
| [`docs/ADMIN_LOGIN_GUIDE.md`](docs/ADMIN_LOGIN_GUIDE.md) | Admin dashboard guide |
| [`docs/ENCRYPTION_SETUP.md`](docs/ENCRYPTION_SETUP.md) | Encryption configuration |

---

## 🤝 Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full guidelines.

### Quick Contribution Checklist

- [ ] Branch from `main` with a descriptive name
- [ ] Follow TypeScript + Tailwind coding conventions
- [ ] Use the `@/` module alias — no relative imports across directories
- [ ] Write or update tests for behavior changes
- [ ] Pass `npx vitest run && npm run lint && npm run type-check`
- [ ] Open a PR with a clear description and screenshots for UI changes

> For AI agents and automated tools operating in this repository, see [`AGENTS.md`](AGENTS.md) for mandatory operating guidelines.

---

## 📋 Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for a full history of changes.

---

## 📄 License

This project is licensed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

  <img src="public/images/shared/jose_madrid_logo_profile.png" alt="Jose Madrid" width="80" />

  <p>
    <strong>Jose Madrid Salsa</strong><br/>
    Zanesville, Ohio · <a href="https://www.josemadrid.net">josemadrid.net</a>
  </p>

  <sub>Built with ❤️ using Next.js, TypeScript, and Tailwind CSS</sub>

</div>
