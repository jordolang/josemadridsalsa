<div align="center">

  <img src="apps/storefront/public/images/shared/jose-madrid-salsa-logo.png" alt="Jose Madrid Salsa Logo" width="300" />

  <h1>Jose Madrid Salsa</h1>
  <p><strong>Version 2.0 - Full Production Launch Ready</strong></p>

  [![Version](https://img.shields.io/badge/version-2.0.0-cb3b32)](https://github.com/jordolang/josemadridsalsa/releases)
  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel&logoColor=white)](https://vercel.com/)

  <p>
    <a href="https://www.josemadrid.net">Live Site</a> |
    <a href="apps/docs">Documentation</a> |
    <a href="CHANGELOG.md">Changelog</a> |
    <a href="SECURITY.md">Security</a>
  </p>

</div>

---

## Overview

Jose Madrid Salsa is the production e-commerce, fundraising, and business-management platform for Jose Madrid Salsa. Version 2.0 combines a responsive public storefront, customer accounts, fundraising campaign tools, an interactive battle arena, and a role-based administration platform.

The production website is live at [www.josemadrid.net](https://www.josemadrid.net).

## Homepage Preview

### Desktop

<a href="https://www.josemadrid.net">
  <img src="https://image.thum.io/get/width/1440/crop/1000/noanimate/https://www.josemadrid.net" alt="Jose Madrid Salsa Version 2.0 homepage on desktop" width="100%" />
</a>

### Mobile

<p align="center">
  <a href="https://www.josemadrid.net">
    <img src="https://image.thum.io/get/width/430/crop/932/noanimate/https://www.josemadrid.net" alt="Jose Madrid Salsa Version 2.0 homepage on mobile" width="430" />
  </a>
</p>

These screenshots are generated from the live production homepage so the README continues to show the current storefront.

## Version 2.0 Highlights

- Redesigned mobile-responsive storefront and homepage
- Product catalog, heat-level discovery, comparison, cart, checkout, and gift certificates
- Customer accounts with order history, saved addresses, and profile management
- Full fundraising account management platform
- Fundraiser page builder, participant tracking, campaign branding, and analytics
- Searchable Team Character selector with thousands of available character sprites
- Interactive Fundraiser Battle Arena with live team activity
- Mobile-ready administration dashboard with role-based access control
- Order, inventory, customer, media, email campaign, and contact-message management
- Multi-provider payment support, real-time tax, shipping, analytics, and monitoring

## Technology

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router and React Server Components |
| Language | TypeScript |
| Styling | Tailwind CSS 4 and Shadcn UI / Radix UI |
| Database | PostgreSQL with Prisma ORM |
| Authentication | NextAuth.js |
| Payments | Stripe, PayPal, Square, and POS integrations |
| Email | Resend and Nodemailer |
| Validation | Zod and React Hook Form |
| Testing | Vitest, Testing Library, MSW, and Playwright |
| Deployment | Vercel and Prisma Accelerate |
| Monitoring | Sentry, Amplitude, and Vercel Analytics |

## Project Structure

```text
josemadridsalsa/
|-- apps/
|   |-- storefront/       # Main Next.js commerce and admin app (includes API routes)
|   |-- fundraising/      # Fundraising campaign platform
|   |-- admin/            # Role-based administration dashboard
|   `-- docs/             # Fumadocs documentation site (canonical docs home)
|-- packages/
|   |-- shared-types/     # Shared TypeScript types across all apps
|   `-- shared-utils/     # Shared utility functions
|-- package.json          # npm workspace commands
`-- turbo.json            # Turborepo task graph
```

## Local Development

### Requirements

- Node.js 20 or 22
- PostgreSQL 14+
- Required environment variables documented in [`apps/docs/content/docs/configuration/environment-variables.mdx`](apps/docs/content/docs/configuration/environment-variables.mdx)

### Setup

```bash
git clone https://github.com/jordolang/josemadridsalsa.git
cd josemadridsalsa
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The monorepo runs several workspaces, each started with its own `dev:*` script:
- **Storefront** - `npm run dev` - [http://localhost:3000](http://localhost:3000)
- **Fundraising** - `npm run dev:fundraising` - [http://localhost:3001](http://localhost:3001)
- **Admin** - `npm run dev:admin` - [http://localhost:3003](http://localhost:3003)
- **Docs** - `npm run dev:docs` - [http://localhost:3002](http://localhost:3002)

API routes are served from the storefront app (`apps/storefront/app/api`). See the in-repo docs site (`apps/docs/content/docs/deployment`) for the architecture and deployment guides.

## Quality Checks

Run the required checks before every commit or pull request:

```bash
npx vitest run && npm run lint && npm run type-check
```

## Deployment

Pushing to `main` triggers the production deployment pipeline on Vercel. Production secrets are managed through Vercel environment variables and must never be committed to the repository.

## Documentation

Project documentation lives in the in-repo [Fumadocs site](apps/docs) at `apps/docs/content/docs`. Run it locally with `npm run dev:docs`. It is organized into getting-started, guides, features, configuration, integrations, deployment, and API reference sections.

- [Documentation site](apps/docs)
- [Security Policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Security

Please do not open public issues for security vulnerabilities. Follow the responsible disclosure process in [`SECURITY.md`](SECURITY.md).

---

<div align="center">
  <img src="apps/storefront/public/images/shared/jose_madrid_logo_profile.png" alt="Jose Madrid" width="80" />
  <p><strong>Jose Madrid Salsa</strong><br/>Zanesville, Ohio | <a href="https://www.josemadrid.net">josemadrid.net</a></p>
</div>
