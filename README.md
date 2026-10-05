# Jose Madrid Salsa — Public E-Commerce Platform

![Jose Madrid Salsa](./apps/storefront/public/logo.png)

The Jose Madrid Salsa monorepo contains the new public e-commerce website, fundraising platform, admin console, and supporting packages for Jose Madrid Salsa (https://www.josemadrid.net).

This README is the primary public-facing documentation for the project: it explains what the project contains, highlights key features and screenshots, links to in-repo documentation, and provides clear instructions for running, testing, and contributing.

---

## Quick links

- Repository: https://github.com/jordolang/josemadridsalsa
- Primary app (storefront): apps/storefront
- Docs site (canonical docs): apps/docs
- Fundraising app: apps/fundraising
- Admin app: apps/admin
- Key docs:
  - apps/docs/content/docs/guides/ordering-system-comparison.mdx
  - apps/docs/content/docs/getting-started.mdx (see apps/docs)

---

## Project summary

Jose Madrid Salsa is a production-grade monorepo built with Next.js (App Router) that runs the company storefront, customer accounts, multi-provider checkout, fundraising portal (including a gamified "arena"), an email-marketing suite, and a role-based admin console.

This repository is intended for engineers working on the public storefront and related apps. If you are onboarding, please read the repository's CLAUDE.md first — it contains important architecture and workflow rules.

---

## Features (overview)

Storefront (apps/storefront)
- Product catalog with variants
- Customer accounts, session management, and addresses
- Multi-provider checkout (payment providers integration)
- Order history, receipts, and QuickBooks syncing
- Promotions, discounts, and coupon support
- Internationalization and shipping rules

Fundraising
- Campaign creation and management
- Peer-to-peer and event-based fundraising
- Gamified battle arena and leaderboards

Admin (apps/admin and in-storefront /app/admin)
- Role-based access controls and user management
- Order management and fulfillment tools
- Inventory, product, and pricing controls
- Campaign and fundraiser administration
- Reporting and exports

---

## Screenshots

The repo includes SVG screenshot placeholders so the README displays images immediately. Add production screenshots to `assets/screenshots/` using the file names below (SVG or PNG are fine) so the README displays them automatically.

Suggested screenshot files and where they'll be used:

- assets/screenshots/homepage.svg — Homepage / hero section
- assets/screenshots/product-page.svg — Product detail with variants
- assets/screenshots/cart-checkout.svg — Cart and Checkout flow
- assets/screenshots/account-dashboard.svg — Customer account dashboard
- assets/screenshots/fundraising-campaign.svg — Fundraising campaign page
- assets/screenshots/arena-leaderboard.svg — Fundraising arena / leaderboard
- assets/screenshots/admin-dashboard.svg — Admin panel main dashboard
- assets/screenshots/admin-orders.svg — Admin order detail view

These placeholder SVGs have been added in this commit. Replace them with high-quality PNG or SVG exports from the running app when you have production screenshots.

Example markdown to embed an image:

```md
![Homepage](assets/screenshots/homepage.svg)
```

If you prefer to keep screenshots out of the repo, host them in an internal image CDN and update the image URLs in this file.

---

## Architecture and stack

High level (see CLAUDE.md for full details):

- Monorepo: Turborepo + npm workspaces
- Node: 20 (see .nvmrc)
- Framework: Next.js 16 (App Router, RSC)
- UI: React 19, TailwindCSS 4, Shadcn UI / Radix UI
- Language: TypeScript 5.9 (strict), path alias `@/`
- DB: PostgreSQL via Prisma ORM 6

Repo layout (top-level):

```
josemadridsalsa/
├── apps/
│   ├── storefront/     # PRIMARY app — storefront, accounts, checkout, admin, arena, POS, API routes
│   ├── fundraising/    # Standalone fundraising campaign app (port 3001)
│   ├── admin/          # Standalone role-based admin app (port 3003)
│   └── docs/           # Fumadocs documentation site (port 3002) — canonical docs home
├── package.json
└── turbo.json
```

Note: Most runtime code and API handlers live in apps/storefront (including app/api). See CLAUDE.md for the "no apps/backend" note.

---

## Local development

Prerequisites
- Node 20 (use nvm: `nvm use`)
- pnpm or npm (the repo uses npm workspaces)
- PostgreSQL instance for local development
- Environment variables: copy `.env.example` to `.env.local` and fill in secrets (database URL, provider keys). See apps/storefront/README.md for app-specific env vars.

Run the storefront locally:

```bash
npm install
npm run dev:fast   # or `npm run dev` for all apps via turbo
# storefront: http://localhost:3000
# docs: http://localhost:3002
# fundraising: http://localhost:3001
# admin: http://localhost:3003
```

Running a single app (storefront):

```bash
cd apps/storefront
npm run dev
```

Database
- Run Prisma migrations with `npx prisma migrate dev --schema=apps/storefront/prisma/schema.prisma` (adjust path as needed)
- Seed data: see apps/storefront/prisma/seed.ts (if present)

Tests
- Unit tests: `npm test` at repo root or per-workspace test script
- E2E: project-specific commands (see apps/storefront/test or cypress configuration)

---

## Links to internal docs

This README links to and summarizes in-repo documentation. For deeper reference, read the docs site at `apps/docs` and these files:

- apps/docs/content/docs/guides/ordering-system-comparison.mdx — feature parity & cutover notes from legacy BigCommerce store
- apps/docs/content/docs/getting-started.mdx — onboarding / environment setup (if present)
- apps/storefront/README.md — storefront-specific dev notes and env var list
- apps/admin/README.md — admin app details

If a doc link above is missing, open `apps/docs` in your editor or visit the docs site in dev mode: `npm run dev:docs`.

---

## How to add screenshots (recommended workflow)

1. Start the app locally and navigate to the page you want to capture.
2. Use a high-quality screenshot tool (macOS Grab, Windows Snipping Tool, or Browser > DevTools > Capture full size) and crop to 1200px wide (or similar). 
3. Save the image to `assets/screenshots/` with one of the suggested file names.
4. Commit the image and push.

Example:

```bash
mkdir -p assets/screenshots
# copy screenshot into assets/screenshots/homepage.svg
git add assets/screenshots/homepage.svg
git commit -m "docs: add homepage screenshot"
git push
```

---

## Contributing

Please follow the repository's contributing guidelines (see CLAUDE.md for process notes). Key points:

- Keep changes surgical. Touch only what's required by the task.
- Match existing code style and TypeScript strictness.
- Add tests for bug fixes or new features.
- Ensure CI passes before merging.

If you're unsure where to start, open an issue describing the goal and include screenshots or steps to reproduce.

---

## Troubleshooting & FAQs

- Q: Where are API routes?
  - A: In apps/storefront/app/api — there is no separate `apps/backend` project.

- Q: Which app is primary?
  - A: apps/storefront is the canonical app and includes most functionality.

---

## License

This repository's license should be specified in the repository root (LICENSE file). If missing, consult the project owner.

---

If you'd like, I can now:
- Replace the SVG placeholders with high-quality PNGs you upload, or
- Add a docs/index.md page inside `apps/docs/content/docs/` that links to this README and the site navigation.

Tell me which of those you'd like next and I'll proceed.
