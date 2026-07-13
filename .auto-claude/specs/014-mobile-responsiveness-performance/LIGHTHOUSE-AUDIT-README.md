# Lighthouse Mobile Performance Audit

## Overview

This directory contains tools and templates for running Lighthouse mobile performance audits as part of the Mobile Responsiveness & Performance feature (spec 014).

## Purpose

The baseline audit establishes current mobile performance metrics before optimization, allowing us to:
1. Measure the impact of mobile-specific improvements
2. Validate we meet performance targets (Lighthouse 90+, FCP < 1.8s, TTI < 3.8s)
3. Identify performance bottlenecks to address

## Files

- **`run-lighthouse-baseline.sh`** - Automated script to run Lighthouse on key pages
- **`lighthouse-baseline-results.md`** - Template for recording baseline metrics
- **`lighthouse-reports/`** - Generated HTML and JSON reports (not committed to git)

## Running the Baseline Audit

### Prerequisites

1. **Development server must be running:**
   ```bash
   npm run dev
   ```
   Server should be accessible at http://localhost:3000

2. **Lighthouse must be available:**
   ```bash
   npx lighthouse --version
   ```
   (Lighthouse is already in devDependencies, so npx will work)

### Steps

1. **Navigate to this directory:**
   ```bash
   cd .auto-claude/specs/014-mobile-responsiveness-performance
   ```

2. **Run the baseline audit script:**
   ```bash
   ./run-lighthouse-baseline.sh
   ```

3. **Review the generated reports:**
   The script will create HTML and JSON reports in `lighthouse-reports/`:
   - `baseline-homepage-TIMESTAMP.report.html`
   - `baseline-products-listing-TIMESTAMP.report.html`
   - `baseline-salsas-category-TIMESTAMP.report.html`

4. **Record the results:**
   Open each HTML report and fill in `lighthouse-baseline-results.md` with:
   - Performance scores
   - Core Web Vitals (FCP, LCP, TTI, etc.)
   - Key opportunities for improvement
   - Diagnostic issues

### Quick Score Extraction

Use `jq` to extract scores from JSON reports:

```bash
# Performance score (0-100)
jq '.categories.performance.score * 100' lighthouse-reports/baseline-homepage-*.json

# First Contentful Paint (seconds)
jq '.audits["first-contentful-paint"].numericValue / 1000' lighthouse-reports/baseline-homepage-*.json

# Largest Contentful Paint (seconds)
jq '.audits["largest-contentful-paint"].numericValue / 1000' lighthouse-reports/baseline-homepage-*.json

# Time to Interactive (seconds)
jq '.audits["interactive"].numericValue / 1000' lighthouse-reports/baseline-homepage-*.json

# Total Blocking Time (milliseconds)
jq '.audits["total-blocking-time"].numericValue' lighthouse-reports/baseline-homepage-*.json

# Cumulative Layout Shift
jq '.audits["cumulative-layout-shift"].numericValue' lighthouse-reports/baseline-homepage-*.json
```

## Manual Audit (Alternative)

If you prefer to run audits manually:

```bash
# Homepage
npx lighthouse http://localhost:3000 \
  --only-categories=performance \
  --preset=perf \
  --form-factor=mobile \
  --view

# Products listing
npx lighthouse http://localhost:3000/products \
  --only-categories=performance \
  --preset=perf \
  --form-factor=mobile \
  --view

# Salsas category
npx lighthouse http://localhost:3000/salsas \
  --only-categories=performance \
  --preset=perf \
  --form-factor=mobile \
  --view
```

The `--view` flag will open each report in your browser automatically.

## Performance Targets

From spec.md, we must achieve:

| Metric | Target | Critical |
|--------|--------|----------|
| Performance Score | ≥ 90 | ✅ Yes |
| First Contentful Paint (FCP) | < 1.8s | ✅ Yes |
| Time to Interactive (TTI) | < 3.8s | ✅ Yes |
| Largest Contentful Paint (LCP) | < 2.5s | ⚠️ Recommended |
| Cumulative Layout Shift (CLS) | < 0.1 | ⚠️ Recommended |
| Total Blocking Time (TBT) | < 200ms | ⚠️ Recommended |

## Post-Optimization Audit

After completing all mobile optimizations (Phases 1-9), run the audit again:

```bash
./run-lighthouse-post-optimization.sh  # To be created
```

Compare results to validate improvements and ensure targets are met.

## Troubleshooting

### Server Not Running
```
❌ Error: Development server is not running on port 3000
```
**Solution:** Start the dev server with `npm run dev` in the project root

### Lighthouse Not Found
```
❌ Error: npx: command not found: lighthouse
```
**Solution:** Ensure you're in the project directory with package.json and node_modules

### Port Already in Use
```
❌ Error: Port 3000 is already in use
```
**Solution:** Stop any existing dev servers or use a different port:
```bash
PORT=3001 npm run dev
# Then update URLs in audit script to use port 3001
```

### Worktree Environment Limitations

If you're running this in a git worktree with sandbox restrictions:

1. **Option A: Run in parent project**
   ```bash
   cd /Users/jordanlang/Repos/josemadridsalsa
   # Copy audit script and run there
   ```

2. **Option B: Use symlinked node_modules**
   ```bash
   ln -s /Users/jordanlang/Repos/josemadridsalsa/node_modules ./node_modules
   npm run dev
   ```

3. **Option C: Manual execution**
   Run Lighthouse manually in Chrome DevTools:
   - Open site in Chrome
   - Open DevTools (F12)
   - Go to Lighthouse tab
   - Select "Mobile" and "Performance"
   - Click "Analyze page load"

## Notes

- Baseline audits should be run BEFORE deploying mobile optimizations
- Use consistent network throttling (4G Fast) for comparable results
- Run audits 2-3 times and take the median score to account for variance
- Lighthouse reports are in `.gitignore` (too large to commit)
- Only commit the filled-out `lighthouse-baseline-results.md` summary

## Related Files

- Spec: `spec.md` (main requirements document)
- Implementation Plan: `implementation_plan.json` (Phase 9, subtask-9-1)
- Build Progress: `build-progress.txt` (session logs)
