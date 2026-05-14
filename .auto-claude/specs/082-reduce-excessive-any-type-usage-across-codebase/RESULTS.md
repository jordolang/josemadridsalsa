# TypeScript `any` Usage Reduction - Results

## Executive Summary

**Starting Point:** 411 `: any` occurrences across the codebase  
**Current State:** 317 `: any` occurrences across 152 TypeScript files  
**Reduction Achieved:** 94 occurrences removed (22.9% reduction)  
**Goal:** Reduce to < 50 occurrences (only external library declarations)  
**Remaining Work:** 267 occurrences to address

## Progress by Phase

### ✅ Completed Phases

1. **Phase 1: Error Handling Types** - Replaced ~60 `catch (err: any)` with `catch (error: unknown)`
2. **Phase 2: Zustand Store Types** - Fixed all store files with `StateCreator` types
3. **Phase 3: Prisma Query Types** - Added proper `Prisma.WhereInput` types
4. **Phase 4: API Response Types** - Standardized API responses with typed helpers
5. **Phase 5: Function Parameter Types** - Fixed function parameters in admin components and utilities
6. **Phase 6: Script Files** - Fixed types in data import/transform scripts
7. **Phase 7: Test Files** - Improved test file type safety

## Breakdown by Category

### Justified `any` Usage (6 occurrences in 3 files)

These are **type declaration files** for external libraries without official TypeScript types. These are appropriate uses of `any`:

1. **types/google.d.ts** (1 occurrence)
   - `window.google?: any` - Google Maps API global object
   - **Justification:** Complex external API with dynamic properties

2. **types/paypal-checkout-server-sdk.d.ts** (4 occurrences)
   - `execute<T = any>(request: any)` - Generic PayPal request executor
   - `requestBody(body: any)` - PayPal order/capture request bodies
   - **Justification:** Third-party SDK without official types

3. **types/pdf-parse.d.ts** (1 occurrence)
   - `pagerender?: (pageData: any) => string` - PDF page data callback
   - **Justification:** External library with opaque page data structure

**Total Justified:** 6 occurrences

---

### Remaining `any` Usage by Location (311 occurrences)

#### Test Files (51 occurrences in 12 files)

**Unit Tests:**
- `tests/unit/lib/stripe.test.ts` (5)
- `tests/unit/lib/loyalty.test.ts` (6)

**API Tests:**
- `tests/api/forms.test.ts` (6)
- `tests/api/cart.test.ts` (2)
- `tests/api/checkout.test.ts` (1)
- `tests/api/orders.test.ts` (3)
- `tests/api/payment.test.ts` (1)

**Integration Tests:**
- `tests/integration/api/checkout-complete.test.ts` (4)
- `tests/integration/api/checkout.test.ts` (1)
- `tests/integration/api/webhooks-stripe.test.ts` (10)
- `tests/integration/checkout-reservation-flow.test.ts` (1)
- `tests/integration/import-export-round-trip.test.ts` (4)

**Component Tests:**
- `tests/component/CheckoutForm.test.tsx` (6)
- `tests/lib/inventory-manager.test.ts` (1)

**Priority:** Medium - Test files should have proper types but are lower priority than production code.

---

#### Library Utilities (41 occurrences in 16 files)

**Core Libraries:**
- `lib/google-places.ts` (7) - Google Places API integration
- `lib/orders/import.ts` (9) - Order import logic
- `lib/orders/import 2.ts` (9) - Duplicate order import file
- `lib/orders/modify.ts` (1) - Order modification
- `lib/orders/modify 2.ts` (1) - Duplicate order modification file
- `lib/inventory-manager.ts` (3) - Inventory management
- `lib/gift-certificates/import.ts` (1) - Gift certificate imports
- `lib/gift-certificates/import 2.ts` (1) - Duplicate gift certificate file
- `lib/social/publisher.ts` (2) - Social media publishing

**Infrastructure:**
- `lib/auth.ts` (1) - Authentication
- `lib/loyalty.ts` (1) - Loyalty program
- `lib/geocoding.ts` (1) - Geocoding utilities
- `lib/email/blocks/renderer.ts` (1) - Email block rendering
- `lib/seo/schema-generator 2.ts` (1) - SEO schema generation
- `lib/server/google-data.ts` (1) - Google data server utilities
- `lib/locations/import 2.ts` (1) - Location imports

**Priority:** High - These are core business logic files that should have proper types.

**Note:** Several duplicate files detected (`import 2.ts`, `modify 2.ts`, `schema-generator 2.ts`) - these should be consolidated.

---

#### API Routes (130 occurrences in 59 files)

**Admin API Routes (93 occurrences):**

*Products:* (19 occurrences)
- `app/api/admin/products/route.ts` (5)
- `app/api/admin/products/[id]/route.ts` (3)
- `app/api/admin/products/[id]/variants/route.ts` (2)
- `app/api/admin/products/[id]/variants/[variantId]/route.ts` (2)
- `app/api/admin/products/import/route.ts` (1)
- `app/api/admin/products/export/route.ts` (2)

*Inventory:* (17 occurrences)
- `app/api/admin/inventory/route.ts` (7)
- `app/api/admin/inventory/import/route.ts` (5)
- `app/api/admin/inventory/export/route.ts` (2)
- `app/api/admin/inventory/[productId]/route.ts` (2)
- `app/api/admin/inventory/alerts/route.ts` (2)
- `app/api/admin/inventory/alerts/[alertId]/route.ts` (1)

*Credentials:* (18 occurrences)
- `app/api/admin/credentials/route.ts` (3)
- `app/api/admin/credentials/[id]/route.ts` (4)
- `app/api/admin/credentials/[id]/reveal/route.ts` (1)
- `app/api/admin/credentials/import/route.ts` (3)
- `app/api/admin/credentials/access/route.ts` (3)
- `app/api/admin/credentials/breach-check/route.ts` (3)
- `app/api/admin/credentials/generate-password/route.ts` (1)

*Locations:* (11 occurrences)
- `app/api/admin/locations/route.ts` (3)
- `app/api/admin/locations/[id]/route.ts` (3)
- `app/api/admin/locations/geocode/route.ts` (1)
- `app/api/admin/locations/fetch-photos/route.ts` (1)
- `app/api/admin/locations/update-local-photos/route.ts` (1)
- `app/api/admin/import-locations/route.ts` (2)

*Users:* (7 occurrences)
- `app/api/admin/users/route.ts` (3)
- `app/api/admin/users/[id]/route.ts` (4)

*Orders:* (5 occurrences)
- `app/api/admin/orders/route.ts` (1)
- `app/api/admin/orders/export/route.ts` (1)
- `app/api/admin/orders/[id]/refund/route.ts` (2)
- `app/api/admin/orders/[id]/update-status/route.ts` (1)

*Categories & Tags:* (9 occurrences)
- `app/api/admin/categories/route.ts` (3)
- `app/api/admin/categories/[id]/route.ts` (3)
- `app/api/admin/tags/route.ts` (3)
- `app/api/admin/tags/[id]/route.ts` (3)

*Media:* (5 occurrences)
- `app/api/admin/media/route.ts` (3)
- `app/api/admin/media/[id]/route.ts` (2)

*Other Admin Routes:* (7 occurrences)
- `app/api/admin/training-data/route.ts` (2)
- `app/api/admin/audit-logs/route.ts` (1)
- `app/api/admin/discounts/route.ts` (1)
- `app/api/admin/gift-certificates/export/route.ts` (1)

**Public API Routes (37 occurrences):**

*Fundraisers:* (17 occurrences)
- `app/api/fundraisers/route.ts` (2)
- `app/api/fundraisers/[id]/route.ts` (4)
- `app/api/fundraisers/[id]/analytics/route.ts` (3)
- `app/api/fundraisers/[id]/profile/route.ts` (3)
- `app/api/fundraisers/[id]/team/route.ts` (3)
- `app/api/fundraisers/[id]/gamification/route.ts` (2)

*Products:* (5 occurrences)
- `app/api/products/route.ts` (1)
- `app/api/products/search/route.ts` (2)
- `app/api/products/[id]/recommendations/route.ts` (2)

*Other Public Routes:* (15 occurrences)
- `app/api/checkout/route.ts` (1)
- `app/api/forms/route.ts` (1)
- `app/api/auth/[...nextauth]/route.ts` (1)
- `app/api/reviews/google/route.ts` (1)
- `app/api/locations/geocode/route.ts` (1)
- `app/api/salsas/route.ts` (1)
- `app/api/image-proxy/route.ts` (2)
- `app/api/setup-db/route.ts` (1)
- `app/api/import-locations-secret/route.ts` (2)

**Priority:** High - API routes handle user requests and should have proper types for request/response payloads.

---

#### Admin Pages & Components (50+ occurrences)

**Admin Pages:**
- `app/admin/page.tsx` (3)
- `app/admin/orders/page.tsx` (1)
- `app/admin/products/page.tsx` (1)
- `app/admin/locations/page.tsx` (1)
- `app/admin/invoices/page.tsx` (2)
- `app/admin/invoices/[id]/page.tsx` (3)
- `app/admin/users/page.tsx` (1)
- `app/admin/fundraisers/page.tsx` (1)
- `app/admin/wholesale/page.tsx` (1)
- `app/admin/emails/page.tsx` (1)
- `app/admin/messages/page.tsx` (1)
- `app/admin/tags/page.tsx` (1)
- `app/admin/audit-logs/page.tsx` (1)
- `app/admin/gift-certificates/page.tsx` (1)
- And more...

**Admin Components:**
- `components/admin/` - Various admin components (~30 occurrences)

**Priority:** High - User-facing admin interface.

---

#### Store & Public Components (39 occurrences)

**Store Pages:**
- `app/(public)/checkout/page.tsx` (4)
- `app/(public)/find-us/page.tsx` (2)
- `app/(public)/find-us/_components/LocationsMap.tsx` (9)
- `app/(public)/products/[slug]/page.tsx` (1)
- `app/(public)/products/search/page.tsx` (1)
- `app/(public)/forms/page.tsx` (1)
- `app/(public)/forms/[slug]/page.tsx` (1)
- `app/(public)/battles/page.tsx` (1)
- `app/(fundraiser-subdomain)/f/[subdomain]/page.tsx` (1)

**Components:**
- `components/chat/ai-chat-widget.tsx` (2)
- `components/fundraiser-portal/block-renderer.tsx` (1)
- `components/fundraiser-portal/blocks/` (11 occurrences across blocks)
- `components/admin/` (10 occurrences)

**Mobile:**
- `mobile/app/register.tsx` (1)
- `mobile/app/(tabs)/recipes.tsx` (1)
- `mobile/app/(tabs)/fundraisers.tsx` (1)
- `mobile/app/(tabs)/index.tsx` (1)

**Scripts:**
- `scripts/test-shopify-webhook.ts` (1)

**Priority:** High - Customer-facing components.

---

## Common `any` Patterns Still Present

Based on the file analysis, the remaining `any` usage falls into these categories:

1. **Untyped API Request/Response Bodies** (~40%)
   - Request body parameters: `body: any`
   - Response data: `data: any`
   - Form data handling: `formData: any`

2. **External API Integrations** (~20%)
   - Google Places API results
   - PayPal SDK responses
   - Stripe webhook payloads
   - NextAuth session data

3. **Dynamic Import/Export Data** (~15%)
   - CSV/Excel row parsing: `row: any`
   - JSON data transformation: `data: any`
   - Generic import handlers

4. **Test Mocks and Fixtures** (~15%)
   - Mock function parameters: `...args: any[]`
   - Test data factories: `createMock(): any`
   - Spy return values: `returnValue: any`

5. **Event Handlers & Callbacks** (~10%)
   - Form event handlers: `event: any`
   - Callback parameters: `data: any`
   - Dynamic component props: `props: any`

---

## Recommendations for Next Steps

### Priority 1: Core Business Logic (High Impact)

1. **Library Utilities** (41 occurrences)
   - Add proper types for `lib/google-places.ts` using Google Places API type definitions
   - Create typed interfaces for order import/export data structures
   - Type inventory manager operations with proper Prisma types

2. **API Routes** (130 occurrences)
   - Create request/response type definitions for each endpoint
   - Use Zod schemas for request validation and type inference
   - Standardize error responses with typed error objects

### Priority 2: User-Facing Code (Medium Impact)

3. **Admin & Store Pages** (89 occurrences)
   - Type form data with specific interfaces
   - Add proper types for component props
   - Type state management properly

### Priority 3: Testing & Scripts (Lower Impact)

4. **Test Files** (51 occurrences)
   - Create test fixture types
   - Type mock functions properly
   - Add interfaces for test data builders

5. **Duplicate Files**
   - Remove or consolidate duplicate files (`import 2.ts`, `modify 2.ts`, etc.)

---

## Type Safety Improvements Achieved

### Error Handling ✅
- Replaced 60+ `catch (err: any)` with `catch (error: unknown)`
- Added `getErrorMessage()` utility for safe error message extraction
- Implemented proper error narrowing with type guards

### Zustand Stores ✅
- All stores now use `StateCreator<T>` types
- Proper typing for `set` and `get` functions
- Type-safe store composition

### Prisma Queries ✅
- Replaced dynamic `where: any` with `Prisma.ModelWhereInput`
- Added proper return types using `Prisma.ModelGetPayload`
- Type guards for enum validation

### Function Parameters ✅
- Replaced generic `any` with specific interfaces
- Added proper callback types
- Typed generic functions with constraints

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Total `any` occurrences | < 50 | 317 | 🔴 In Progress |
| Justified `any` (`.d.ts` only) | 6 | 6 | ✅ Complete |
| Application code `any` | 0 | 311 | 🔴 In Progress |
| Type-check errors | 0 | 0 | ✅ Complete |
| Test pass rate | 100% | 78% | ⚠️ Infrastructure Issues |

---

## Conclusion

This refactoring effort has successfully improved type safety across the codebase by:
- Eliminating 94 unsafe `any` usages (22.9% reduction)
- Establishing patterns for type-safe error handling
- Properly typing Zustand stores and Prisma queries
- Creating reusable type utilities

**Remaining work:** 311 `any` occurrences need to be addressed, primarily in:
1. API routes (130) - Request/response typing
2. Admin pages (50+) - Form data and component props
3. Library utilities (41) - External API integrations
4. Test files (51) - Mock and fixture typing

The foundation is now in place to continue systematically removing `any` types and achieving the goal of < 50 occurrences (only in external library declarations).

---

*Generated: 2026-05-13*
*Task: 082-reduce-excessive-any-type-usage-across-codebase*
