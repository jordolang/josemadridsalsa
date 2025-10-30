# Repository Guidelines

## Project Structure & Module Organization
Next.js 15 App Router code lives in `app/`, with route-specific layouts kept close to their pages. Shared UI belongs in `components/` (storefront modules live under `components/store`), reusable hooks in `hooks/`, and validation plus server helpers in `lib/`. Database schema and the generated Prisma client sit in `prisma/`, static assets in `public/`, type declarations in `types/`, maintenance tasks in `scripts/`, and automated specs in `tests/` as `*.test.ts`.

## Build, Test, and Development Commands
- `npm run dev` launches the Turbo dev server (add `:fast` for fixed port 3000 or `:debug` for Node inspect).
- `npm run build` compiles production assets; verify with `npm run start`.
- `npm run lint` and `npm run type-check` run ESLint (Next + Tailwind rules) and TypeScript.
- `npx vitest run` executes the suite in `tests/` (`--watch` for TDD).
- `npm run db:migrate`, `db:seed`, and `db:reset` manage Prisma migrations, seed data, and clean rebuilds.

## Coding Style & Naming Conventions
Use TypeScript with two-space indentation and favor named exports for shared modules. Keep components functional, lean, and Tailwind-first, creating utility classes in `tailwind.config.ts` when reuse emerges. Resolve modules through the `@/` alias, prefer kebab-case for route folders, PascalCase for components, and camelCase elsewhere. Run `npm run lint` before pushing; it enforces the Next + Tailwind ESLint rules.

## Testing Guidelines
Vitest backs validation and unit coverage. Mirror the folder of the code under test, naming files `*.test.ts`, and prioritize fast domain logic checks (schema, pricing, inventory). Each pull request should add or adjust tests for behavior changes and finish with green runs of `npx vitest run`, `npm run lint`, and `npm run type-check`.

## Commit & Pull Request Guidelines
Commits mirror current history: lead with an imperative verb or scoped prefix (`Fix:`, `Add:`) and bundle only related edits. Pull requests need a short summary, links to tickets, and a verification list covering lint, types, tests, and any Prisma work. Include screenshots or Loom clips for UI changes, and call out schema or environment adjustments so reviewers can run the right commands.

## Configuration & Environment Notes
Secrets live in `.env.local`; define `DATABASE_URL`, Stripe keys, and NextAuth secrets before running migrations. After schema updates run `npm run db:generate`, and document any new env vars in `docs/` to keep deploy pipelines aligned.
