# Turborepo Architecture

The Jose Madrid platform is organized as an npm workspace managed by Turborepo.
Each application has an explicit deployment boundary so storefront, fundraising,
API, and iOS work cannot be deployed as the wrong product accidentally.

## Applications

| Workspace | Local port | Responsibility |
|---|---:|---|
| `@jose-madrid/storefront` | 3000 | Main commerce storefront, admin, and the legacy implementation during extraction |
| `@jose-madrid/fundraising` | 3001 | Fundraising-only public deployment boundary |
| `@jose-madrid/backend` | 3002 | API-only deployment boundary |
| `@jose-madrid/ios` | Expo | Expo/React Native iOS application |

## Transition Boundary

The original application was a tightly coupled full-stack Next.js deployment.
To preserve production behavior, `storefront` temporarily contains the existing
route implementations:

- `backend` forwards `/api/*` requests to `LEGACY_STOREFRONT_ORIGIN`.
- `fundraising` exposes only fundraising routes and forwards its API requests
  through `BACKEND_ORIGIN`.
- Main-store routes remain in `storefront` until each route family is extracted.

This is a migration boundary, not the final ownership model. New backend route
logic belongs in `apps/backend`; new fundraising-only UI belongs in
`apps/fundraising`. Do not add new fundraiser routes to `apps/storefront`.

## Local Development

```bash
npm install
npm run dev
```

`npm run dev` starts storefront, fundraising, and backend. Start Expo separately:

```bash
npm run dev:ios
```

Useful focused commands:

```bash
npm run dev:storefront
npm run dev:fundraising
npm run dev:backend
npm run build
npm run lint
npm run type-check
npm run test
```

## Deployment

Create three Vercel projects from the same repository and select these root
directories:

| Vercel project | Root directory | Required routing variables |
|---|---|---|
| Main storefront | `apps/storefront` | Existing storefront variables, `FUNDRAISING_APP_ORIGIN` |
| Fundraising | `apps/fundraising` | `LEGACY_STOREFRONT_ORIGIN`, `BACKEND_ORIGIN` |
| Backend | `apps/backend` | `LEGACY_STOREFRONT_ORIGIN` |

The forwarding origins must be HTTPS production origins in Vercel. Do not point
production forwarding variables at localhost.

Set `FUNDRAISING_APP_ORIGIN` on the main storefront project so public fundraising
URLs redirect to the fundraising deployment instead of rendering in the main
storefront.

## Extraction Order

1. Move shared database access and domain contracts into workspace packages.
2. Move API route families from storefront to backend, starting with read-only
   product and fundraiser endpoints.
3. Move fundraiser pages and components into fundraising.
4. Remove forwarded routes from storefront after production verification.
