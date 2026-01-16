# Jose Madrid Salsa E-Commerce Platform

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

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **UI Library**: React 19
- **Styling**: Tailwind CSS with Shadcn UI components
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Payments**: Stripe
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Zod validation
- **Email**: Resend

## Quick Links

- [Environment Setup](env-setup.md) - Get started with local development
- [Admin Panel Guide](admin-panel-complete.md) - Learn to use the admin dashboard
- [Stripe Payment Integration](stripe/README.md) - Payment processing documentation
- [API Documentation](#) - API endpoints and usage
- [Project Status](PROJECT_STATUS.md) - Current project state

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

## Project Structure

```
josemadridsalsa/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── admin/             # Admin panel pages
│   ├── account/           # User account pages
│   └── salsas/            # Product pages
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── store/            # Storefront components
│   ├── admin/            # Admin components
│   └── account/          # Account components
├── lib/                   # Utility functions and helpers
├── prisma/               # Database schema and migrations
├── public/               # Static assets
├── docs/                 # Documentation (this site)
└── tests/                # Test files
```

## Features

### Customer Features

- Product browsing with filtering and search
- Shopping cart and checkout
- User account management
- Order history
- Address management
- Product reviews
- Gift certificates
- Recipe browsing

### Admin Features

- Product management (CRUD)
- Order management
- Customer management
- Inventory tracking
- Media library
- Recipe management
- Tag system
- Email template editor
- Social media post composer
- Analytics dashboard
- Financial reporting

### Developer Features

- TypeScript for type safety
- Server and client components
- API routes with validation
- Database migrations
- Automated testing
- Component library
- Development tools

## API Overview

The platform exposes RESTful APIs for:

- **Products** - `/api/products`
- **Orders** - `/api/orders`
- **Authentication** - `/api/auth`
- **Admin Operations** - `/api/admin/*`
- **Gift Certificates** - `/api/gift-certificates`
- **Calendar** - `/api/calendar`

See the [API Documentation](#) for detailed endpoint information.

## Payment Processing

The platform uses **Stripe** for secure payment processing with:

- ✅ Server-side PaymentIntent creation
- ✅ Webhook-based order fulfillment
- ✅ Real-time tax and shipping calculation
- ✅ Gift certificate support
- ✅ PCI DSS compliance via Stripe Elements
- ✅ 3D Secure authentication
- ✅ Test and production environments

**Documentation**:
- [Stripe Integration Overview](stripe/README.md) - Start here
- [Current Implementation Guide](stripe/current-implementation.md) - Technical details
- [Comprehensive Stripe Guide](stripe/stripe-checkout-comprehensive-guide.md) - All patterns
- [Webhook Setup Guide](STRIPE_WEBHOOK_SETUP.md) - Webhook configuration

**Quick Reference**:
```bash
# Test cards
4242 4242 4242 4242  # Success
4000 0025 0000 3155  # 3D Secure required
4000 0000 0000 9995  # Declined
```

## Development Workflow

1. **Create Feature Branch** - `git checkout -b feature/your-feature`
2. **Make Changes** - Follow coding standards in [AGENTS.md](../AGENTS.md)
3. **Run Tests** - `npm run test`, `npm run lint`, `npm run type-check`
4. **Commit Changes** - Use conventional commits
5. **Create Pull Request** - Include description and testing notes

## Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npx vitest run --watch

# Run linter
npm run lint

# Type check
npm run type-check
```

## Deployment

The application is deployed on Vercel:

- **Production**: [josemadridsalsa.com](https://josemadridsalsa.com)
- **Database**: PostgreSQL (managed)
- **CI/CD**: Automatic deployment from main branch

## Support

For questions or issues:

- Review the [Project Status](PROJECT_STATUS.md)
- Check [Session Summaries](SESSION_SUMMARY_3_MODULES.md)
- Read phase completion docs (Phase 0-4)

## Contributing

Refer to [AGENTS.md](../AGENTS.md) for:
- Coding standards
- Component patterns
- Testing requirements
- Commit conventions

## License

MIT
