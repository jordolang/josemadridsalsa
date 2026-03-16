# Partial Import Implementations

This document details the partial implementations of import/export functionality for Gift Certificates and Locations, identifies missing components, and outlines what's needed for completion.

## Overview

The codebase has **partial implementations** for importing/exporting Gift Certificates and Retail Locations. While the core business logic exists, these features lack the API endpoints and UI components needed to make them usable by administrators.

---

## 1. Gift Certificates Import/Export

### What Exists ✅

**File**: `lib/gift-certificates/import.ts`

The core import/export logic is fully implemented with:

- **Zod Schema Validation** (`GiftCertificateImportSchema`)
  - Required fields: `originalAmount`, `purchaserName`, `purchaserEmail`, `recipientName`
  - Optional fields: `code`, `balance`, `recipientEmail`, `theme`, `message`, `expiresAt`
  - Theme validation: BIRTHDAY, BOY_CELEBRATION, CHRISTMAS, GENERAL, GIRL

- **Unique Code Generation** (`generateGiftCertificateCode()`)
  - Format: `JMS-GC-XXXX-XXXX`
  - Uses alphanumeric characters (excludes confusing characters like O, I, 0, 1)
  - Validates uniqueness against database

- **Import Function** (`importGiftCertificates()`)
  - Accepts array of CSV rows
  - Validates each row against schema
  - Auto-generates codes if not provided
  - Sets balance to originalAmount if not specified
  - Returns success count and detailed error messages per row

- **Export Function** (`exportGiftCertificates()`)
  - Supports filtering by status, date range
  - Includes usage statistics (usages.length)
  - Outputs CSV format via Papa.unparse
  - Exports all relevant fields including timestamps

### What's Missing ❌

1. **API Endpoint for Import**
   - No `app/api/admin/gift-certificates/import/route.ts`
   - Export endpoint exists at `app/api/admin/gift-certificates/export/route.ts` (exports to XLSX/CSV)

2. **UI Components**
   - No import dialog/button on `/admin/gift-certificates` page
   - The admin page only supports viewing and filtering existing certificates
   - No file upload interface
   - No import results display (success/error summary)

3. **Permission Checks**
   - No `gift_certificates:import` permission defined
   - Export uses `gift_certificates:read` permission

---

## 2. Locations Import/Export

### What Exists ✅

**File**: `lib/locations/import.ts`

The core import/export logic is fully implemented with:

- **Zod Schema Validation** (`LocationImportSchema`)
  - Required fields: `businessName`, `address`, `city`, `state`
  - Optional fields: `zipCode`, `phone`, `website`, `photoUrl`, `latitude`, `longitude`, `county`, `isActive`
  - URL validation for website and photoUrl
  - Boolean coercion for isActive (defaults to true)

- **Import Function** (`importLocations()`)
  - Accepts array of CSV rows and `updateExisting` flag
  - Checks for duplicates via composite key (businessName + address)
  - Updates existing locations if `updateExisting=true`
  - Creates new locations if not exists
  - Returns counts: created, updated, errors (with row numbers)

- **Export Function** (`exportLocations()`)
  - Supports filtering by state, city, isActive
  - Orders by state > city > businessName
  - Outputs CSV format via Papa.unparse
  - Handles null/empty values gracefully

### What's Missing ❌

1. **API Endpoint for Import**
   - No `app/api/admin/locations/import/route.ts`
   - No import endpoint exists at all

2. **API Endpoint for Export**
   - No `app/api/admin/locations/export/route.ts`
   - Unlike gift certificates, locations don't even have an export endpoint

3. **UI Components**
   - No import dialog/button on `/admin/locations` page
   - No export button on `/admin/locations` page
   - The admin page only supports viewing, filtering, and CRUD operations
   - No file upload interface
   - No import results display

4. **Permission Checks**
   - Would need to use existing `content:read` and `content:write` permissions
   - No dedicated import/export permissions

5. **Script Usage Only**
   - Currently only usable via `scripts/import-locations.ts` (one-time migration script)
   - Not exposed to admin users through the UI

---

## Comparison with Complete Implementations

### Orders Import (Complete Reference) ✅

**Files**:
- `lib/orders/import.ts` (business logic)
- `app/api/admin/orders/import/route.ts` (API endpoint)
- `app/admin/orders/_components/import-orders-dialog.tsx` (UI component)

**Complete Features**:
- ✅ Import/export business logic
- ✅ API endpoint with file upload handling
- ✅ Permission checks (`orders:import`)
- ✅ File parsing (CSV/XLSX/XLS)
- ✅ FormData handling in API
- ✅ UI dialog component with file upload
- ✅ Results display (success count, errors list)
- ✅ Audit logging
- ✅ Options: skipDuplicates, createMissingUsers, createMissingProducts

### Products Import (Complete Reference) ✅

**Files**:
- `lib/product-import.ts` (business logic)
- `app/api/admin/products/import/route.ts` (API endpoint)
- UI component (not examined but presumed to exist)

**Complete Features**:
- ✅ Import/export business logic
- ✅ API endpoint with file upload handling
- ✅ Permission checks (`products:import`)
- ✅ File type support (JSON, CSV, Excel)
- ✅ File size validation (10MB limit)
- ✅ Duplicate SKU detection
- ✅ Category mapping validation
- ✅ Audit logging
- ✅ Options: skipDuplicates

---

## What's Needed for Completion

### For Gift Certificates Import

#### 1. API Endpoint
**File**: `app/api/admin/gift-certificates/import/route.ts`

```typescript
// Pattern to follow from orders/import/route.ts
- POST endpoint
- Session authentication
- Permission check: hasPermission(user, 'gift_certificates:import')
- FormData parsing (file upload)
- File parsing (CSV/XLSX)
- Call importGiftCertificates(rows)
- Audit logging
- Return: { successCount, errorCount, errors[] }
```

#### 2. UI Component
**File**: `app/admin/gift-certificates/_components/import-gift-certificates-dialog.tsx`

```typescript
// Pattern to follow from import-orders-dialog.tsx
- Dialog with file upload input
- Accept .csv, .xlsx, .xls files
- Upload button with loading state
- Results display:
  - Success count with CheckCircle icon
  - Error list with AlertCircle icon (show first 5)
  - "Done" button to close and reset
- Toast notifications for success/failure
```

#### 3. Integration
- Add `<ImportGiftCertificatesDialog />` button to `/admin/gift-certificates/page.tsx`
- Position near the top-right, next to any existing action buttons
- Add export button if not already present (API already exists)

#### 4. Permission
- Add `gift_certificates:import` permission to RBAC system
- Update `lib/permissions-data.ts` to include the new permission

---

### For Locations Import & Export

#### 1. Import API Endpoint
**File**: `app/api/admin/locations/import/route.ts`

```typescript
// Pattern to follow from orders/import/route.ts
- POST endpoint
- Session authentication
- Permission check: hasPermission(user, 'content:write')
- FormData parsing (file upload)
- File parsing (CSV/XLSX)
- Option: updateExisting (boolean)
- Call importLocations(rows, updateExisting)
- Audit logging
- Return: { created, updated, errors[] }
```

#### 2. Export API Endpoint
**File**: `app/api/admin/locations/export/route.ts`

```typescript
// Pattern to follow from gift-certificates/export/route.ts
- GET endpoint
- Session authentication
- Permission check: hasPermission(user, 'content:read')
- Query params: state, city, isActive, format (csv/xlsx)
- Call exportLocations(filters)
- Return CSV/XLSX file download
- Filename: locations-{date}.csv or locations-{date}.xlsx
```

#### 3. Import UI Component
**File**: `app/admin/locations/_components/import-locations-dialog.tsx`

```typescript
// Pattern to follow from import-orders-dialog.tsx
- Dialog with file upload input
- Accept .csv, .xlsx, .xls files
- Checkbox option: "Update existing locations"
- Upload button with loading state
- Results display:
  - Created count
  - Updated count (if applicable)
  - Error list with row numbers
- Toast notifications
```

#### 4. Export UI Component
**File**: `app/admin/locations/_components/export-locations-button.tsx`

```typescript
// Pattern to follow from similar export buttons
- Button with Download icon
- Dropdown menu: CSV or Excel
- Respect current filters (state, city, isActive)
- Show loading state during download
- Toast notification on success/error
```

#### 5. Integration
- Add `<ImportLocationsDialog />` button to `/admin/locations/page.tsx`
- Add `<ExportLocationsButton />` button to `/admin/locations/page.tsx`
- Position near "Add Location" and "Fetch Photos" buttons
- Ensure consistent styling with existing buttons

---

## Implementation Priority

### High Priority
1. **Gift Certificates Import** - Business logic exists, just needs API + UI
   - Likely to be frequently used by admin staff
   - Export already exists, so import is natural extension

### Medium Priority
2. **Locations Import** - Business logic exists, needs API + UI
   - Less frequently used (locations don't change often)
   - But valuable for bulk updates and initial data migration

3. **Locations Export** - Business logic exists, needs API + UI
   - Useful for backups and data analysis
   - Completes the import/export pair

---

## CSV Format Examples

### Gift Certificates Import CSV

```csv
code,originalAmount,balance,purchaserName,purchaserEmail,recipientName,recipientEmail,theme,message,expiresAt
JMS-GC-ABCD-1234,50.00,50.00,John Doe,john@example.com,Jane Smith,jane@example.com,BIRTHDAY,Happy Birthday!,2024-12-31
,100.00,,Alice Johnson,alice@example.com,Bob Brown,,GENERAL,Enjoy!,
```

**Notes**:
- `code` is optional (will be auto-generated)
- `balance` defaults to `originalAmount` if omitted
- `recipientEmail` is optional
- `theme` defaults to 'GENERAL' if omitted
- `message` and `expiresAt` are optional

### Locations Import CSV

```csv
businessName,address,city,state,zipCode,phone,website,photoUrl,latitude,longitude,county,isActive
Joe's Market,123 Main St,Austin,TX,78701,512-555-1234,https://joesmarket.com,https://example.com/photo.jpg,30.2672,-97.7431,Travis,true
Corner Store,456 Oak Ave,Dallas,TX,75201,214-555-5678,,,32.7767,-96.7970,,true
```

**Notes**:
- Required: `businessName`, `address`, `city`, `state`
- Optional: `zipCode`, `phone`, `website`, `photoUrl`, `latitude`, `longitude`, `county`
- `isActive` defaults to `true`
- URLs must be valid or empty
- Duplicate detection uses `businessName` + `address` composite key

---

## Related Files

### Existing Import Infrastructure
- `lib/gift-certificates/import.ts` - Gift certificate business logic
- `lib/locations/import.ts` - Location business logic
- `lib/orders/import.ts` - Orders import (complete reference)
- `lib/product-import.ts` - Products import (complete reference)

### API Endpoints
- `app/api/admin/gift-certificates/export/route.ts` - Gift certificate export (partial)
- `app/api/admin/orders/import/route.ts` - Orders import (complete reference)
- `app/api/admin/products/import/route.ts` - Products import (complete reference)

### UI Components
- `app/admin/orders/_components/import-orders-dialog.tsx` - Reference implementation
- `app/admin/gift-certificates/page.tsx` - Admin page (needs import button)
- `app/admin/locations/page.tsx` - Admin page (needs import/export buttons)

### Scripts (Migration Only)
- `scripts/import-locations.ts` - One-time location import script
- `scripts/verify-locations.ts` - Location data verification script

---

## Testing Checklist

When implementing these features, verify:

### Gift Certificates Import
- [ ] Can upload CSV file with all fields
- [ ] Can upload CSV with only required fields
- [ ] Auto-generates unique codes when omitted
- [ ] Validates email format
- [ ] Validates theme enum values
- [ ] Handles date parsing for expiresAt
- [ ] Shows detailed error messages with row numbers
- [ ] Displays success count
- [ ] Permission check prevents unauthorized access
- [ ] Audit log records import action

### Locations Import
- [ ] Can upload CSV file with all fields
- [ ] Can upload CSV with only required fields
- [ ] Detects duplicate locations (businessName + address)
- [ ] Updates existing locations when "Update existing" is checked
- [ ] Skips duplicates when "Update existing" is unchecked
- [ ] Validates URL format for website and photoUrl
- [ ] Handles decimal coordinates (latitude/longitude)
- [ ] Shows created vs updated counts separately
- [ ] Shows detailed error messages with row numbers
- [ ] Permission check prevents unauthorized access
- [ ] Audit log records import action

### Locations Export
- [ ] Can export to CSV format
- [ ] Can export to XLSX format
- [ ] Respects current filters (state, city, isActive)
- [ ] Includes all relevant fields
- [ ] Handles null/empty values gracefully
- [ ] Generates proper filename with date
- [ ] Downloads file correctly
- [ ] Permission check prevents unauthorized access

---

## Notes

- Both gift certificates and locations have **solid, production-ready business logic**
- The import functions handle validation, error reporting, and database operations correctly
- These are **not prototypes** - they're just missing the web API layer
- Implementation should be straightforward by following the patterns from orders/products imports
- Consider adding batch size limits (e.g., 1000 rows) to prevent timeout issues
- Consider adding preview functionality before commit (optional enhancement)
