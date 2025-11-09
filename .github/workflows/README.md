# GitHub Actions CI/CD

## Overview

This directory contains GitHub Actions workflows for automated CI/CD.

## Workflows

### CI Workflow (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**

1. **Lint & Type Check**
   - Runs ESLint
   - Runs TypeScript type checking
   - Ensures code quality

2. **Test**
   - Runs Vitest test suite
   - Validates application logic

3. **Build**
   - Generates Prisma client
   - Builds Next.js application
   - Uploads build artifacts
   - Only runs if lint and tests pass

## Viewing in Backstage

The CI/CD status is visible in Backstage:

1. Go to http://localhost:3000/catalog
2. Click "josemadridsalsa-web" component
3. Navigate to "CI/CD" tab
4. See workflow runs, status, and logs

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
