# Jose Madrid Salsa — Documentation Hub

Welcome to the technical documentation for the Jose Madrid Salsa e-commerce platform.

## Overview

Jose Madrid Salsa is a modern, full-featured e-commerce platform built with Next.js 15, featuring:

- **Customer Storefront** - Product browsing, cart management, and checkout
- **Admin Dashboard** - Comprehensive business management tools
- **API Layer** - RESTful APIs with Prisma ORM
- **Authentication** - Secure user authentication with NextAuth
- **Payment Processing** - Stripe integration for payments
- **Content Management** - Products, recipes, tags, and media management

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 with App Router |
| Language | TypeScript |
| UI Library | React 19 + Tailwind CSS + Shadcn UI |
| Database | PostgreSQL with Prisma ORM |
| Authentication | NextAuth.js |
| Payments | Stripe |
| State Management | Zustand |
| Form Handling | React Hook Form + Zod |
| Email | Resend |
| Deployment | Vercel |

## Quick Links

- [Environment Setup](ENVIRONMENT_SETUP.md) — Get started with local development
- [Environment Variables Reference](ENVIRONMENT_VARIABLES.md) — All required env vars
- [Admin Login Guide](ADMIN_LOGIN_GUIDE.md) — Admin dashboard access
- [Stripe Integration](stripe/README.md) — Payment processing documentation
- [API Documentation](API.md) — REST API endpoint reference
- [Turborepo Architecture](TURBOREPO_ARCHITECTURE.md) — Application boundaries and migration model
- [Database Setup](DATABASE.md) — Database configuration and maintenance

## Getting Started

### Prerequisites

- Node.js 20 or 22
- PostgreSQL database
- Stripe account (for payments)
- Environment variables configured

### Installation

```bash
# Clone the repository
git clone https://github.com/jordolang/josemadridsalsa.git
cd josemadridsalsa

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run database migrations
npm run db:migrate

# Seed the database (optional)
npm run db:seed

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Documentation Index

### Setup & Configuration

| Document | Description |
|----------|-------------|
| [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) | Local development setup |
| [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) | All environment variable definitions |
| [DATABASE.md](DATABASE.md) | Database configuration and troubleshooting |
| [ENCRYPTION_SETUP.md](ENCRYPTION_SETUP.md) | AES-256-GCM encryption for admin secrets |
| [NEXTAUTH_PRODUCTION_CONFIG.md](NEXTAUTH_PRODUCTION_CONFIG.md) | NextAuth production configuration |

### Integrations

| Document | Description |
|----------|-------------|
| [stripe/README.md](stripe/README.md) | Stripe payment integration overview |
| [stripe/CURRENT_IMPLEMENTATION.md](stripe/CURRENT_IMPLEMENTATION.md) | Technical implementation details |
| [stripe/CHECKOUT_GUIDE.md](stripe/CHECKOUT_GUIDE.md) | Comprehensive Stripe checkout patterns |
| [STRIPE_WEBHOOK_SETUP.md](STRIPE_WEBHOOK_SETUP.md) | Webhook configuration guide |
| [EMAIL_DNS_SETUP.md](EMAIL_DNS_SETUP.md) | Email / DNS configuration |
| [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md) | Google Maps integration |
| [GOOGLE_PLACES_SETUP.md](GOOGLE_PLACES_SETUP.md) | Google Places integration |
| [GOOGLE_REVIEWS_SETUP.md](GOOGLE_REVIEWS_SETUP.md) | Google Reviews setup |
| [GOOGLE_CALENDAR_SETUP.md](GOOGLE_CALENDAR_SETUP.md) | Google Calendar integration |
| [GITHUB_INTEGRATION.md](GITHUB_INTEGRATION.md) | GitHub Actions / CI setup |
| [SHOPIFY_INTEGRATION.md](SHOPIFY_INTEGRATION.md) | Shopify data migration |
| [SHOPIFY_WEBHOOK_SETUP.md](SHOPIFY_WEBHOOK_SETUP.md) | Shopify webhook configuration |

### Features & Modules

| Document | Description |
|----------|-------------|
| [API.md](API.md) | REST API endpoint reference |
| [TURBOREPO_ARCHITECTURE.md](TURBOREPO_ARCHITECTURE.md) | Monorepo applications, commands, and deployment boundaries |
| [ADMIN_LOGIN_GUIDE.md](ADMIN_LOGIN_GUIDE.md) | Admin dashboard access |
| [PASSWORD_RESET_FEATURE.md](PASSWORD_RESET_FEATURE.md) | Password reset flow |
| [LOCATION_MAP_FEATURE.md](LOCATION_MAP_FEATURE.md) | Retail location map feature |
| [IMAGE_MANAGEMENT.md](IMAGE_MANAGEMENT.md) | Image upload and management |
| [PRODUCT_IMPORT.md](PRODUCT_IMPORT.md) | Product data import guide |
| [PRODUCT_PHOTOGRAPHY.md](PRODUCT_PHOTOGRAPHY.md) | Product photography standards |

### Data Import Infrastructure

The `import-infrastructure/` subdirectory contains technical analysis documents for the data import system:

| Document | Description |
|----------|-------------|
| [GAP_ANALYSIS.md](import-infrastructure/GAP_ANALYSIS.md) | Import gap analysis |
| [INVESTIGATION_REPORT.md](import-infrastructure/INVESTIGATION_REPORT.md) | Import investigation findings |
| [ISSUES.md](import-infrastructure/ISSUES.md) | Known issues |
| [ORDERS_IMPORT.md](import-infrastructure/ORDERS_IMPORT.md) | Order import guide |
| [PRODUCT_IMPORT.md](import-infrastructure/PRODUCT_IMPORT.md) | Product import details |
| [LOCATIONS_ASSESSMENT.md](import-infrastructure/LOCATIONS_ASSESSMENT.md) | Locations import assessment |
| [GIFT_CERTIFICATES_ASSESSMENT.md](import-infrastructure/GIFT_CERTIFICATES_ASSESSMENT.md) | Gift certificate import |
| [PARTIAL_IMPORTS.md](import-infrastructure/PARTIAL_IMPORTS.md) | Handling partial imports |

### Code Quality & Standards

| Document | Description |
|----------|-------------|
| [JSDOC_CONVENTIONS.md](JSDOC_CONVENTIONS.md) | JSDoc documentation standards |
| [PERFORMANCE.md](PERFORMANCE.md) | Performance optimization notes |

## Project Structure

```
josemadridsalsa/
├── apps/
│   ├── storefront/        # Main Next.js commerce application
│   ├── fundraising/       # Fundraising-only deployment boundary
│   ├── backend/           # API-only deployment boundary
│   └── ios/               # Expo/React Native iOS application
├── docs/                 # Project documentation (this directory)
├── package.json          # npm workspace commands
└── turbo.json            # Turborepo task graph
```

## Development Workflow

1. **Create a branch** — `git checkout -b feature/your-feature`
2. **Make changes** — Follow coding standards in [AGENTS.md](../AGENTS.md)
3. **Run checks** — `npx vitest run`, `npm run lint`, `npm run type-check`
4. **Commit** — Lead with an imperative verb (`Add:`, `Fix:`)
5. **Open a PR** — Include description, screenshots for UI changes, and checklist

## Deployment

The application is deployed on **Vercel**:

- **Production:** [josemadrid.net](https://www.josemadrid.net)
- **Database:** Vercel Postgres (Neon-backed)
- **CI/CD:** Automatic deployment from `main` branch

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines and [AGENTS.md](../AGENTS.md) for AI agent configuration standards.

## License

MIT
