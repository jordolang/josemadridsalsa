# Lighthouse Baseline Results

**Date:** [To be filled]  
**Environment:** Development (localhost:3000)  
**Lighthouse Version:** [To be filled]  
**Throttling:** Simulated 4G (Fast 3G)

## Summary

This document records the baseline mobile performance metrics before implementing mobile-specific optimizations. These scores will be compared against post-optimization audits to measure improvement.

## Target Metrics (from spec.md)

- **Performance Score:** ≥ 90
- **First Contentful Paint (FCP):** < 1.8s
- **Time to Interactive (TTI):** < 3.8s

---

## Homepage (/)

### Performance Score
- **Score:** _____ / 100

### Core Web Vitals
| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| First Contentful Paint (FCP) | _____ s | < 1.8s | ⏳ |
| Largest Contentful Paint (LCP) | _____ s | < 2.5s | ⏳ |
| Time to Interactive (TTI) | _____ s | < 3.8s | ⏳ |
| Speed Index | _____ s | N/A | ⏳ |
| Total Blocking Time (TBT) | _____ ms | < 200ms | ⏳ |
| Cumulative Layout Shift (CLS) | _____ | < 0.1 | ⏳ |

### Key Opportunities
- [ ] ___________________________
- [ ] ___________________________
- [ ] ___________________________

### Diagnostics
- [ ] ___________________________
- [ ] ___________________________

---

## Products Listing (/products)

### Performance Score
- **Score:** _____ / 100

### Core Web Vitals
| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| First Contentful Paint (FCP) | _____ s | < 1.8s | ⏳ |
| Largest Contentful Paint (LCP) | _____ s | < 2.5s | ⏳ |
| Time to Interactive (TTI) | _____ s | < 3.8s | ⏳ |
| Speed Index | _____ s | N/A | ⏳ |
| Total Blocking Time (TBT) | _____ ms | < 200ms | ⏳ |
| Cumulative Layout Shift (CLS) | _____ | < 0.1 | ⏳ |

### Key Opportunities
- [ ] ___________________________
- [ ] ___________________________
- [ ] ___________________________

### Diagnostics
- [ ] ___________________________
- [ ] ___________________________

---

## Salsas Category (/salsas)

### Performance Score
- **Score:** _____ / 100

### Core Web Vitals
| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| First Contentful Paint (FCP) | _____ s | < 1.8s | ⏳ |
| Largest Contentful Paint (LCP) | _____ s | < 2.5s | ⏳ |
| Time to Interactive (TTI) | _____ s | < 3.8s | ⏳ |
| Speed Index | _____ s | N/A | ⏳ |
| Total Blocking Time (TBT) | _____ ms | < 200ms | ⏳ |
| Cumulative Layout Shift (CLS) | _____ | < 0.1 | ⏳ |

### Key Opportunities
- [ ] ___________________________
- [ ] ___________________________
- [ ] ___________________________

### Diagnostics
- [ ] ___________________________
- [ ] ___________________________

---

## Overall Assessment

### Current State
[Summarize overall performance state across all pages]

### Primary Bottlenecks
1. _______________________________________
2. _______________________________________
3. _______________________________________

### Expected Impact of Optimizations

Based on the mobile optimizations already implemented:
- **Image Optimization (Phase 2):** Expected FCP improvement from responsive `sizes` props
- **Mobile Navigation (Phase 3):** Expected TTI improvement from GPU-accelerated animations
- **Product Carousel (Phase 4):** Expected performance impact from Swiper integration
- **Responsive Layout (Phase 7):** Expected CLS improvement from proper breakpoint handling
- **Typography Optimization (Phase 8):** Expected font loading improvement

### Next Steps
1. [ ] Complete remaining performance optimizations from Phase 9
2. [ ] Run post-optimization audit using same script
3. [ ] Compare results and validate targets are met
4. [ ] Document any remaining performance gaps
5. [ ] Plan additional optimizations if needed

---

## How to Fill This Template

Run the baseline audit script:
```bash
cd .auto-claude/specs/014-mobile-responsiveness-performance
./run-lighthouse-baseline.sh
```

For each page, open the generated HTML report and fill in:
1. Performance Score (from top of report)
2. Core Web Vitals metrics (from Metrics section)
3. Key Opportunities (from Opportunities section - top 3)
4. Diagnostics (from Diagnostics section - top 2 issues)
5. Mark Status as ✅ (met target), ⚠️ (close to target), or ❌ (below target)

You can also extract scores programmatically:
```bash
# Extract performance score
jq '.categories.performance.score * 100' lighthouse-reports/baseline-*.json

# Extract FCP
jq '.audits["first-contentful-paint"].numericValue / 1000' lighthouse-reports/baseline-*.json

# Extract LCP
jq '.audits["largest-contentful-paint"].numericValue / 1000' lighthouse-reports/baseline-*.json

# Extract TTI
jq '.audits["interactive"].numericValue / 1000' lighthouse-reports/baseline-*.json
```
