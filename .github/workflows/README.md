# GitHub Actions CI/CD

## Overview

This directory contains GitHub Actions workflows for automated CI/CD.

## Workflows

### Copilot Setup Steps (`copilot-setup-steps.yml`)

Provisions the ephemeral environment GitHub Copilot's coding agent works in. GitHub runs the
`copilot-setup-steps` job (that exact job name is required) before handing the checkout to the
agent; the agent's own session has no package-registry access, so everything it needs at runtime
is installed here.

**Triggers:** `workflow_dispatch`, plus push/PR limited to this file so any change to it re-runs
the setup as a self-test.

**What it provisions:**

- Node 20 (from `.nvmrc`) with the npm cache keyed on the root lockfile, then `npm ci`
- A disposable Postgres 16 service, its schema synced with `prisma db push`
- `apps/storefront/.env` holding the database URLs and per-run throwaway values for
  `NEXTAUTH_SECRET`, `MASTER_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET`, and `RUN_INTEGRATION_TESTS=true`
- The catalogue and permission seeds, so the storefront and the RBAC-gated admin both work

Only `steps`, `permissions`, `runs-on`, `services`, `snapshot` and `timeout-minutes` are honoured
on this job — a job-level `env:` block is ignored, and variables exported to `$GITHUB_ENV` apply
only to the rest of the job, which is why the configuration is written to a file the agent's shell
will read. Real credentials for the agent belong in **Settings → Secrets and variables → Agents**
(Actions secrets are *not* passed to it).

### CI Workflow (`ci.yml`)

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `develop`
- By hand (**Actions → CI → Run workflow**), optionally with the Playwright suite

Main is not re-run after a merge: the pull request already ran the same code, and Vercel builds
main before deploying. Runs are skipped when a change touches only docs, Markdown or the desktop
apps, and a new push to a pull request cancels the run for the previous one. Each run is capped
at 30 minutes.

**One job, in order:** ESLint → TypeScript → Vitest (a single run that gates on failures and
writes the coverage report; the 60% thresholds report but do not gate) → Next.js build →
shipping E2E against the built app. The Playwright suite runs only when requested by hand, because
it currently hits its 10-minute limit without producing a result.

Actions minutes are billed against the account's budget. When the budget is spent, GitHub refuses
to start the job ("an Actions budget is preventing further use") and the check fails in seconds
with no steps; raise the spending limit under **Settings → Billing and plans**, or wait for the
monthly reset.

## Running Locally

Before pushing, run these commands locally:

```bash
# Lint
npm run lint

# Type check
npm run type-check

# Test
npm run test

# Build
npm run build
```

## Adding More Workflows

Create new workflow files in this directory:

- `deploy.yml` - Deployment workflow
- `security.yml` - Security scanning
- `dependencies.yml` - Dependency updates

## Workflow Status Badges

Add to README.md:

```markdown
![CI](https://github.com/jordolang/josemadridsalsa/workflows/CI/badge.svg)
```

## Environment Secrets

For workflows that need secrets:

1. Go to GitHub → Settings → Secrets and variables → Actions
2. Add secrets like:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `STRIPE_SECRET_KEY`

Use in workflows:
```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Troubleshooting

**Workflow not running?**
- Check branch name matches trigger
- Verify workflow file syntax
- Check GitHub Actions tab for errors

**Build failing?**
- Review logs in GitHub Actions
- Run commands locally first
- Check for missing dependencies

## Best Practices

- ✅ Keep workflows fast (< 10 minutes)
- ✅ Cache dependencies
- ✅ Run in parallel when possible
- ✅ Use matrix builds for multiple versions
- ✅ Add status checks to branch protection
