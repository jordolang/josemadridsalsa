# Import Infrastructure Issues & Limitations

**Last Updated**: 2026-01-28
**Status**: Investigation Phase - Pre-Manual Testing

This document tracks bugs, limitations, UX issues, and functional problems discovered during the investigation and testing of the import infrastructure.

---

## Issue Categories

- 🔴 **Critical**: Blocks core functionality or causes data loss
- 🟡 **High**: Significant impact on usability or performance
- 🟢 **Medium**: Moderate impact, workarounds available
- 🔵 **Low**: Minor issues, cosmetic problems, or nice-to-haves

---

## Issues Discovered During Investigation

### Products Import

#### 🟡 HIGH-001: No File Size Enforcement in UI
**Component**: `components/admin/ProductImportDialog.tsx`
**Description**: While the API enforces a 10MB file size limit, the UI does not validate file size before upload. Users may wait for large files to upload only to receive a server error.
**Impact**: Poor UX for users attempting to import large files
**Recommendation**: Add client-side file size validation before upload
**Workaround**: Users will see error after upload completes

#### 🟢 MEDIUM-001: No Dry Run / Preview Mode
**Component**: Product import feature
**Description**: Users cannot preview import results without committing data to the database. This makes it risky to test imports with production data.
**Impact**: Users may accidentally import incorrect data
**Recommendation**: Add a "preview" option that validates and shows results without creating records
**Related**: See "Future Enhancements" in `docs/import-infrastructure/product-import.md`

#### 🟢 MEDIUM-002: No Real-Time Progress Tracking
**Component**: Product import API endpoint
**Description**: For large imports (hundreds of products), users see a loading spinner but no indication of progress. The import could take several minutes with no feedback.
**Impact**: Users unsure if import is working or stalled
**Recommendation**: Implement WebSocket or SSE-based progress updates
**Related**: Listed as future enhancement

#### 🟢 MEDIUM-003: No Rollback Capability
**Component**: Product import feature
**Description**: Once products are imported, there is no built-in way to undo/rollback the import operation. Users must manually delete imported products.
**Impact**: Difficult to recover from accidental imports
**Recommendation**: Track import batches and provide rollback functionality
**Related**: Listed as future enhancement

#### 🔵 LOW-001: Within-File Duplicate Detection is All-or-Nothing
**Component**: `lib/product-import.ts`
**Description**: If a file contains internal duplicate SKUs, the entire import is rejected. There's no option to import the first occurrence and skip subsequent duplicates.
**Impact**: Users must manually clean data before import
**Recommendation**: Add option to auto-deduplicate within file (keep first occurrence)

#### 🔵 LOW-002: No Import Templates Available
**Component**: Product import feature
**Description**: No downloadable CSV/JSON/Excel templates are provided to guide users on proper format.
**Impact**: Users must reference documentation or existing exports
**Recommendation**: Create and host template files in `/public/templates/`
**Related**: Part of Phase 4 in implementation plan

#### 🔵 LOW-003: No Import History / Audit Dashboard
**Component**: Product import feature
**Description**: While imports are logged to audit trail, there's no UI to view import history, see past import results, or track who imported what.
**Impact**: Difficult to debug past imports or analyze import patterns
**Recommendation**: Create admin import history page
**Related**: Listed as future enhancement

---

### Orders Import

#### 🟡 HIGH-002: Sequential Processing May Cause Timeouts
**Component**: `lib/orders/import.ts`
**Description**: Orders are processed sequentially (not in parallel), taking approximately 100-500ms per order. Large imports (1000+ orders) could take 2-8 minutes and potentially timeout.
**Impact**: Large imports may fail due to timeout; no partial success
**Recommendation**: Implement batch processing or background job queue
**Related**: See "Performance Considerations" in `docs/import-infrastructure/orders-import.md`

#### 🟡 HIGH-003: Memory Issues with Large Files
**Component**: `lib/orders/import.ts`
**Description**: Entire file is loaded into memory before processing. Files >10MB may cause memory issues or crashes.
**Impact**: Large imports may fail unexpectedly
**Recommendation**: Implement streaming file parser for large files
**Related**: See "Performance Considerations" in orders import docs

#### 🟢 MEDIUM-004: Auto-Created Users Get Random Passwords
**Component**: `lib/orders/import.ts` - customer creation logic
**Description**: When `createMissingUsers` is enabled, new customer accounts are created with random passwords. Users have no way to access their accounts until they reset password.
**Impact**: Created users cannot login; requires manual password reset emails
**Recommendation**: Send welcome/password-reset emails automatically, or document this limitation clearly
**Alternative**: Add flag to create accounts without login credentials (order history only)

#### 🟢 MEDIUM-005: Auto-Created Products Set to 'draft' Status
**Component**: `lib/orders/import.ts` - product creation logic
**Description**: When `createMissingProducts` is enabled, products are created with status 'draft' and minimal data. These products won't appear in the storefront and may cause confusion.
**Impact**: Orders reference products that don't appear to exist
**Recommendation**: Add clear warning in UI about draft status; provide link to review created products
**Alternative**: Add option to set status during import

#### 🟢 MEDIUM-006: Weak Duplicate Detection for Orders
**Component**: `lib/orders/import.ts`
**Description**: Duplicate detection only uses `orderNumber`. If importing orders without order numbers (auto-generated), same order data could be imported multiple times.
**Impact**: Risk of duplicate orders in database
**Recommendation**: Add composite duplicate detection (customer + date + total, or similar)
**Related**: Listed as future enhancement

#### 🔵 LOW-004: No Field Mapping UI
**Component**: Orders import feature
**Description**: CSV headers must exactly match expected field names. Users cannot map custom column names to expected fields (e.g., "Email" → "customerEmail").
**Impact**: Users must rename columns in their source files
**Recommendation**: Add field mapping interface in import dialog
**Related**: Listed as future enhancement

#### 🔵 LOW-005: Cannot Resume Failed Imports
**Component**: Orders import feature
**Description**: If an import partially fails (e.g., 500 of 1000 orders imported), there's no way to resume from the last successful row. Users must manually remove successful orders and re-import.
**Impact**: Tedious recovery from partial failures
**Recommendation**: Add incremental import capability
**Related**: Listed as future enhancement

---

### Gift Certificates Import (Partial Implementation)

#### 🔴 CRITICAL-001: No API Endpoint for Gift Certificates Import
**Component**: Gift certificates import
**Description**: Business logic exists in `lib/gift-certificates/import.ts` but there is no API endpoint (`app/api/admin/gift-certificates/import/route.ts`). Feature is completely unusable by administrators via UI.
**Impact**: Cannot import gift certificates through admin panel
**Recommendation**: Create API endpoint following pattern from orders import
**Related**: See "What's Missing" in `docs/import-infrastructure/partial-imports.md`
**Priority**: HIGH (if gift certificate bulk imports are needed)

#### 🔴 CRITICAL-002: No UI Component for Gift Certificates Import
**Component**: Gift certificates import
**Description**: No import dialog or button exists on `/admin/gift-certificates` page.
**Impact**: Cannot import gift certificates through admin panel
**Recommendation**: Create import dialog component following pattern from orders
**Related**: See "What's Missing" in partial-imports.md
**Priority**: HIGH (if gift certificate bulk imports are needed)

#### 🟢 MEDIUM-007: Missing 'gift_certificates:import' Permission
**Component**: RBAC permissions
**Description**: No dedicated import permission defined for gift certificates. Export uses `gift_certificates:read`.
**Impact**: Cannot properly control who can import gift certificates
**Recommendation**: Add permission to RBAC system
**Related**: See partial-imports.md requirements

---

### Locations Import (Partial Implementation)

#### 🔴 CRITICAL-003: No API Endpoints for Locations Import/Export
**Component**: Locations import/export
**Description**: Business logic exists in `lib/locations/import.ts` but there are no API endpoints for import or export. Feature only accessible via one-time migration script.
**Impact**: Cannot import/export locations through admin panel
**Recommendation**: Create both import and export API endpoints
**Related**: See "What's Missing" in `docs/import-infrastructure/partial-imports.md`
**Priority**: MEDIUM (locations change infrequently)

#### 🔴 CRITICAL-004: No UI Components for Locations Import/Export
**Component**: Locations import/export
**Description**: No import/export dialog or buttons exist on `/admin/locations` page.
**Impact**: Cannot import/export locations through admin panel
**Recommendation**: Create UI components following established patterns
**Related**: See "What's Missing" in partial-imports.md
**Priority**: MEDIUM

---

### Cross-Cutting Issues

#### 🟡 HIGH-004: 10MB File Size Limit May Be Insufficient
**Component**: All import features
**Description**: Current 10MB limit is enforced across all imports. For large catalogs or historical order imports, this may be too restrictive.
**Impact**: Users may need to split large datasets into multiple files
**Recommendation**: Consider increasing limit to 50MB or implementing streaming for larger files
**Related**: Mentioned in spec edge cases

#### 🟢 MEDIUM-008: No Import/Export Templates
**Component**: All import features
**Description**: No downloadable CSV/Excel templates exist in `/public/templates/` directory to guide users on correct format and fields.
**Impact**: Users must reference documentation or create formats from scratch
**Recommendation**: Create template files for all entity types (products, orders, gift certificates, locations)
**Related**: Part of Phase 4 in implementation plan
**Status**: Planned for implementation

#### 🟢 MEDIUM-009: No Comprehensive Import Guide
**Component**: Documentation
**Description**: While technical documentation exists, there's no user-facing import guide that explains how to use import features, troubleshoot issues, or format files.
**Impact**: Users may struggle to use import features effectively
**Recommendation**: Create `docs/IMPORT_GUIDE.md` with user-friendly instructions
**Related**: Part of Phase 5 in implementation plan
**Status**: Planned for implementation

#### 🔵 LOW-006: No Unit Tests for Import Logic
**Component**: All import features
**Description**: Based on investigation, no unit tests were found for import parsing, validation, or business logic.
**Impact**: Risk of regressions when modifying import code
**Recommendation**: Add unit tests for validation schemas, parsers, and business logic
**Related**: See "Testing Considerations" sections in documentation

#### 🔵 LOW-007: No E2E Tests for Import Features
**Component**: All import features
**Description**: No end-to-end tests for import workflows (upload file → process → verify results).
**Impact**: Manual testing required for each change
**Recommendation**: Add E2E tests using Playwright or Cypress
**Related**: See "Testing Considerations" sections in documentation

---

## Issues to Investigate During Manual Testing

_This section will be populated during browser testing of product and orders import features._

### Test Scenarios

#### Product Import - CSV Format
- [ ] Upload valid CSV with 7 products → all created successfully
- [ ] Upload CSV with negative price → see validation error with row number
- [ ] Upload CSV with missing SKU → see validation error with row number
- [ ] Upload CSV with duplicate SKU (in file) → see duplicate error
- [ ] Upload CSV with duplicate SKU (in database) → see duplicate error
- [ ] Upload CSV with skipDuplicates=true → see skipped count
- [ ] Upload CSV with invalid heat level → see enum validation error
- [ ] Upload CSV with comma-separated ingredients → verify array parsing

**Issues Found**:
_To be filled during testing_

---

#### Product Import - JSON Format
- [ ] Upload valid JSON with 3 products → all created successfully
- [ ] Upload JSON with invalid enum value → see validation error
- [ ] Upload JSON with missing required fields → see field errors
- [ ] Upload JSON with duplicate SKU → see duplicate detection
- [ ] Upload JSON array format → works correctly
- [ ] Upload JSON object with "products" key → works correctly

**Issues Found**:
_To be filled during testing_

---

#### Product Import - Excel Format
- [ ] Upload valid XLSX with 4 products → all created successfully
- [ ] Upload XLSX with missing name field → see validation error
- [ ] Upload XLSX with duplicate SKU → see duplicate detection
- [ ] Upload multi-sheet XLSX → only first sheet processed
- [ ] Upload XLS (older format) → parsed correctly

**Issues Found**:
_To be filled during testing_

---

#### Orders Import - CSV Format
- [ ] Upload valid CSV with single-item orders → created successfully
- [ ] Upload CSV with multi-item orders (same order number) → items grouped correctly
- [ ] Upload CSV with invalid email → see validation error
- [ ] Upload CSV with missing required fields → see field errors
- [ ] Upload CSV with non-existent customer (createMissingUsers=false) → see error
- [ ] Upload CSV with non-existent customer (createMissingUsers=true) → customer created
- [ ] Upload CSV with non-existent product (createMissingProducts=false) → see error
- [ ] Upload CSV with non-existent product (createMissingProducts=true) → product created (draft)
- [ ] Upload CSV with duplicate order number (skipDuplicates=true) → order skipped
- [ ] Upload CSV with auto-generated order numbers → proper format

**Issues Found**:
_To be filled during testing_

---

## Testing Environment Notes

**Browser**: _To be filled_
**OS**: _To be filled_
**Database State**: _To be filled (empty, with test data, etc.)_
**User Role**: _To be filled (admin, super admin, etc.)_

---

## Resolution Tracking

| Issue ID | Status | Assigned To | Target Date | Resolution |
|----------|--------|-------------|-------------|------------|
| CRITICAL-001 | Open | - | - | Pending Phase 3 assessment |
| CRITICAL-002 | Open | - | - | Pending Phase 3 assessment |
| CRITICAL-003 | Open | - | - | Pending Phase 3 assessment |
| CRITICAL-004 | Open | - | - | Pending Phase 3 assessment |
| HIGH-001 | Open | - | - | - |
| HIGH-002 | Open | - | - | - |
| HIGH-003 | Open | - | - | - |
| HIGH-004 | Open | - | - | - |
| MEDIUM-001 | Open | - | - | Future enhancement |
| MEDIUM-002 | Open | - | - | Future enhancement |
| MEDIUM-003 | Open | - | - | Future enhancement |
| MEDIUM-004 | Open | - | - | - |
| MEDIUM-005 | Open | - | - | - |
| MEDIUM-006 | Open | - | - | Future enhancement |
| MEDIUM-007 | Open | - | - | - |
| MEDIUM-008 | In Progress | - | - | Part of Phase 4 |
| MEDIUM-009 | In Progress | - | - | Part of Phase 5 |
| LOW-001 | Open | - | - | - |
| LOW-002 | In Progress | - | - | Part of Phase 4 |
| LOW-003 | Open | - | - | Future enhancement |
| LOW-004 | Open | - | - | Future enhancement |
| LOW-005 | Open | - | - | Future enhancement |
| LOW-006 | Open | - | - | - |
| LOW-007 | Open | - | - | - |

---

## Recommendations Summary

### Immediate Actions (Before Production Use)
1. **Add client-side file size validation** (HIGH-001)
2. **Document auto-created user/product behavior** (MEDIUM-004, MEDIUM-005)
3. **Create import templates** (MEDIUM-008) - In Progress
4. **Create user-facing import guide** (MEDIUM-009) - In Progress

### Short-Term Improvements
1. **Implement background job processing** for large imports (HIGH-002)
2. **Add streaming support** for large files (HIGH-003)
3. **Complete gift certificates import** if needed (CRITICAL-001, CRITICAL-002)
4. **Complete locations import/export** if needed (CRITICAL-003, CRITICAL-004)
5. **Increase or make configurable file size limit** (HIGH-004)

### Long-Term Enhancements
1. Add dry-run/preview mode (MEDIUM-001)
2. Add real-time progress tracking (MEDIUM-002)
3. Add rollback capability (MEDIUM-003)
4. Improve duplicate detection (MEDIUM-006, LOW-001)
5. Add field mapping UI (LOW-004)
6. Add incremental import capability (LOW-005)
7. Create import history dashboard (LOW-003)
8. Add comprehensive test coverage (LOW-006, LOW-007)

---

## Related Documentation

- **Product Import**: `docs/import-infrastructure/product-import.md`
- **Orders Import**: `docs/import-infrastructure/orders-import.md`
- **Partial Imports**: `docs/import-infrastructure/partial-imports.md`
- **Test Data**: `tests/manual/README.md`
- **Implementation Plan**: `.auto-claude/specs/036-import-your-data-4/implementation_plan.json`
- **Original Spec**: `.auto-claude/specs/036-import-your-data-4/spec.md`

---

## Notes

- This document reflects issues discovered during the documentation and investigation phase (Phase 1-2)
- Manual browser testing results will be added to the "Issues to Investigate" section once testing is completed
- CRITICAL issues (001-004) are only critical if the functionality (gift certificates, locations import) is actually needed for business operations
- Many MEDIUM and LOW issues are already documented as "future enhancements" in technical documentation
- Some issues (MEDIUM-008, MEDIUM-009) are already planned for implementation in later phases
