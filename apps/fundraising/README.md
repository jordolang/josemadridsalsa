# Fundraising app (`@jose-madrid/fundraising`)

The fundraising site and every fundraiser page: `/fundraising`, `/fundraisers/...`,
`/fundraise/...`, `/f/...`, `/arena/...`, the fundraiser portal and their APIs. It is
deployed as its own Vercel project at `fundraising.josemadridsalsa.com`. The main site
308-redirects those paths here (`apps/storefront/proxy.ts`), and this app sends
main-site pages such as `/products` and `/account` back (`next.config.mjs`).

Shared code (Prisma, auth, checkout, UI) comes from `packages/core`, and `@/` resolves
to this app first, then to core. The database schema lives in
`apps/storefront/prisma/schema.prisma`.

## Commands

Run from the repository root:

| Command | What it does |
|---|---|
| `npm run dev:fundraising` | Dev server on http://localhost:3001 |
| `npm run test --workspace=@jose-madrid/fundraising` | Vitest suite (`tests/`) |
| `npm run lint --workspace=@jose-madrid/fundraising` | ESLint |
| `npm run type-check --workspace=@jose-madrid/fundraising` | TypeScript |

## Environment

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Main site that main-site pages and `/images` go to (default `https://www.josemadridsalsa.com`) |
| `NEXT_PUBLIC_FUNDRAISING_SITE_URL` | This app's own public URL (default `https://fundraising.josemadridsalsa.com`) |

Everything else (database, auth, Stripe, BigCommerce) is shared with the main site; see
`.env.example` at the repository root.

## More

- [Fundraising Site](../docs/content/docs/features/fundraising-site.mdx): pages, routing and checkout
- [Shared Code Strategy](../docs/content/docs/guides/shared-code-strategy.mdx): what goes in `packages/core`
