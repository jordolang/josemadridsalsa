# CLAUDE.md

The authoritative onboarding guide for any AI agent working in this repository. Read it in full before acting — it describes how to work here, the architecture, the stack, and the non-negotiables. It merges general engineering discipline with the project-specific facts you need so you rarely have to be told them.

---

## Part 1 — How to Work in This Repo

These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what's confusing, and ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked; no abstractions for single-use code.
- No "flexibility"/"configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it. Ask: "Would a senior engineer say this is overcomplicated?"

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting; don't refactor what isn't broken.
- Match existing style even if you'd do it differently.
- Remove imports/variables your change orphaned; don't delete pre-existing dead code unless asked — mention it instead.
- The test: every changed line traces directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- "Add validation" → "Write tests for invalid inputs, then make them pass."
- "Fix the bug" → "Write a test that reproduces it, then make it pass."
- "Refactor X" → "Ensure tests pass before and after."
- For multi-step tasks, state a brief plan with a verification check per step.

---

## Part 2 — What This Project Is

**Jose Madrid Salsa** is the production e-commerce, fundraising, and business-management platform for a salsa company based in Zanesville, Ohio.

- **Production storefront:** https://www.josemadrid.net
- **Legacy store being migrated from:** BigCommerce at josemadridsalsa.com (feature-parity/cutover work is ongoing — see `apps/docs/content/docs/guides/ordering-system-comparison.mdx`).

It is a large, mature application: a public storefront, customer accounts, multi-provider checkout, a full fundraising platform (with a gamified "battle arena"), an email-marketing suite, social-commerce publishing, a QuickBooks-synced financials back office, and a role-based admin console — all in one primary Next.js app.

---

## Part 3 — Architecture

A **Turborepo** monorepo using **npm workspaces** (`npm@11.12.1`, Node **20** per `.nvmrc`). Workspaces are globbed from `apps/*` and `packages/*`; the task graph lives in `turbo.json`.

```
josemadridsalsa/
├── apps/
│   ├── storefront/     # PRIMARY app — storefront, accounts, checkout, admin,
│   │                   #   POS, and most API routes
│   ├── fundraising/    # Fundraising site + all fundraiser pages/APIs (port 3001)
│   ├── admin/          # Standalone role-based admin app (port 3003)
│   └── docs/           # Fumadocs documentation site (port 3002) — canonical docs home
├── packages/
│   └── core/           # Code shared by storefront + fundraising (@/ falls back to it)
├── package.json        # npm workspace + turbo scripts
└── turbo.json          # Turborepo task graph
```

**Key fact:** `apps/storefront` is where most product code lives — including the admin dashboard (`app/admin`, which also manages fundraisers), POS, and most API routes (`app/api`). **`apps/fundraising`** is its own deployment: the fundraising site (`app/(site)`), and every public fundraiser page, the fundraiser portal, the arena and their APIs; the storefront redirects those paths to it. The fundraiser mobile app's API (`/api/fundraiser-app`) and all webhooks stay in the storefront. The `admin` workspace is secondary; when in doubt about non-fundraiser work, use `storefront`. There is **no** `apps/backend` (a phantom left over from a reverted function-split; API handlers live in `apps/storefront/app/api`).

**`packages/core`** holds the code more than one app imports (Prisma, auth, RBAC, email, UI primitives, fundraising domain logic). It mirrors the storefront's layout, and each app's `@/` alias resolves to the app first, then to core, so `@/lib/prisma` works everywhere. Core must never import from an app (`npm run type-check --workspace=@jose-madrid/core` enforces it). See `apps/docs/content/docs/guides/shared-code-strategy.mdx`.

An iOS native app lives under `apps/ios/**` (not an npm workspace; build artifacts are gitignored).

### Dev servers (each on a distinct port)
| App | Command | URL |
|---|---|---|
| storefront | `npm run dev` | http://localhost:3000 |
| fundraising | `npm run dev:fundraising` | http://localhost:3001 |
| docs | `npm run dev:docs` | http://localhost:3002 |
| admin | `npm run dev:admin` | http://localhost:3003 |

`npm run dev:all` runs everything via Turbo. `npm run dev:fast` / `dev:debug` target the storefront (fixed port / Node inspect).

---

## Part 4 — Technology Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo, npm workspaces, Node 20 |
| Framework | Next.js **16** (App Router, RSC) |
| UI runtime | React **19** |
| Language | TypeScript **5.9** (strict; `@/` path alias) |
| Styling | Tailwind CSS **4**, Shadcn UI / Radix UI |
| Database | PostgreSQL via Prisma ORM **6** (`prisma-client-js`) |
| Auth | NextAuth **4** with `@auth/prisma-adapter` |
| Payments | Stripe **19**, PayPal, Square **43**, in-person POS |
| Shipping | EasyPost (via `SHIPPING_PROVIDER`) |
| Tax | Stripe Tax (`lib/tax-calculator.ts`) |
| Email | Resend **6** + Nodemailer **8** |
| Validation | Zod **4** + React Hook Form |
| Testing | Vitest **4** (jsdom, jest-dom, MSW), Playwright |
| Monitoring | Sentry, Amplitude, Vercel Analytics |
| AI | Anthropic (AI chat + RAG in `lib/ai-rag`, `app/api/ai-chat`) |
| Uploads | UploadThing |
| Docs site | Fumadocs (MDX) |
| Deployment | Vercel |

Prefer the latest, most capable Claude models when building AI features (`ANTHROPIC_API_KEY`).

---

## Part 5 — Storefront Layout (`apps/storefront`)

- **`app/`** route groups: `(public)`, `admin`, `auth`, `cart`, `order-confirmation`, `pos`, `avatar`, plus `api`. (The fundraiser pages, `fundraise`, `(fundraiser-portal)`, `(fundraiser-subdomain)`, `game-icons` and `s`, are in `apps/fundraising`.)
- **`app/api/`** (~50 groups): `checkout`, `payment(s)`, `orders`, `cart`, `products`, `salsas`, `recipes`, `reviews`, `recommendations`, `gift-certificates`, `loyalty`, `fundraiser-app` (mobile app API), `social`, `integrations`, `developer`, `admin`, `account`, `ai-chat`, `chat-handoff`, `heat-index`, `newsletter`/`unsubscribe`/`send-email`, `locations`/`places`, `calendar`, `feeds`, `forms`, `live`, `pos`, `track`, `cron`, `uploadthing`, and **`webhooks/`** (`stripe`, `paypal`, `square`, `easypost`, `resend`).
- **`lib/`** domain modules (~60): `payments`, `stripe`, `quickbooks`, `orders`, `financials`, `fundraising`/`fundraisers`, `arena`, `events`, `email`, `social`, `merchandise`, `gift-certificates`, `loyalty` (`loyalty.ts`), `inventory` (`inventory-manager.ts`, `inventory-alerts.ts`), `shipping` (`shipping-calculator.ts`, `shipping-api.ts`, `shipping-carriers.ts`), `tax-calculator.ts`, `recommendations.ts`, `discounts.ts`, `blog`, `seo`, `ai-rag`, `chat`, `forms`, `locations`, `analytics`, `tracking`, `notifications`, `training-data`, `customers`, `users`, `feeds`, `rate-limit`, plus core helpers: `prisma.ts`, `rbac.ts`, `admin-auth.ts`, `fundraiser-auth.ts`, `crypto.ts`, `validation(s)`, `logger.ts`, `errors.ts`, `csv.ts`.
- **`components/`**: `ui` (Shadcn primitives), `store`, `admin`, `account`, `cart`, `checkout`, `products`, `reviews`, `fundraiser`/`fundraiser-portal`/`fundraising`, `arena`, `chat`, `messaging`, `dashboard`, `heat-index`, `social`, `seo`, `analytics`, `forms`, `providers`.
- **`prisma/`**: `schema.prisma` (+ migrations, seeds).
- **`emails/`**: transactional/marketing email templates.
- **`tests/`**: mirror source paths.

---

## Part 6 — Data Layer

- **PostgreSQL + Prisma 6.** Schema at `apps/storefront/prisma/schema.prisma` — a large domain model (**~145 models**, ~80 enums).
- **Two connection strings:** `DATABASE_URL` (pooled, app runtime) and `DATABASE_URL_UNPOOLED` (direct, migrations). Production uses Prisma Accelerate / a pooled Postgres host; migrations run against the unpooled URL.
- **After any schema change:** run `npm run db:generate` and commit the generated client changes. Never edit generated client output by hand.
- **Never build raw SQL** — always go through Prisma. Watch for Prisma `P2021` (missing table) handling via `lib/prisma-errors.ts` (`isMissingTableError`).

**Domain map (high level):**
- **Commerce** — `Product`/`ProductVariant`/`Category`, `Cart`/`AbandonedCart`, `Order`/`OrderItem`, `Payment`/`Refund`/`PaymentProviderConfig`, `DiscountCode`, `GiftCertificate`, `Review`/`SiteReview`, `Inventory*`, `NutritionalInfo`/`Ingredient`. Heat is modeled via the `HeatLevel` enum.
- **Identity & access** — `User` (`UserRole` enum, incl. `DEVELOPER` super admin), `Customer` (`CustomerSource`), `Address`, `LoyaltyAccount`/points/rewards, `Permission`/`RolePermission`, `ServiceCredential`/`CredentialAccessGrant`, `PasswordResetToken`.
- **Fundraising & arena** — `Fundraiser`, `FundraiserParticipant`, `FundraiserTeam`, `FundraiserSeason`, `FundraiserCharacter`, `FundraiserAccount`/`Profile`/`Access`, gamification (`FundraiserGamification`, `GamificationAction`), arena (`FundraiserSaleEvent`(+reactions/replies), `FundraiserShield`(+grants), `FundraiserShareEvent`/`Nonce`, `FundraiserChampionship`), `WholesaleAccount`, leads (`LeadCampaign`/`Lead`).
- **Email marketing** — `EmailCampaign`/`EmailRecipient`/`EmailLog`, `EmailTemplate`(+versions/compositions), `EmailAutomation`/`AutomationStep`/`Enrollment`, `MailingList`/`Subscriber`, `EmailSegment`, `EmailBounce`/`Suppression`/`UnsubscribePreference`, `BrandKit`.
- **Social commerce** — `SocialAccount`, `SocialMediaPost`(+publishes/media), `SocialPlatformCredential`, `ShopListing` (`ShopPlatform`).
- **QuickBooks** — `QuickBooksAppCredential`, `QuickBooksConnection`, `QuickBooksSyncRecord`, `QuickBooksEntityMap`, `QuickBooksSettings`.
- **Events / shows** — `FeaturedEvent`, `EventStaff`/`EventContact`, `EventManifest`/`EventManifestItem`.
- **Content & SEO** — `BlogPost`/`BlogSeries`/`BlogCategory` (the "Heat Index" editorial section), `Recipe`, `Media`, `TrainingDocument`, `DeveloperBlogPost`/`DeveloperPageContent`, `SeoConfiguration`/`StructuredData`.
- **Ops** — `AuditLog`, `Notification`, `WebhookEvent`, `ShippingCarrier`/`ShippingLabel`, `ThirdPartyIntegration`, `ContactSubmission`.

---

## Part 7 — Auth, RBAC & Credentials

- **NextAuth 4** with the Prisma adapter. Session/role helpers live in `lib/rbac.ts`, `lib/admin-auth.ts`, `lib/user-role.ts`; fundraiser-scoped auth in `lib/fundraiser-auth.ts`.
- **Roles** are the `UserRole` enum. **`DEVELOPER` is the platform super admin** with exclusive `developer:*` permissions and the `/admin/developer` console; the designated developer account is auto-promoted at sign-in (`npm run create-developer` promotes manually; `npm run create-admin` for admins).
- **Fine-grained permissions** via `Permission`/`RolePermission` (seed with `npm run db:seed:permissions`). Missing permission tables fall back safely (see `lib/prisma-errors.ts`).
- **Credential vault:** third-party secrets can be stored encrypted in `ServiceCredential` and shared via `CredentialAccessGrant`. Encryption uses `MASTER_KEY` / `ENCRYPTION_KEY` (`lib/crypto.ts`). Grant access with `npm run credentials:grant-access`.

---

## Part 8 — Payments, Checkout, Shipping, Tax

- **Providers:** Stripe (Checkout Sessions + Elements), PayPal (create/capture order), Square, and in-person POS (`app/pos`, `app/api/pos`). Provider/channel are modeled by `PaymentProvider`/`PaymentChannel`; default is `STRIPE`.
- **Webhooks** finalize orders: `app/api/webhooks/{stripe,paypal,square}` mark `Payment` SUCCEEDED / `Order` PROCESSING; `easypost` for shipping, and `resend` for email events.
- **Tax:** Stripe Tax via `lib/tax-calculator.ts`. **Shipping:** EasyPost via `lib/shipping-*` (`SHIPPING_PROVIDER`, origin address env vars, `SHIPPING_TEST_MODE`).
- **Inventory** is decremented transactionally on successful payment (`lib/inventory-manager.ts`), firing `InventoryAlert`s when low.

---

## Part 9 — Integrations

Configured by env vars (Part 10); most are optional and degrade gracefully when unset.

- **QuickBooks Online** (`intuit-oauth`, `lib/quickbooks`) — OAuth connect + sync of paid orders, refunds (as RefundReceipts), and live P&L / expenses / bills / vendor balances into the financials dashboard. **QuickBooks Online is the source of truth for accounting** (see the QuickBooks integration plan in project memory).
- **Google** — Maps, Places (store locator), Calendar (events), Analytics reporting, Merchant Center / Shopping feeds, service-account auth.
- **Social commerce** — Facebook/Meta, TikTok Shop, Twitter/X, Amazon SP-API; verified OAuth session flow with explicit destination-account selection.
- **Scraping / research** — BrightData, SerpAPI, Browserless (`lib/scraper`).
- **AI** — Anthropic-powered chat + RAG (`lib/ai-rag`, `app/api/ai-chat`).
- **Uploads** — UploadThing. **Feature flags** — database `isActive` fields. **Monitoring** — Sentry / Amplitude / Vercel Analytics.

---

## Part 10 — Environment & Configuration

- Secrets live in **`.env.local`** (never commit). Copy from `.env.example` (~71 documented keys). Production secrets are managed in **Vercel environment variables**.
- **Required before first run:** `DATABASE_URL`, `NEXTAUTH_SECRET`, `MASTER_KEY` (plus `ENCRYPTION_KEY` for the credential vault, and `NEXTAUTH_URL`). `DATABASE_URL_UNPOOLED` is needed for migrations; `CRON_SECRET` guards `app/api/cron`.
- Document any **new** env var by name and purpose in `apps/docs/content/docs/configuration/environment-variables.mdx` — **never include actual values** anywhere.

---

## Part 11 — Commands

**Required before any commit or PR:**
```bash
npm run test && npm run lint && npm run type-check && npm run build
```

| Command | Purpose |
|---|---|
| `npm run dev` / `dev:all` / `dev:fast` / `dev:debug` | Dev servers (storefront / all / fixed port / inspect) |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `type-check` | ESLint (Next + Tailwind) / `tsc` |
| `npm run test` / `test:e2e` | Vitest suite (Turbo) / Playwright |
| `npm run db:migrate` / `db:generate` / `db:seed` | Migrate / regenerate client / seed |
| `npm run db:studio` / `db:reset` | Prisma Studio / drop & recreate (destructive) |
| `npm run version:feature` / `version:increment` / `version:major` | Cut a release — see Part 15 |

The storefront workspace has many operational scripts (`npm run <name> --workspace @jose-madrid/storefront`): seeds (`db:seed:permissions|recipes|nutrition|email-templates|fundraiser`), `create-admin` / `create-developer`, `credentials:grant-access`, location tooling (`locations:import|geocode|photos`), `products:import`/`transform`, `email:mass-send`, `security:scan`/`baseline`, and production DB helpers (`db:production:*`). Prefer these over ad-hoc scripts.

---

## Part 12 — Coding Standards & Conventions

- **TypeScript everywhere** (config files may be JS). Two-space indent (ESLint-enforced). Prefer **named exports**. **No `any`** without an explicit, justified comment — use `unknown`.
- **Components are functional.** Default to **React Server Components**; add `'use client'` only when required. **Tailwind-first**, no inline styles; extract repeated patterns into `tailwind.config.ts`. Shared primitives in `components/ui/`, storefront modules in `components/store/`.
- **Always use the `@/` alias** (`@/lib/prisma`), never deep relative paths.
- **Validate all user input with Zod** before use — never trust `req.body`/search params. Define schemas near their feature in `lib/`.
- **Naming:** route folders `kebab-case`; components `PascalCase.tsx`; hooks `useCamelCase.ts`; utilities `camelCase.ts`; constants `UPPER_SNAKE_CASE`; tests mirror source with `.test.ts`.

---

## Part 13 — Testing

- **Vitest** (jsdom, jest-dom, MSW) for unit/component/integration; **Playwright** for E2E.
- Tests live in the owning workspace and mirror the source path (`lib/pricing.ts` → `tests/lib/pricing.test.ts`).
- **Do not lower coverage thresholds** (configured per workspace `vitest.config.ts`) — fix the code, not the threshold.
- Prioritize domain logic: pricing, validation, inventory, auth, discounts, tax/shipping. **Mock all external services** (Stripe, Resend, Google, QuickBooks, etc.).
- Every bug fix ships a regression test; every new `lib/` utility ships tests.

---

## Part 14 — Documentation Standards

- **Project documentation lives in the in-repo Fumadocs site** at `apps/docs/content/docs`, organized into `getting-started/`, `guides/`, `features/`, `configuration/`, `integrations/`, `deployment/`, and `api/`. This is the canonical docs home (an external `salsadocs` mirror is published from the admin panel; treat `apps/docs` as the source of truth). Run it with `npm run dev:docs`.
- Docs-site pages are **`.mdx`** with `title` + `description` frontmatter, named in **`kebab-case`**.
- **Root-level docs allowed:** `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md` — these use `UPPER_SNAKE_CASE.md` naming.
- **No stray docs elsewhere** — no `.md` files in `app/`, `lib/`, `scripts/`, or root beyond the above; no one-off verification reports or session summaries in the repo.
- Keep `CHANGELOG.md` current under `[Unreleased]` (Keep a Changelog + SemVer). No real secret values in any doc.

---

## Part 15 — Commit & Pull Request Guidelines

Commit format — `<Prefix>: <imperative summary>`; accepted prefixes: `Add`, `Fix`, `Refactor`, `Chore`, `Docs`, `Test`, `Remove`. One logical change per commit; reference issues (`Fix: broken checkout (#123)`); no WIP commits; no secrets in messages or diffs.

**Versioning.** The project version is `MAJOR.MINOR` with an optional letter — a large feature bumps the minor (`2.0` → `2.1`), everything smaller takes a letter (`2.1` → `2.1a`), and `2.x` → `3.0` happens **only when explicitly asked**. Cut a release with `npm run version:feature` / `version:increment`, which bumps every workspace and closes off the `[Unreleased]` changelog section. `projectVersion` in the root `package.json` is canonical; `version` is the derived SemVer npm needs. Full rule: `apps/docs/content/docs/guides/versioning.mdx`. Do not hand-edit version numbers.

Every PR includes: a summary of what/why, linked issue if any, the verification checklist (tests ✓ lint ✓ types ✓), screenshots/Loom for UI changes, and a note on any schema or env-var changes. Squash-merge into `main`; delete the branch after merge.

---

## Part 16 — Security & Non-Negotiables

> Absolute rules. No exceptions, no workarounds.

**NEVER:**
1. Commit API keys, secrets, tokens, or passwords — not in code, docs, or comments.
2. Commit `.env` files of any kind.
3. Include actual secret values in any documentation or markdown.
4. Create stray documentation files outside `apps/docs/content/docs` (except the allowed root files).
5. Lower test coverage thresholds — fix the code.
6. Bypass the linter (`eslint-disable` needs strong justification).
7. Use `any` without an explicit, justified comment.
8. Modify unrelated code while fixing a specific issue.

**ALWAYS:**
1. Validate all user input with Zod.
2. Use parameterized queries through Prisma — never raw SQL strings.
3. Run `vitest run`, `lint`, and `type-check` before any commit.
4. Keep the docs site (`apps/docs`) current — only purposeful files.
5. Update `CHANGELOG.md` for features, fixes, and breaking changes.
6. Report security vulnerabilities privately per `SECURITY.md`.

---

## Part 17 — Repository Organization Rules

1. **Root** holds only config files and the allowed standard docs — no logs, temp scripts, or one-off reports.
2. **Docs** (`apps/docs/content/docs`) holds only structured, purposeful documentation — no session summaries, phase reports, temp notes, or content files (recipes/product copy).
3. **Naming** — root standard docs `UPPER_SNAKE_CASE.md`; docs-site pages `kebab-case.mdx`; no spaces in filenames.
4. **Consolidate** overlapping docs into one authoritative file; delete redundant ones.
5. **No junk files** (`.DS_Store`, `*.bak`, `*.log`, temp scripts, verification reports) in the repo.
6. **Maintain `.gitignore`** so common junk never lands. The local multi-GB `Documents/` business-data directory is gitignored and must stay out of version control.

---

## Part 18 — Search & Indexing Rules

Google's guidance, bound to this repo. Applies to **any** change that adds, moves, or removes a public URL. Shipping a page Google cannot find is an unfinished task.

**Adding new content**
1. **Register the URL** in `apps/storefront/app/sitemap.ts` — collections (products, recipes, blog posts, locations) come from Prisma there, so extend the query rather than hardcoding a row. A page absent from the sitemap is a page you asked Google not to crawl.
2. **Decide crawlability deliberately.** `robots: { index: false }` in page metadata keeps a reachable page out of the index; `app/robots.ts` and the `SeoConfiguration.robotsTxt` row stop the crawl of whole trees. `/admin/` and `/api/` stay disallowed. The two are not interchangeable — a page blocked in robots.txt is never read, so a `noindex` tag on it is never seen.
3. **Meta title 30–60 characters, meta description ≤160.** Enforced for blog posts in `lib/blog/schemas.ts` against effective values (`seoTitle ?? title`, `seoDescription ?? excerpt`); hold every other page to the same numbers.
4. **Hand off what you cannot do.** No agent has Search Console access. End the task by telling the human to run **URL Inspection** on the new URL, and to confirm a few weeks later that indexed-page count is rising.

**Adding new properties** — prefer one responsive site. A separate mobile or regional property must be added to Search Console and linked with `<link rel="alternate">`; country- or language-specific pages follow Google's international/multilingual guidelines (hreflang).

**Changing the domain** — update `SeoConfiguration.siteUrl` and every hardcoded canonical in the same change, then tell the human to run Search Console's **Change of Address** tool. It is never a code-only change.

**Removing a page** — default to deleting or 301-redirecting it and letting Google drop it. Only when live content is wrong, private, or damaging: remove it from the web first, then hand the **Removals** tool to the human. To keep a page online but unlisted, use `noindex`, not deletion.

> **Never report a Search Console step as done.** URL Inspection, Removals, and Change of Address are always handoff items.
