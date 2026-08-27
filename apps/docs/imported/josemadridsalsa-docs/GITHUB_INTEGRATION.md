# GitHub Integration Configuration Guide

## Overview

This guide provides comprehensive documentation for configuring GitHub integrations for the `jose-madrid-salsa` repository, including:

- **GitHub Actions CI/CD Pipeline**: Automated testing, building, and deployment workflows
- **Linear Integration**: Bidirectional issue tracking and PR synchronization
- **Branch Protection**: Repository security and code quality enforcement
- **Secrets Management**: Secure environment variable configuration

## Table of Contents

1. [GitHub Actions CI/CD Setup](#github-actions-cicd-setup)
2. [Linear Integration](#linear-integration)
3. [Branch Protection Rules](#branch-protection-rules)
4. [Secrets and Environment Variables](#secrets-and-environment-variables)
5. [Troubleshooting](#troubleshooting)

---

# GitHub Actions CI/CD Setup

## CI Pipeline Overview

The repository uses GitHub Actions for continuous integration and deployment. The main CI workflow runs on every push to `main` and `develop` branches, as well as on all pull requests targeting these branches.

### Pipeline Features

- **Automated Testing**: Unit tests with coverage reporting
- **Code Quality**: Linting and type checking
- **E2E Testing**: Playwright browser tests
- **Build Verification**: Production build validation
- **Coverage Reporting**: Automatic PR comments with test coverage
- **Artifact Management**: Build and test report uploads

### Workflow Configuration

Location: `.github/workflows/ci.yml`

```yaml
name: CI
permissions:
  contents: read
  pull-requests: write

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
```

## CI Pipeline Steps

### 1. Code Checkout

```yaml
- name: Checkout code
  uses: actions/checkout@v4
```

**Purpose**: Retrieves the repository code at the commit being tested.

### 2. Node.js Setup

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'
```

**Purpose**: Configures Node.js 22 environment with npm dependency caching for faster builds.

### 3. Dependency Installation

```yaml
- name: Install dependencies
  run: npm ci
```

**Purpose**: Clean install of dependencies from `package-lock.json` for reproducible builds.

**Note**: Uses `npm ci` instead of `npm install` for:
- Faster installation
- Exact dependency versions from lockfile
- Automatic removal of `node_modules` before install

### 4. Code Quality Checks

#### Linting

```yaml
- name: Run linter
  run: npm run lint
```

**Purpose**: Validates code style and catches common errors using ESLint.

**Configuration**: See `.eslintrc.json` for linting rules.

#### Type Checking

```yaml
- name: Run type check
  run: npm run type-check
```

**Purpose**: Validates TypeScript types without emitting JavaScript files.

### 5. Unit Testing with Coverage

```yaml
- name: Run tests with coverage
  run: npm run test -- --coverage
  env:
    CI: true
```

**Purpose**: Executes Jest test suite with coverage collection.

**Environment**:
- `CI=true`: Enables CI-specific test behaviors (non-watch mode, no interactive prompts)

**Coverage Reports**:
- HTML report: `coverage/lcov-report/index.html`
- JSON summary: `coverage/coverage-summary.json`
- LCOV data: `coverage/lcov.info`

### 6. Coverage Artifact Upload

```yaml
- name: Upload coverage reports
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: coverage-reports
    path: coverage/
    retention-days: 30
```

**Purpose**: Preserves coverage reports for 30 days, accessible from workflow run.

**Note**: Runs even if tests fail (`if: always()`).

### 7. PR Coverage Reporting

```yaml
- name: Post coverage report to PR
  if: github.event_name == 'pull_request'
  uses: ArtiomTr/jest-coverage-report-action@v2
  with:
    coverage-file: ./coverage/coverage-summary.json
    base-coverage-file: ./coverage/coverage-summary.json
    annotations: none
    package-manager: npm
    test-script: npm run test -- --coverage
```

**Purpose**: Automatically comments on PRs with coverage statistics and changes.

**Features**:
- Coverage percentage by file
- Coverage trend (increased/decreased)
- Failed test details
- Links to full coverage report

### 8. Database Client Generation

```yaml
- name: Generate Prisma Client
  run: npm run db:generate
```

**Purpose**: Generates Prisma client types required for build and E2E tests.

**Note**: Must run before build step.

### 9. Production Build

```yaml
- name: Build application
  run: npm run build
  env:
    SKIP_ENV_VALIDATION: true
```

**Purpose**: Validates that code builds successfully for production.

**Environment**:
- `SKIP_ENV_VALIDATION=true`: Skips environment variable validation in CI (secrets not available)

### 10. E2E Testing Setup

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
```

**Purpose**: Installs Chromium browser and system dependencies for E2E testing.

**Note**: Only installs Chromium (not all browsers) to reduce CI time.

### 11. E2E Test Execution

```yaml
- name: Run Playwright E2E tests
  run: npx playwright test
  env:
    CI: true
```

**Purpose**: Executes end-to-end browser tests using Playwright.

**Configuration**: See `playwright.config.ts` for test settings.

### 12. E2E Test Results Upload

```yaml
- name: Upload Playwright test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

**Purpose**: Preserves Playwright HTML reports and trace files for debugging.

**Access**: Download from workflow run artifacts to view detailed test results.

### 13. Build Artifact Upload (Main Branch Only)

```yaml
- name: Upload build artifacts
  if: github.ref == 'refs/heads/main'
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: .next
    retention-days: 7
```

**Purpose**: Preserves production build for potential deployment.

**Conditions**: Only runs on main branch pushes.

**Retention**: Kept for 7 days (shorter than test artifacts).

## Setting Up GitHub Actions

### Prerequisites

- Repository admin access
- GitHub Actions enabled for repository
- Required secrets configured (see [Secrets Management](#secrets-and-environment-variables))

### Initial Setup

1. **Verify Workflow File**

   ```bash
   # Ensure workflow file exists
   ls -la .github/workflows/ci.yml
   ```

2. **Enable GitHub Actions**

   - Navigate to repository Settings → Actions → General
   - Under "Actions permissions", select:
     - ✅ Allow all actions and reusable workflows
   - Under "Workflow permissions", select:
     - ✅ Read and write permissions
     - ✅ Allow GitHub Actions to create and approve pull requests

3. **Configure Branch Protection** (see [Branch Protection Rules](#branch-protection-rules))

4. **Test Workflow**

   ```bash
   # Create a test branch and PR
   git checkout -b test/ci-workflow
   git commit --allow-empty -m "Test CI workflow"
   git push origin test/ci-workflow
   # Create PR and observe workflow run
   ```

### Monitoring Workflow Runs

#### Via GitHub UI

1. Navigate to repository → Actions tab
2. View workflow runs by:
   - Branch
   - Status (success, failure, in progress)
   - Trigger event (push, pull_request)
3. Click on a run to see:
   - Job execution logs
   - Step duration
   - Artifact downloads
   - Re-run options

#### Via GitHub CLI

```bash
# List recent workflow runs
gh run list --workflow=ci.yml --limit 10

# View specific run details
gh run view <run-id>

# Download artifacts
gh run download <run-id>
```

### Debugging Failed Workflows

1. **Check Job Logs**
   - Click on failed step in workflow run
   - Expand log output
   - Look for error messages and stack traces

2. **Download Artifacts**
   - Download coverage reports or Playwright results
   - Open HTML reports locally for detailed analysis

3. **Re-run Failed Jobs**
   - Click "Re-run failed jobs" button
   - Useful for transient failures (network issues, flaky tests)

4. **Local Reproduction**
   ```bash
   # Reproduce CI environment locally
   npm ci
   npm run lint
   npm run type-check
   npm run test -- --coverage
   npm run db:generate
   npm run build
   npx playwright install --with-deps chromium
   npx playwright test
   ```

## Customizing the CI Pipeline

### Adding New Steps

1. **Edit Workflow File**
   ```yaml
   - name: Custom Step
     run: npm run custom-command
   ```

2. **Test Locally First**
   ```bash
   npm run custom-command
   ```

3. **Commit and Push**
   ```bash
   git add .github/workflows/ci.yml
   git commit -m "Add custom CI step"
   git push
   ```

### Conditional Execution

#### Run on Specific Branches

```yaml
- name: Deploy Preview
  if: github.ref == 'refs/heads/develop'
  run: npm run deploy:preview
```

#### Run on PR Events Only

```yaml
- name: PR-specific Task
  if: github.event_name == 'pull_request'
  run: npm run pr-check
```

#### Run on File Changes

```yaml
- name: Run Database Migrations
  if: contains(github.event.head_commit.modified, 'prisma/schema.prisma')
  run: npm run db:migrate
```

### Performance Optimization

#### Cache Dependencies

Already configured:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

#### Parallel Jobs

Split pipeline into parallel jobs:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
```

#### Selective Testing

```yaml
- name: Run Changed Tests Only
  run: npm run test -- --changedSince=origin/main
```

## CI/CD Best Practices

1. **Keep Builds Fast**
   - Target < 10 minutes total pipeline time
   - Use caching for dependencies
   - Run tests in parallel when possible

2. **Make Builds Deterministic**
   - Use `npm ci` instead of `npm install`
   - Lock dependency versions
   - Use specific action versions (@v4, not @latest)

3. **Fail Fast**
   - Run fastest checks first (lint, type-check)
   - Run expensive operations last (E2E tests)

4. **Maintain Green Builds**
   - Fix broken builds immediately
   - Don't merge PRs with failing checks
   - Investigate flaky tests

5. **Monitor Performance**
   - Track build time trends
   - Optimize slow steps
   - Remove unnecessary steps

6. **Secure Workflows**
   - Use minimal required permissions
   - Never commit secrets to workflow files
   - Use GitHub Secrets for sensitive data

---

# Linear Integration

## Repository Information

- **Repository:** `jordolang/jose-madrid-salsa`
- **Linear Workspace:** Jose Madrid Salsa
- **Issue Prefix:** JLA
- **Integration Type:** Linear GitHub App

## Prerequisites

Before starting the configuration:

- [ ] Admin access to Linear workspace
- [ ] Admin/Owner access to `jordolang/jose-madrid-salsa` GitHub repository
- [ ] Active Linear subscription with GitHub integration features enabled
- [ ] GitHub account connected to Linear workspace

## Installation Steps

### 1. Install Linear GitHub App

1. Navigate to Linear workspace settings
   - Click on workspace name in top-left
   - Select **Settings** from dropdown
   - Go to **Integrations** section

2. Find and select **GitHub** integration
   - Click **Install GitHub App**
   - You'll be redirected to GitHub authorization page

3. Authorize Linear GitHub App on GitHub
   - Select organization: `jordolang`
   - Choose repositories: Select **jose-madrid-salsa**
   - Review permissions requested:
     - Read access to code, metadata, and pull requests
     - Write access to issues, pull requests, and commit statuses
     - Webhook access for event notifications
   - Click **Install & Authorize**

4. Return to Linear
   - Confirm installation success
   - Verify `jordolang/jose-madrid-salsa` appears in connected repositories list

### 2. Configure Integration Settings

#### Branch Naming Configuration

1. In Linear GitHub integration settings, locate **Git branch naming** section
2. Set branch naming format to:
   ```
   {username}/jla-{issue-number}-{feature-name}
   ```
3. Example output: `jordan/jla-21-github-integration`

#### PR Tracking Configuration

1. Enable **Automatic PR creation from Linear issues**
   - Toggle: **ON**
   - This allows creating branches/PRs directly from Linear issues

2. Enable **PR status tracking**
   - Toggle: **ON**
   - Track status changes: draft → ready for review → merged
   - Linear will update in real-time as PR status changes

3. Configure **Automatic issue status updates**
   - Enable: **Update issue status when PR is merged**
   - Set merged PR behavior: Move issue to **Done** status
   - Enable: **Link PRs to issues automatically** (via branch name or PR description)

#### Commit and PR Linking

1. Enable **Automatic issue linking from commits**
   - Commits mentioning issue IDs (e.g., "JLA-21") will auto-link
   - Format: `JLA-XXX` in commit message

2. Enable **PR descriptions include Linear issue details**
   - Auto-populate PR description with:
     - Issue title
     - Issue description
     - Link back to Linear issue
     - Issue status and assignee

#### Webhook Configuration

1. Verify webhook endpoints are configured
   - Linear automatically configures webhooks during installation
   - Webhooks enable bidirectional sync
   - Events tracked:
     - Pull request opened/closed/merged
     - Pull request review submitted
     - Commit pushed
     - Branch created/deleted

2. Test webhook delivery (optional)
   - In GitHub repository settings → Webhooks
   - Find Linear webhook
   - Click **Recent Deliveries**
   - Verify successful delivery (200 response)

### 3. Team Settings Configuration

1. Set default branch behavior
   - Default base branch: `main`
   - Enable automatic branch creation from Linear

2. Configure PR templates (optional but recommended)
   - Create `.github/pull_request_template.md` if not exists
   - Include Linear issue reference placeholder
   - Add checklist for PR reviewers

## Testing the Integration

### Test Scenario 1: Create Branch from Linear Issue

1. Open Linear issue JLA-21 (or create test issue)
2. Click **Create branch** button in issue sidebar
3. Verify branch name follows format: `{username}/jla-{issue-number}-{feature-name}`
4. Confirm branch creation in GitHub repository
5. Verify Linear issue shows connected branch

### Test Scenario 2: Create PR and Verify Sync

1. Make a commit to the test branch
2. Create pull request on GitHub:
   - Base branch: `main`
   - Compare branch: `{username}/jla-{test-issue-number}-test`
3. Verify in Linear:
   - Issue shows connected PR
   - PR status appears in issue sidebar
   - Timeline shows PR creation event

### Test Scenario 3: PR Status Updates

1. Mark PR as draft (if not already)
   - Verify Linear shows "Draft" status
2. Mark PR as "Ready for review"
   - Verify Linear updates to "Ready for review"
3. Request review from team member
   - Verify review request appears in Linear timeline

### Test Scenario 4: PR Merge and Issue Completion

1. Approve and merge the test PR on GitHub
2. Verify in Linear:
   - Issue automatically moves to **Done** status
   - Issue timeline shows PR merge event
   - Issue shows "Completed via PR #X"

### Test Scenario 5: Commit Linking

1. Make a commit with message: "Fix bug in component JLA-21"
2. Verify commit appears in Linear issue timeline
3. Check commit includes link back to Linear issue

## Verification Checklist

After configuration, verify all features work:

- [ ] Linear GitHub App installed for `jordolang/jose-madrid-salsa`
- [ ] Branch naming format configured: `{username}/jla-{issue-number}-{feature-name}`
- [ ] Can create branches from Linear issues
- [ ] Branches automatically link to Linear issues
- [ ] PRs automatically link to Linear issues (via branch name)
- [ ] PR status updates appear in Linear in real-time
- [ ] Draft PR status shows in Linear
- [ ] Ready for review status shows in Linear
- [ ] Merged PR status shows in Linear
- [ ] PR merge automatically moves issue to "Done" status
- [ ] Commits mentioning issue IDs link automatically
- [ ] PR descriptions include Linear issue details
- [ ] Webhook endpoints active and responding
- [ ] No errors in webhook delivery logs

## Configuration Summary

| Setting | Value |
|---------|-------|
| Repository | `jordolang/jose-madrid-salsa` |
| Branch Format | `{username}/jla-{issue-number}-{feature-name}` |
| Auto PR Creation | Enabled |
| PR Status Tracking | Enabled |
| Auto Status Update on Merge | Enabled → Done |
| Commit Linking | Enabled (format: JLA-XXX) |
| PR Description Auto-fill | Enabled |
| Webhook Status | Active |

## Troubleshooting

### Issue: Branch not appearing in Linear

**Solution:**
- Verify branch name follows exact format: `{username}/jla-{issue-number}-{feature-name}`
- Check issue number is correct (e.g., JLA-21)
- Refresh Linear issue page
- Check GitHub App has read access to repository

### Issue: PR not linking to Linear issue

**Solution:**
- Verify PR branch name includes issue ID (e.g., `jla-21`)
- Add issue ID to PR description: `Fixes JLA-21`
- Manually link PR in Linear issue sidebar
- Check webhook delivery in GitHub settings

### Issue: Status not syncing

**Solution:**
- Verify webhooks are active in GitHub repository settings
- Check webhook delivery logs for errors
- Confirm Linear GitHub App has write permissions
- Try unlinking and relinking the PR

### Issue: PR merge doesn't update issue status

**Solution:**
- Verify "Auto-update on merge" setting is enabled
- Check issue is not already in Done status
- Confirm workflow state allows automatic transitions
- Manually verify webhook received merge event

## Maintenance

### Regular Checks

- **Monthly:** Verify webhook delivery success rate
- **Quarterly:** Review integration settings for team workflow changes
- **As needed:** Update branch naming format if conventions change

### Updating Configuration

To modify integration settings:
1. Go to Linear Settings → Integrations → GitHub
2. Make desired changes
3. Test with a sample issue/PR
4. Document changes in this file

### Revoking Access

If you need to remove the integration:
1. Linear Settings → Integrations → GitHub → Uninstall
2. GitHub Settings → Applications → Linear → Revoke access
3. Remove webhook from repository settings (if not auto-removed)

---

# Branch Protection Rules

## Overview

Branch protection rules enforce code quality standards and prevent direct commits to critical branches.

## Recommended Protection Rules

### Main Branch Protection

Navigate to: Settings → Branches → Add branch protection rule

**Branch name pattern**: `main`

#### Required Status Checks

- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging

**Required checks**:
- `CI / CI Pipeline` (from ci.yml workflow)

#### Pull Request Requirements

- ✅ Require a pull request before merging
- ✅ Require approvals: **1**
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners (if CODEOWNERS file exists)

#### Additional Restrictions

- ✅ Require conversation resolution before merging
- ✅ Require signed commits (optional, recommended)
- ✅ Require linear history
- ✅ Include administrators (enforce rules for admins too)

#### Force Push Protection

- ✅ Do not allow force pushes
- ✅ Do not allow deletions

### Develop Branch Protection

**Branch name pattern**: `develop`

Apply similar rules as `main`, but optionally:
- Reduce required approvals to 0 (for faster iteration)
- Allow force pushes (for rebasing)

### Configuration via GitHub UI

1. **Navigate to Settings**
   - Repository → Settings → Branches

2. **Add Branch Protection Rule**
   - Click "Add branch protection rule"
   - Enter branch name pattern: `main`

3. **Configure Protection Settings**
   - Check all recommended boxes above
   - Click "Create" at bottom

4. **Verify Protection**
   ```bash
   # Attempt to push directly to main (should fail)
   git checkout main
   git commit --allow-empty -m "Test protection"
   git push origin main
   # Expected: Error - branch is protected
   ```

### Configuration via GitHub CLI

```bash
# Create branch protection rule for main
gh api repos/{owner}/{repo}/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]=CI \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f required_pull_request_reviews[dismiss_stale_reviews]=true \
  -f enforce_admins=true \
  -f required_conversation_resolution=true \
  -f required_linear_history=true \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

## Bypass Protection (Emergency)

If you need to bypass protection in an emergency:

1. **Temporarily Disable Protection**
   - Settings → Branches → Edit rule
   - Uncheck "Include administrators"
   - Make necessary changes
   - Re-enable protection immediately

2. **Use GitHub UI for Hotfixes**
   - Create PR even for urgent changes
   - Self-approve if necessary
   - Merge with required checks

**Note**: Never disable protection permanently. Always re-enable after emergency changes.

---

# Secrets and Environment Variables

## Overview

GitHub Secrets store sensitive configuration data (API keys, tokens) used in workflows.

## Required Secrets

The following secrets must be configured for the CI/CD pipeline to function:

### Database Secrets

- `DATABASE_URL`: PostgreSQL connection string for test database
  ```
  postgresql://user:password@host:5432/database?sslmode=require
  ```

### Authentication Secrets

- `NEXTAUTH_SECRET`: NextAuth.js session encryption key
  ```bash
  # Generate with:
  openssl rand -base64 32
  ```

- `NEXTAUTH_URL`: Application base URL
  ```
  https://josemadridsalsa.com
  ```

### OAuth Provider Secrets

- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `FACEBOOK_CLIENT_ID`: Facebook OAuth app ID
- `FACEBOOK_CLIENT_SECRET`: Facebook OAuth app secret

### Email Service Secrets

- `RESEND_API_KEY`: Resend email service API key
- `EMAIL_FROM`: Sender email address

### Payment Provider Secrets

- `STRIPE_SECRET_KEY`: Stripe secret API key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

### Third-Party Integration Secrets

- `GOOGLE_MAPS_API_KEY`: Google Maps JavaScript API key
- `GOOGLE_CALENDAR_API_KEY`: Google Calendar API key

## Adding Secrets via GitHub UI

1. **Navigate to Settings**
   - Repository → Settings → Secrets and variables → Actions

2. **Add New Secret**
   - Click "New repository secret"
   - Enter name (e.g., `DATABASE_URL`)
   - Paste secret value
   - Click "Add secret"

3. **Verify Secret**
   - Secret name appears in list
   - Value is hidden (shows as `***`)

## Adding Secrets via GitHub CLI

```bash
# Add a single secret
gh secret set DATABASE_URL -b "postgresql://..."

# Add secret from file
gh secret set GOOGLE_CLIENT_SECRET < google-secret.txt

# Add multiple secrets from .env file
while IFS='=' read -r key value; do
  gh secret set "$key" -b "$value"
done < .env.production
```

## Using Secrets in Workflows

### Basic Usage

```yaml
- name: Run Tests
  run: npm run test
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
```

### Pass All Secrets

```yaml
- name: Build Application
  run: npm run build
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
    NEXTAUTH_URL: ${{ secrets.NEXTAUTH_URL }}
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
```

### Conditional Secrets

```yaml
- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  run: npm run deploy
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

## Environment-Specific Secrets

GitHub supports environment-specific secrets for different deployment targets.

### Create Environments

1. **Navigate to Settings**
   - Repository → Settings → Environments

2. **Create Environment**
   - Click "New environment"
   - Name: `production` or `staging`

3. **Add Protection Rules**
   - Required reviewers: 1
   - Wait timer: 0 minutes
   - Deployment branches: `main` only

4. **Add Environment Secrets**
   - Click environment name
   - Click "Add secret"
   - Add environment-specific secrets

### Use Environment Secrets in Workflows

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy
        run: npm run deploy
        env:
          API_KEY: ${{ secrets.API_KEY }}  # Uses production environment secret
```

## Security Best Practices

1. **Rotate Secrets Regularly**
   - Change secrets every 90 days
   - Immediately rotate compromised secrets
   - Use unique secrets per environment

2. **Minimize Secret Exposure**
   - Only pass secrets to steps that need them
   - Don't log secret values
   - Use `::add-mask::` to hide outputs

3. **Use Least Privilege**
   - Grant minimal permissions to API tokens
   - Use read-only tokens when possible
   - Create service accounts for CI/CD

4. **Audit Secret Access**
   - Review workflow runs for secret usage
   - Monitor for unauthorized access
   - Remove unused secrets

5. **Never Commit Secrets**
   ```bash
   # Check for accidentally committed secrets
   git secrets --scan
   
   # Use .gitignore
   echo ".env" >> .gitignore
   echo ".env.local" >> .gitignore
   ```

## Troubleshooting Secrets

### Secret Not Available in Workflow

**Symptoms**: Workflow fails with "undefined" or "missing secret"

**Solutions**:
1. Verify secret name matches exactly (case-sensitive)
2. Check secret is in correct scope (repository vs environment)
3. Ensure workflow has permission to access secrets
4. Re-add secret if corrupted

### Secret Value Incorrect

**Symptoms**: Authentication failures, API errors

**Solutions**:
1. Verify secret value has no leading/trailing whitespace
2. Check for newlines or special characters
3. Regenerate secret from provider
4. Update secret in GitHub

### Secret Exposed in Logs

**Symptoms**: Secret value visible in workflow logs

**Solutions**:
1. Immediately rotate the exposed secret
2. Review logs for how it was exposed
3. Add `::add-mask::` to workflow:
   ```yaml
   - name: Mask Secret
     run: echo "::add-mask::${{ secrets.MY_SECRET }}"
   ```

---

# Troubleshooting

## CI/CD Troubleshooting

### Build Failures

#### Symptom: `npm ci` fails with dependency errors

**Solutions**:
- Delete `package-lock.json` and regenerate
- Check for conflicting dependency versions
- Clear npm cache: `npm cache clean --force`

#### Symptom: TypeScript type errors

**Solutions**:
- Run `npm run type-check` locally
- Verify Prisma client is generated: `npm run db:generate`
- Check for missing type definitions

#### Symptom: Tests fail in CI but pass locally

**Solutions**:
- Set `CI=true` locally: `CI=true npm run test`
- Check for timezone differences
- Verify test database connection
- Look for file path case sensitivity issues

### Performance Issues

#### Symptom: Workflow takes too long (>15 minutes)

**Solutions**:
- Review step durations in workflow logs
- Add caching for dependencies
- Split into parallel jobs
- Reduce E2E test suite size

### Permission Errors

#### Symptom: "Resource not accessible by integration"

**Solutions**:
- Check workflow permissions in `.github/workflows/ci.yml`
- Verify repository Actions permissions in Settings
- Ensure required permissions are granted:
  ```yaml
  permissions:
    contents: read
    pull-requests: write
  ```

## Linear Integration Troubleshooting

### Best Practices

1. **Consistent Branch Naming**
   - Always create branches from Linear issues when possible
   - Use descriptive feature names in branch names
   - Example: `jordan/jla-21-github-integration-setup`

2. **PR Descriptions**
   - Reference Linear issue in PR description
   - Use "Fixes JLA-XXX" or "Closes JLA-XXX" for automatic linking
   - Include context not captured in Linear issue

3. **Commit Messages**
   - Reference issue IDs in commits: "JLA-21: Add feature"
   - Write descriptive commit messages
   - Use conventional commit format when appropriate

4. **Status Management**
   - Let automation handle status updates when possible
   - Only manually override when automation doesn't fit workflow
   - Keep issue status in sync with actual PR state

5. **Testing Integration**
   - Test integration changes with sample issues before rolling out
   - Verify webhooks work after GitHub permission changes
   - Monitor first few PRs after configuration changes

## References

- [Linear GitHub Integration Documentation](https://linear.app/docs/github)
- [Linear API Documentation](https://developers.linear.app/)
- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [jose-madrid-salsa Repository](https://github.com/jordolang/jose-madrid-salsa)

---

# Quick Reference

## Common Commands

### GitHub CLI

```bash
# View workflow runs
gh run list --workflow=ci.yml

# Watch live workflow run
gh run watch

# View workflow logs
gh run view --log

# Download artifacts
gh run download <run-id>

# Trigger workflow manually
gh workflow run ci.yml

# List secrets
gh secret list

# Set secret
gh secret set SECRET_NAME
```

### Local CI Simulation

```bash
# Run full CI pipeline locally
npm ci
npm run lint
npm run type-check
npm run test -- --coverage
npm run db:generate
npm run build
npx playwright install --with-deps chromium
npx playwright test
```

### Branch Protection Check

```bash
# Verify protection is active
gh api repos/{owner}/{repo}/branches/main/protection

# List protected branches
gh api repos/{owner}/{repo}/branches --jq '.[] | select(.protected==true) | .name'
```

## Status Badges

Add CI status badge to README.md:

```markdown
![CI](https://github.com/jordolang/jose-madrid-salsa/workflows/CI/badge.svg)
```

## Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Actions Marketplace](https://github.com/marketplace?type=actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [Linear GitHub Integration](https://linear.app/docs/github)

## Support

For issues with:
- **CI/CD Pipeline**: Check workflow logs in Actions tab
- **Linear Integration**: Contact Linear support
- **Branch Protection**: Verify settings in repository Settings
- **Secrets**: Check repository Settings → Secrets and variables

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-28 | 1.0 | Initial configuration documentation | Auto-Claude |
| 2026-05-14 | 2.0 | Added comprehensive CI/CD, branch protection, and secrets documentation | Auto-Claude |

---

**Note:** This is a living document. Update it whenever integration configuration changes or new features are enabled.
