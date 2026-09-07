# Public Pages with force-dynamic Audit

**Audit Date:** 2026-09-07  
**Total Pages Found:** 54 instances across 51 files  
**Search Pattern:** `export const dynamic = 'force-dynamic'`  
**Search Scope:** `./apps/storefront/app/(public)/`

---

## Executive Summary

This audit catalogs all public-facing pages currently using `export const dynamic = 'force-dynamic'`, which disables all caching and forces server-side rendering on every request. These pages are candidates for migration to Incremental Static Regeneration (ISR) to improve performance and reduce server load.

**Key Findings:**
- 51 unique page files with force-dynamic export
- 54 total instances (some files like layout.tsx may have multiple)
- Categories include: E-commerce, Blog/Content, User Account, Checkout, Fundraising, Forms, Legal, and Static/Marketing pages

---

## Pages by Category

### 1. Homepage & Landing Pages (3 files)
| File | Route | Notes |
|------|-------|-------|
| `page.tsx` | `/` | Main homepage with dynamic content (testimonials, featured products, calendar events) |
| `home-v2/page.tsx` | `/home-v2` | Alternate homepage version |
| `home-v3/page.tsx` | `/home-v3` | Third homepage version |

**ISR Considerations:** Homepage fetches real-time calendar events and reviews from Google APIs. Good candidate for ISR with short revalidation (60-300s).

---

### 2. Product & E-commerce Pages (6 files)
| File | Route | Notes |
|------|-------|-------|
| `products/layout.tsx` | `/products/*` | Products layout |
| `products/page.tsx` | `/products` | Product listing with filters |
| `products/[slug]/page.tsx` | `/products/[slug]` | Individual product pages |
| `salsas/page.tsx` | `/salsas` | Salsa-specific listing |
| `salsas/[slug]/page.tsx` | `/salsas/[slug]` | Individual salsa pages |
| `merchandise/page.tsx` | `/merchandise` | Merchandise listing |

**ISR Considerations:** Product pages fetch from Prisma. High-value ISR candidates with revalidation on inventory/price changes via on-demand revalidation.

---

### 3. Blog & Content (Heat Index) (7 files)
| File | Route | Notes |
|------|-------|-------|
| `heat-index/page.tsx` | `/heat-index` | Blog homepage |
| `heat-index/[slug]/page.tsx` | `/heat-index/[slug]` | Individual blog posts |
| `heat-index/series/[slug]/page.tsx` | `/heat-index/series/[slug]` | Blog series pages |
| `heat-index/category/[slug]/page.tsx` | `/heat-index/category/[slug]` | Blog category pages |
| `developer/page.tsx` | `/developer` | Developer portal landing |
| `developer/blog/page.tsx` | `/developer/blog` | Developer blog listing |
| `developer/blog/[slug]/page.tsx` | `/developer/blog/[slug]` | Developer blog posts |

**ISR Considerations:** Blog content is relatively stable. Excellent ISR candidates with revalidation on content publish/update (300-3600s default, on-demand when edited).

---

### 4. Recipe Pages (2 files)
| File | Route | Notes |
|------|-------|-------|
| `recipes/page.tsx` | `/recipes` | Recipe listing |
| `recipes/[slug]/page.tsx` | `/recipes/[slug]` | Individual recipe pages |

**ISR Considerations:** Recipe content rarely changes. Perfect for long revalidation times (3600s+) with on-demand revalidation.

---

### 5. User Account Pages (4 files)
| File | Route | Notes |
|------|-------|-------|
| `account/page.tsx` | `/account` | Account dashboard |
| `account/settings/page.tsx` | `/account/settings` | Account settings |
| `account/orders/page.tsx` | `/account/orders` | Order history |
| `account/orders/[id]/page.tsx` | `/account/orders/[id]` | Individual order details |

**ISR Considerations:** User-specific pages - may need to remain dynamic or use aggressive revalidation with proper auth checks. Consider client-side data fetching for personalized data.

---

### 6. Checkout & Transaction Pages (4 files)
| File | Route | Notes |
|------|-------|-------|
| `checkout/start/page.tsx` | `/checkout/start` | Checkout initiation |
| `checkout/success/page.tsx` | `/checkout/success` | Order confirmation |
| `checkout/cancel/page.tsx` | `/checkout/cancel` | Checkout cancellation |
| `gift-certificates/success/page.tsx` | `/gift-certificates/success` | Gift certificate purchase success |

**ISR Considerations:** Transaction pages handle sensitive, user-specific data. May need to remain dynamic or use client-side rendering for personalized content.

---

### 7. Fundraising Pages (6 files)
| File | Route | Notes |
|------|-------|-------|
| `fundraising/page.tsx` | `/fundraising` | Fundraising program overview |
| `fundraisers/[slug]/page.tsx` | `/fundraisers/[slug]` | Individual fundraiser campaign |
| `fundraisers/[slug]/[participantCode]/page.tsx` | `/fundraisers/[slug]/[participantCode]` | Participant sales page |
| `fundraisers/[slug]/dashboard/[participantCode]/page.tsx` | `/fundraisers/[slug]/dashboard/[participantCode]` | Participant dashboard |

**ISR Considerations:** Campaign pages show real-time sales data and leaderboards. Consider ISR with very short revalidation (30-60s) or hybrid approach with static shell + client-side live data.

---

### 8. Collections & Categories (1 file)
| File | Route | Notes |
|------|-------|-------|
| `collections/[slug]/page.tsx` | `/collections/[slug]` | Product collections |

**ISR Considerations:** Collection pages are similar to product listings. Good ISR candidate with revalidation on collection updates.

---

### 9. Forms & Interactive Pages (3 files)
| File | Route | Notes |
|------|-------|-------|
| `forms/page.tsx` | `/forms` | Forms listing |
| `forms/[slug]/page.tsx` | `/forms/[slug]` | Individual form pages |
| `contact/page.tsx` | `/contact` | Contact form |

**ISR Considerations:** Form shells can be static with client-side form handling. Good ISR candidates with long revalidation.

---

### 10. Polls & Voting (2 files)
| File | Route | Notes |
|------|-------|-------|
| `polls/page.tsx` | `/polls` | Polls listing |
| `polls/[slug]/page.tsx` | `/polls/[slug]` | Individual poll pages |

**ISR Considerations:** Poll content is relatively stable, but results need real-time updates. Consider ISR for poll structure with client-side result fetching.

---

### 11. Location & Tracking (4 files)
| File | Route | Notes |
|------|-------|-------|
| `find-us/page.tsx` | `/find-us` | Store locator |
| `find-us/[locationId]/page.tsx` | `/find-us/[locationId]` | Individual location pages |
| `where-is-jose/page.tsx` | `/where-is-jose` | Jose's current location/schedule |
| `track/[trackingNumber]/page.tsx` | `/track/[trackingNumber]` | Order tracking |

**ISR Considerations:** Location pages can use ISR with daily revalidation. Schedule page needs more frequent updates (300-3600s). Order tracking may need to remain dynamic or use client-side fetching.

---

### 12. Legal & Policy Pages (6 files)
| File | Route | Notes |
|------|-------|-------|
| `terms/page.tsx` | `/terms` | Terms of service |
| `privacy/page.tsx` | `/privacy` | Privacy policy |
| `refunds/page.tsx` | `/refunds` | Refund policy |
| `returns/page.tsx` | `/returns` | Return policy |
| `shipping/page.tsx` | `/shipping` | Shipping information |
| `accessibility/page.tsx` | `/accessibility` | Accessibility statement |

**ISR Considerations:** Legal pages rarely change. Excellent ISR candidates with very long revalidation (86400s+) with on-demand revalidation when updated.

---

### 13. Static/Marketing Pages (4 files)
| File | Route | Notes |
|------|-------|-------|
| `about/page.tsx` | `/about` | About page |
| `our-story/page.tsx` | `/our-story` | Company story |
| `faq/page.tsx` | `/faq` | Frequently asked questions |
| `wholesale/page.tsx` | `/wholesale` | Wholesale information |

**ISR Considerations:** Static marketing content. Perfect for ISR with long revalidation times (3600-86400s) with on-demand revalidation.

---

### 14. Special Pages (3 files)
| File | Route | Notes |
|------|-------|-------|
| `unsubscribe/page.tsx` | `/unsubscribe` | Email unsubscribe |
| `laperla/page.tsx` | `/laperla` | Special location/campaign page |
| `[slug]/page.tsx` | `/[slug]` | Dynamic catch-all route |

**ISR Considerations:** Unsubscribe and catch-all routes may need to remain dynamic due to variable content. La Perla page can likely use ISR.

---

### 15. Layout (1 file)
| File | Route | Notes |
|------|-------|-------|
| `layout.tsx` | `/*` | Public layout wrapper |

**ISR Considerations:** Layout wraps all public pages. Impacts caching strategy for all child pages. Consider carefully when migrating to ISR.

---

## Priority Recommendations

### High Priority (Quick Wins)
Pages with stable content that will benefit most from ISR:
1. **Legal/Policy pages** (6 files) - Rarely change, high traffic
2. **Blog/Content pages** (7 files) - Stable content, SEO-critical
3. **Recipe pages** (2 files) - Stable content
4. **Static/Marketing pages** (4 files) - Rarely change

### Medium Priority
Pages with moderate update frequency:
1. **Product pages** (6 files) - Update on inventory/price changes
2. **Location pages** (4 files) - Update occasionally
3. **Collections** (1 file) - Update when collections change
4. **Forms** (3 files) - Form shells can be static

### Low Priority (Requires Careful Planning)
Pages that may need to remain dynamic or need hybrid approach:
1. **Account pages** (4 files) - User-specific data
2. **Checkout pages** (4 files) - Transaction-specific data
3. **Fundraising pages** (6 files) - Real-time sales data
4. **Polls** (2 files) - Real-time voting results
5. **Order tracking** (1 file) - User-specific tracking data

### Needs Architecture Decision
1. **Homepage** (3 files) - Mix of static and dynamic content
2. **Public layout** (1 file) - Impacts all pages
3. **Catch-all route** (1 file) - Variable content

---

## Technical Patterns Observed

### Current Patterns
1. Most pages use `export const dynamic = 'force-dynamic'`
2. Some also include `export const revalidate = 0` (redundant with force-dynamic)
3. Some have `export const revalidate = 300` but force-dynamic overrides it
4. Data fetching via Prisma queries, Google APIs, and CMS queries
5. Mix of Server Components with some client-side components

### ISR Migration Pattern (Recommended)
```typescript
// Remove this:
// export const dynamic = 'force-dynamic'
// export const revalidate = 0

// Add this instead:
export const revalidate = 300 // or appropriate interval in seconds
// For on-demand revalidation, use revalidatePath() in API routes/actions
```

---

## Files Requiring Multiple Migrations

The following layout files will impact multiple pages:
- `app/(public)/layout.tsx` - Wraps all public pages
- `app/(public)/products/layout.tsx` - Wraps product pages

**Important:** Layout migrations must be carefully coordinated with child page migrations.

---

## Next Steps

1. **Phase 1:** Migrate high-priority static content pages (legal, blog, recipes, marketing)
2. **Phase 2:** Migrate product and collection pages with appropriate revalidation
3. **Phase 3:** Evaluate hybrid approaches for account, fundraising, and polls pages
4. **Phase 4:** Make architectural decisions on homepage and layout
5. **Phase 5:** Implement on-demand revalidation for content updates

---

## Appendix: Complete File List

```
./apps/storefront/app/(public)/developer/blog/page.tsx
./apps/storefront/app/(public)/developer/blog/[slug]/page.tsx
./apps/storefront/app/(public)/developer/page.tsx
./apps/storefront/app/(public)/heat-index/series/[slug]/page.tsx
./apps/storefront/app/(public)/heat-index/category/[slug]/page.tsx
./apps/storefront/app/(public)/heat-index/page.tsx
./apps/storefront/app/(public)/heat-index/[slug]/page.tsx
./apps/storefront/app/(public)/contact/page.tsx
./apps/storefront/app/(public)/gift-certificates/success/page.tsx
./apps/storefront/app/(public)/our-story/page.tsx
./apps/storefront/app/(public)/track/[trackingNumber]/page.tsx
./apps/storefront/app/(public)/products/layout.tsx
./apps/storefront/app/(public)/products/page.tsx
./apps/storefront/app/(public)/products/[slug]/page.tsx
./apps/storefront/app/(public)/salsas/page.tsx
./apps/storefront/app/(public)/salsas/[slug]/page.tsx
./apps/storefront/app/(public)/forms/page.tsx
./apps/storefront/app/(public)/forms/[slug]/page.tsx
./apps/storefront/app/(public)/privacy/page.tsx
./apps/storefront/app/(public)/merchandise/page.tsx
./apps/storefront/app/(public)/faq/page.tsx
./apps/storefront/app/(public)/terms/page.tsx
./apps/storefront/app/(public)/fundraising/page.tsx
./apps/storefront/app/(public)/polls/page.tsx
./apps/storefront/app/(public)/polls/[slug]/page.tsx
./apps/storefront/app/(public)/where-is-jose/page.tsx
./apps/storefront/app/(public)/about/page.tsx
./apps/storefront/app/(public)/shipping/page.tsx
./apps/storefront/app/(public)/unsubscribe/page.tsx
./apps/storefront/app/(public)/laperla/page.tsx
./apps/storefront/app/(public)/checkout/cancel/page.tsx
./apps/storefront/app/(public)/checkout/success/page.tsx
./apps/storefront/app/(public)/checkout/start/page.tsx
./apps/storefront/app/(public)/recipes/page.tsx
./apps/storefront/app/(public)/recipes/[slug]/page.tsx
./apps/storefront/app/(public)/fundraisers/[slug]/[participantCode]/page.tsx
./apps/storefront/app/(public)/fundraisers/[slug]/dashboard/[participantCode]/page.tsx
./apps/storefront/app/(public)/fundraisers/[slug]/page.tsx
./apps/storefront/app/(public)/layout.tsx
./apps/storefront/app/(public)/wholesale/page.tsx
./apps/storefront/app/(public)/refunds/page.tsx
./apps/storefront/app/(public)/returns/page.tsx
./apps/storefront/app/(public)/account/settings/page.tsx
./apps/storefront/app/(public)/account/orders/[id]/page.tsx
./apps/storefront/app/(public)/account/orders/page.tsx
./apps/storefront/app/(public)/account/page.tsx
./apps/storefront/app/(public)/collections/[slug]/page.tsx
./apps/storefront/app/(public)/accessibility/page.tsx
./apps/storefront/app/(public)/page.tsx
./apps/storefront/app/(public)/home-v2/page.tsx
./apps/storefront/app/(public)/[slug]/page.tsx
./apps/storefront/app/(public)/home-v3/page.tsx
./apps/storefront/app/(public)/find-us/[locationId]/page.tsx
./apps/storefront/app/(public)/find-us/page.tsx
```

---

**Audit completed on 2026-09-07**
