# Contributing to Jose Madrid Salsa

Thank you for your interest in contributing to the Jose Madrid Salsa e-commerce platform. This document outlines how to contribute effectively and in alignment with the project's standards.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Security Guidelines](#security-guidelines)
- [Documentation Standards](#documentation-standards)

---

## Getting Started

### Prerequisites

- **Node.js** 20 or 22 (use `.nvmrc` — run `nvm use`)
- **PostgreSQL** database (local or managed service)
- **Stripe** account (for payment testing)
- Git configured with your GitHub account

### Local Setup

```bash
# Clone the repository
git clone https://github.com/jordolang/josemadridsalsa.git
cd josemadridsalsa

# Use the correct Node version
nvm use

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Fill in required values — see apps/docs/content/docs/configuration/environment-variables.mdx

# Apply database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to confirm everything is running.

---

## Development Workflow

1. **Branch from `main`** — Create a focused branch:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make targeted changes** — Keep PRs small and focused on a single concern.

3. **Run the quality checks before committing:**
   ```bash
   npx vitest run       # Unit tests
   npm run lint         # ESLint
   npm run type-check   # TypeScript
   ```

4. **Commit with a meaningful message** — See [Commit Guidelines](#commit-guidelines).

5. **Open a Pull Request** — See [Pull Request Process](#pull-request-process).

---

## Code Standards

### Language & Style

- **TypeScript** — All new files must be TypeScript. No plain JavaScript except for config files.
- **Two-space indentation** — enforced by the linter.
- **Named exports** — Prefer named exports for shared modules.
- **Tailwind-first styling** — Use Tailwind utility classes; extract to `tailwind.config.ts` when reuse emerges.
- **Avoid inline styles** — All styling belongs in Tailwind classes.

### Component Patterns

- Keep components **functional and lean** — no class components.
- Use **React Server Components** (RSC) by default; opt into `'use client'` only when necessary.
- Co-locate server logic near the page that uses it.
- Shared UI belongs in `components/ui/`; storefront modules in `components/store/`.

### Module Aliases

Always use the `@/` alias to resolve modules:

```ts
// ✅ Correct
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';

// ❌ Avoid
import { prisma } from '../../lib/prisma';
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Route folders | `kebab-case` | `app/(public)/about/` |
| Component files | `PascalCase` | `ProductCard.tsx` |
| Utility / hook files | `camelCase` | `useCart.ts` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_CART_ITEMS` |
| Test files | Mirror source, `.test.ts` | `useCart.test.ts` |

### Validation

Use **Zod schemas** for all user input validation. Define schemas in `lib/` close to their feature domain. Never trust unvalidated data from `req.body` or search params.

---

## Commit Guidelines

Commits must lead with an **imperative verb** or **scoped prefix**:

```
Add: product comparison feature
Fix: cart total calculation on tax-exempt orders
Refactor: consolidate auth helpers into lib/auth
Chore: update Prisma to 6.19
Docs: update ENVIRONMENT_VARIABLES.md
```

### Rules

- **One logical change per commit** — Don't bundle unrelated changes.
- **Reference issues** when applicable: `Fix: broken checkout (#123)`
- **No WIP commits** — Squash before opening a PR.
- **No secrets** in commit messages or diffs — See [Security Guidelines](#security-guidelines).

---

## Pull Request Process

### Before Opening a PR

- [ ] All tests pass: `npx vitest run`
- [ ] Lint is clean: `npm run lint`
- [ ] Types are valid: `npm run type-check`
- [ ] If schema changed: `npm run db:generate` has been run and committed
- [ ] New env vars are documented in `apps/docs/content/docs/configuration/environment-variables.mdx`

### PR Description Template

```markdown
## Summary
Brief description of what this PR does and why.

## Changes
- List of key changes

## Testing
Steps to test the changes locally.

## Screenshots (UI changes)
Before / After screenshots or Loom clip.

## Checklist
- [ ] Tests pass
- [ ] Lint passes
- [ ] Type-check passes
- [ ] Docs updated (if applicable)
- [ ] No secrets committed
```

### Review Process

- At least **one approval** is required before merging.
- Address all review comments or explain why they are not applicable.
- Squash-merge into `main` using the PR title as the merge commit message.
- Delete the feature branch after merge.

---

## Testing Requirements

The project uses **Vitest** for unit and integration tests.

### Writing Tests

- Mirror the source structure: test for `lib/pricing.ts` lives at `tests/lib/pricing.test.ts`.
- Prioritize **domain logic** — pricing, validation, inventory math.
- Use `describe` / `it` blocks with descriptive names.
- Mock external services (Stripe, Resend, Google APIs) in tests.

### Running Tests

```bash
# Run entire suite
npx vitest run

# Watch mode (TDD)
npx vitest run --watch

# Coverage report
npx vitest run --coverage
```

### What Must Be Tested

- Every new utility function in `lib/`
- Schema validation logic
- API route handlers (at least the happy path + key error paths)
- Any bug fix should include a regression test

---

## Security Guidelines

> **These are non-negotiable.**

1. **Never commit secrets** — No API keys, passwords, tokens, or private keys in source code or documentation.
2. **Never commit `.env` files** — `.env`, `.env.local`, `.env.production` are gitignored. Keep them that way.
3. **Use environment variables** for all sensitive configuration — document them in `apps/docs/content/docs/configuration/environment-variables.mdx` by name only (no values).
4. **Rotate keys immediately** if a secret is accidentally exposed.
5. **Validate all input** with Zod before using it.
6. **Use parameterized queries** (Prisma handles this) — never build raw SQL strings.
7. **Report vulnerabilities privately** — See `SECURITY.md` for the disclosure process.

---

## Documentation Standards

- Project documentation lives in the in-repo **Fumadocs site** at `apps/docs/content/docs`, organized into `getting-started/`, `guides/`, `features/`, `configuration/`, `integrations/`, `deployment/`, and `api/`. Run it locally with `npm run dev:docs`.
- Docs-site pages are **`.mdx`** files with `title` and `description` frontmatter, named in **`kebab-case`** (e.g., `environment-variables.mdx`).
- Write clear, concise prose. Use tables and code blocks where they aid clarity.
- Do **not** create documentation files outside `apps/docs/content/docs` (except `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, and `CLAUDE.md` in the root).
- Do **not** include actual secret values in any documentation file.

---

## Questions

For questions about the codebase, open a GitHub Discussion or reach out to the maintainer.
