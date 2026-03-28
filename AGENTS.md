# AI Agent Guidelines — Jose Madrid Salsa

This file defines the **mandatory standards** for every AI agent, automated assistant, and AI-powered tool operating within this repository. All agents **must** follow these guidelines on every interaction, without exception.

---

## Table of Contents

- [Core Principles](#core-principles)
- [Project Structure & Module Organization](#project-structure--module-organization)
- [Build, Test & Development Commands](#build-test--development-commands)
- [Coding Style & Naming Conventions](#coding-style--naming-conventions)
- [Testing Guidelines](#testing-guidelines)
- [Commit & Pull Request Guidelines](#commit--pull-request-guidelines)
- [Documentation Standards](#documentation-standards)
- [Configuration & Environment Notes](#configuration--environment-notes)
- [Security & Non-Negotiables](#security--non-negotiables)
- [Repository Organization Rules](#repository-organization-rules)

---

## Core Principles

Every AI agent operating in this repository must:

1. **Make minimal, surgical changes** — Address only what is explicitly requested. Do not refactor unrelated code.
2. **Preserve functionality** — Never alter logic, remove working features, or change behavior unless explicitly asked.
3. **Follow the conventions below** — These rules are not suggestions; they are the standard for this codebase.
4. **Validate changes** — Run lint, type-check, and tests after every meaningful change.
5. **Keep documentation current** — When adding features or changing behavior, update the relevant `docs/` file.
6. **Respect the non-negotiables** — See [Security & Non-Negotiables](#security--non-negotiables).

---

## Project Structure & Module Organization

```
josemadridsalsa/
├── app/                  # Next.js 15 App Router — pages, layouts, and API routes
│   ├── (public)/         # Public storefront (home, products, cart, checkout)
│   ├── (auth)/           # Authentication pages (sign-in, sign-up, reset)
│   ├── admin/            # Admin dashboard (protected, RBAC-gated)
│   ├── account/          # User account management
│   └── api/              # Serverless API routes (REST endpoints)
├── components/           # Shared React components
│   ├── ui/              # Primitive UI components (Radix UI + custom)
│   ├── store/           # Storefront-specific components
│   └── admin/           # Admin-specific components
├── hooks/                # Custom React hooks
├── lib/                  # Business logic, server helpers, validation schemas
├── prisma/               # Prisma schema, migrations, and seed scripts
├── public/               # Static assets (images, fonts, icons)
├── scripts/              # Maintenance and data migration scripts
├── tests/                # Automated test suite (*.test.ts)
├── types/                # Shared TypeScript type declarations
├── messages/             # i18n translation files (en.json, es.json)
└── docs/                 # All project documentation
```

**Key rules:**
- Route-specific layouts stay close to their pages inside `app/`.
- Storefront modules live under `components/store/`.
- All reusable hooks go in `hooks/`.
- Validation schemas and server helpers belong in `lib/`.
- Static assets live in `public/` — never in `app/` or `components/`.

---

## Build, Test & Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Turbo dev server |
| `npm run dev:fast` | Dev server on fixed port 3000 |
| `npm run dev:debug` | Dev server with Node inspect |
| `npm run build` | Compile production assets |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint (Next.js + Tailwind rules) |
| `npm run type-check` | TypeScript compiler check |
| `npx vitest run` | Run full test suite |
| `npx vitest run --watch` | TDD watch mode |
| `npm run db:migrate` | Apply pending Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed database with initial data |
| `npm run db:reset` | Drop and recreate database (destructive) |

**Required before any commit or PR:**
```bash
npx vitest run && npm run lint && npm run type-check
```

---

## Coding Style & Naming Conventions

### Language

- **TypeScript** — All source files must be TypeScript. Config files may use JavaScript.
- **Two-space indentation** — enforced by ESLint.
- **Named exports** — Prefer named exports for all shared modules.
- **No `any`** — Avoid TypeScript `any`; use proper types or `unknown`.

### Components

- All components are **functional** — no class components.
- Default to **React Server Components** (RSC). Use `'use client'` only when required.
- **Tailwind-first** styling. Extract repeated patterns into `tailwind.config.ts`.
- No inline styles.

### Module Resolution

Always use the `@/` alias:
```ts
// ✅ Correct
import { prisma } from '@/lib/prisma';
// ❌ Wrong
import { prisma } from '../../lib/prisma';
```

### Naming Conventions

| Item | Convention |
|------|-----------|
| Route folders | `kebab-case` |
| Component files | `PascalCase.tsx` |
| Hooks | `camelCase.ts` (prefix `use`) |
| Utilities / helpers | `camelCase.ts` |
| Constants | `UPPER_SNAKE_CASE` |
| Test files | Mirror source path, suffix `.test.ts` |
| Documentation files | `UPPER_SNAKE_CASE.md` |

---

## Testing Guidelines

- **Framework:** Vitest with jsdom, jest-dom matchers, and MSW for API mocking.
- **Location:** All tests live in `tests/` mirroring the source path.
  - Source: `lib/pricing.ts` → Test: `tests/lib/pricing.test.ts`
- **Coverage thresholds** are configured in `vitest.config.ts` — do not lower them.
- **Prioritize domain logic:** Pricing, validation, inventory, authentication.
- **Mock all external services:** Stripe, Resend, Google APIs, etc.
- Every bug fix must include a regression test.
- Every new utility function in `lib/` must have tests.

---

## Commit & Pull Request Guidelines

### Commit Message Format

```
<Prefix>: <imperative summary>

[Optional body: what changed and why]
[Optional footer: closes #issue]
```

**Accepted prefixes:** `Add`, `Fix`, `Refactor`, `Chore`, `Docs`, `Test`, `Remove`

**Examples:**
```
Add: product comparison feature
Fix: cart total incorrect for tax-exempt orders
Docs: update ENVIRONMENT_VARIABLES.md with new AI keys
Chore: update Prisma to 6.19
```

### Pull Request Requirements

Every PR must include:
- [ ] Summary of what changed and why
- [ ] Link to issue (if applicable)
- [ ] Verification checklist: tests ✓ lint ✓ types ✓
- [ ] Screenshots or Loom clip for any UI changes
- [ ] Note on any schema or environment variable changes

---

## Documentation Standards

- **All documentation lives in `docs/`** — no exceptions (except the root-level standard files below).
- **Root-level documentation files allowed:** `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`.
- **No documentation files elsewhere** — do not create `.md` files in `app/`, `lib/`, `scripts/`, etc.
- **File naming:** `UPPER_SNAKE_CASE.md` (e.g., `ENVIRONMENT_SETUP.md`).
- **Documentation hub:** `docs/index.md` — update it when adding new docs.
- **Versioning:** Maintain `CHANGELOG.md` with entries under `[Unreleased]` during development; tag on release.
- **No real values** in documentation — use placeholder names for env vars, never actual keys or passwords.

### Documentation Structure (docs/)

```
docs/
├── index.md                    # Documentation hub (always up-to-date)
├── ENVIRONMENT_SETUP.md        # Local development setup
├── ENVIRONMENT_VARIABLES.md    # All env var definitions (names only)
├── DATABASE.md                 # Database setup and troubleshooting
├── ENCRYPTION_SETUP.md         # Encryption configuration
├── NEXTAUTH_PRODUCTION_CONFIG.md  # NextAuth production setup
├── API.md                      # REST API reference
├── ADMIN_LOGIN_GUIDE.md        # Admin dashboard guide
├── STRIPE_WEBHOOK_SETUP.md     # Stripe webhook configuration
├── EMAIL_DNS_SETUP.md          # Email / DNS setup
├── GOOGLE_MAPS_SETUP.md        # Google Maps integration
├── GOOGLE_PLACES_SETUP.md      # Google Places integration
├── GOOGLE_REVIEWS_SETUP.md     # Google Reviews setup
├── GOOGLE_CALENDAR_SETUP.md    # Google Calendar integration
├── GITHUB_INTEGRATION.md       # GitHub Actions / CI
├── SHOPIFY_INTEGRATION.md      # Shopify data migration
├── SHOPIFY_WEBHOOK_SETUP.md    # Shopify webhook configuration
├── IMAGE_MANAGEMENT.md         # Image upload/management
├── PRODUCT_IMPORT.md           # Product import guide
├── PRODUCT_PHOTOGRAPHY.md      # Photography standards
├── PASSWORD_RESET_FEATURE.md   # Password reset flow
├── LOCATION_MAP_FEATURE.md     # Retail location map
├── JSDOC_CONVENTIONS.md        # JSDoc standards
├── PERFORMANCE.md              # Performance notes
├── openapi.yaml                # OpenAPI spec
├── import-infrastructure/      # Data import analysis docs
└── stripe/                     # Stripe-specific documentation
```

---

## Configuration & Environment Notes

- Secrets live in `.env.local` — **never commit this file**.
- Required variables before first run: `DATABASE_URL`, `NEXTAUTH_SECRET`, `MASTER_KEY`.
- After every schema change: run `npm run db:generate` and commit the generated client changes.
- Document any new environment variable in `docs/ENVIRONMENT_VARIABLES.md` by name and purpose — **never include actual values**.
- Production secrets are managed through **Vercel environment variables**.

---

## Security & Non-Negotiables

> These rules are **absolute**. No exceptions, no workarounds.

### ❌ NEVER Do This

1. **Commit API keys, secrets, tokens, or passwords** — Not in code, not in docs, not in comments.
2. **Commit `.env` files** of any kind (`.env`, `.env.local`, `.env.production`, etc.).
3. **Include actual secret values** in any documentation, README, or markdown file.
4. **Create documentation files outside `docs/`** (except the allowed root-level files listed above).
5. **Lower test coverage thresholds** — If tests are failing, fix the code, not the thresholds.
6. **Bypass the linter** — Fix lint errors; do not add `eslint-disable` comments without strong justification.
7. **Use `any` in TypeScript** without an explicit, justified comment.
8. **Modify unrelated code** while fixing a specific issue.

### ✅ ALWAYS Do This

1. **Validate all user input** with Zod schemas before processing.
2. **Use parameterized queries** through Prisma — never build raw SQL strings.
3. **Run the quality checks** (`vitest run`, `lint`, `type-check`) before any commit.
4. **Keep the `docs/` directory clean** — Only documented, purposeful files.
5. **Update `CHANGELOG.md`** when adding a feature, fixing a bug, or making a breaking change.
6. **Report discovered security vulnerabilities** privately per `SECURITY.md`.

---

## Repository Organization Rules

Agents performing repository maintenance or cleanup must follow these rules:

1. **Root directory** — Only configuration files, standard documentation (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`), and Next.js/tooling config files belong here. No log files, no temp scripts, no one-off verification reports.

2. **Docs directory** — Only structured, purposeful documentation. No session summaries, no phase completion reports, no temp notes, no content files (recipes, product descriptions, etc.).

3. **Naming** — Documentation files follow `UPPER_SNAKE_CASE.md`. No spaces in filenames. No mixed-case inconsistencies.

4. **Consolidation** — When multiple files cover the same topic, merge them into a single authoritative document and delete the redundant files.

5. **No junk files** — `DS_Store`, `*.bak`, `*.log`, `analyzer.log`, `dev-server.log`, temp scripts, and verification reports must not be committed to the repository.

6. **`.gitignore` maintenance** — Ensure `.gitignore` prevents common junk files from being committed (`.DS_Store`, `*.log`, `*.bak`, etc.).

