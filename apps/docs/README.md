# @jose-madrid/docs

The Jose Madrid Salsa documentation site — a [Fumadocs](https://fumadocs.dev) (MDX)
app that is the **canonical home for all project documentation**.

This workspace was previously a standalone repository (`salsadocs`). It now lives in
the monorepo alongside the apps it documents, so a change to a feature and the doc
that describes it land in the same commit.

## Running it

From the repo root:

```bash
npm run dev:docs      # http://localhost:3002
```

Or from this directory: `npm run dev`.

## Where content lives

All pages are MDX under `content/docs`, organised into the sections registered in
`content/docs/meta.json`:

| Section | Purpose |
|---|---|
| `getting-started/` | First-run setup: environment, database |
| `guides/` | Task-oriented walkthroughs for humans |
| `features/` | What each product surface does and where its code lives |
| `configuration/` | Settings, env vars, framework config |
| `integrations/` | Third-party services and how they are wired |
| `deployment/` | Vercel, monitoring, security, operations |
| `api/` | REST API reference |

Conventions (also in the root `CLAUDE.md`, Part 14):

- Filenames are `kebab-case.mdx`.
- Every page needs `title` and `description` frontmatter.
- Each section has an `index.mdx` that links its pages — add new pages there or
  they are unreachable from the sidebar.
- Never put real secret values in a page.

## Deployment

The docs site is its **own Vercel project**, deployed from this monorepo with
**Root Directory = `apps/docs`**. `vercel.json` here restricts deployments to the
`main` branch and uses `turbo-ignore` so a commit that does not touch `apps/docs`
skips the docs build entirely — the storefront and the docs site deploy
independently even though they share a repository.

See [Monorepo Deployment](content/docs/deployment/monorepo.mdx) for the full
per-project setup.
