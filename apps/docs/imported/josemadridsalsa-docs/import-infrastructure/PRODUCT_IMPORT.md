# Product Import Infrastructure

## Overview

The product import feature enables bulk importing of product catalogs through a user-friendly admin interface. It supports multiple file formats (JSON, CSV, Excel), performs comprehensive validation, handles duplicates intelligently, and logs all import operations for audit purposes.

## Architecture Components

### 1. UI Component

**File:** `components/admin/ProductImportDialog.tsx`

A React dialog component that provides the user interface for importing products.

#### Key Features

- **File Upload**: Drag-and-drop or click-to-upload interface
- **Format Auto-Detection**: Automatically detects file type based on extension
- **File Type Selection**: Manual override for JSON, CSV, or Excel formats
- **Duplicate Handling**: Checkbox option to skip products with duplicate SKUs
- **Real-time Feedback**: Shows upload progress, success messages, and detailed validation errors
- **Format Guidelines**: Built-in help text showing required and optional fields

#### Component Props

```typescript
interface ProductImportDialogProps {
  open: boolean;              // Controls dialog visibility
  onOpenChange: (open: boolean) => void;  // Callback for open state changes
  onSuccess: () => void;      // Called after successful import
}
```

#### Import Result Interface

```typescript
interface ImportResult {
  success: boolean;
  message?: string;
  errors?: string[];
  validationErrors?: Array<{ row: number; errors: string[] }>;
  imported?: number;
  skipped?: number;
  totalRows?: number;
}
```

#### User Flow

1. User selects a file (auto-detects format from extension)
2. User optionally chooses to skip duplicate SKUs
3. User clicks "Import Products"
4. Component uploads file via FormData to `/api/admin/products/import`
5. Component displays success message or detailed validation errors
6. On success, dialog auto-closes after 2 seconds and triggers `onSuccess` callback

#### File Constraints

- **Supported formats**: `.json`, `.csv`, `.xlsx`, `.xls`
- **Maximum file size**: 10MB
- **Accepted MIME types**: Enforced by file input accept attribute

---

### 2. Business Logic Layer

**File:** `lib/product-import.ts`

Core parsing and validation logic for product imports.

#### Key Functions

##### `parseJSON(buffer: Buffer): Promise<ImportResult>`

Parses JSON files and supports two formats:
- Array of products: `[{...}, {...}]`
- Object with products array: `{ products: [{...}, {...}] }`

##### `parseCSV(buffer: Buffer): Promise<ImportResult>`

Uses Papa Parse library to parse CSV files with:
- Header row detection
- Empty line skipping
- Header trimming
- Comprehensive error reporting

##### `parseExcel(buffer: Buffer): Promise<ImportResult>`

Uses ExcelJS library to parse Excel files:
- Reads first worksheet only
- Extracts headers from first row
- Converts all cell values to strings
- Handles empty cells gracefully

##### `validateProducts(rawData: any[], categories: Map<string, string>): ImportResult`

Validates and transforms raw product data using Zod schema:
- Validates all required and optional fields
- Transforms comma-separated strings to arrays (ingredients, images, keywords)
- Resolves category names to category IDs (case-insensitive)
- Collects validation errors by row number
- Returns only valid products

##### `parseProductImport(file: File | Buffer, fileType: string, categories: Map<string, string>): Promise<ImportResult>`

Main orchestration function that:
1. Converts File to Buffer if needed
2. Routes to appropriate parser based on fileType
3. Validates and transforms parsed data
4. Returns comprehensive import result

---

### 3. Validation Schema

**Defined in:** `lib/product-import.ts`

#### Zod Schema: `ProductImportSchema`

##### Required Fields

| Field | Type | Validation |
|-------|------|------------|
| `name` | string | Min length: 1 |
| `slug` | string | Min length: 1 |
| `sku` | string | Min length: 1 |
| `price` | number | Must be positive |
| `heatLevel` | enum | MILD, MEDIUM, HOT, EXTRA_HOT, FRUIT |
| `categoryId` or `categoryName` | string | One is required |

##### Optional Fields with Defaults

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `inventory` | number | 0 | Integer, min 0 |
| `lowStockThreshold` | number | 5 | Integer, min 0 |
| `isActive` | boolean | true | Accepts: true/false, "true"/"false", "1"/"0", "yes"/"no" |
| `isFeatured` | boolean | false | Accepts: true/false, "true"/"false", "1"/"0", "yes"/"no" |
| `sortOrder` | number | 0 | Integer |

##### Optional Fields (Nullable)

| Field | Type | Validation |
|-------|------|------------|
| `description` | string | - |
| `compareAtPrice` | number | Must be positive if provided |
| `costPrice` | number | Must be positive if provided |
| `barcode` | string | - |
| `weight` | number | Must be positive if provided |
| `featuredImage` | string | URL or relative path; empty string → null |
| `images` | string | Comma-separated URLs/paths |
| `ingredients` | string | Comma-separated list |
| `searchKeywords` | string | Comma-separated keywords |
| `metaTitle` | string | SEO meta title |
| `metaDescription` | string | SEO meta description |
| `ogImage` | string | URL or relative path for Open Graph image |

#### Data Transformations

1. **Comma-separated to Arrays**:
   - `ingredients`: "salt, pepper, garlic" → ["salt", "pepper", "garlic"]
   - `images`: "img1.jpg, img2.jpg" → ["img1.jpg", "img2.jpg"]
   - `searchKeywords`: "spicy, hot, sauce" → ["spicy", "hot", "sauce"]

2. **Boolean Conversion**:
   - Accepts: `true`, `false`, `"true"`, `"false"`, `"1"`, `"0"`, `"yes"`, `"no"`
   - Case-insensitive for strings

3. **Number Coercion**:
   - String numbers are automatically converted to numeric types
   - Validation occurs after coercion

4. **Category Resolution**:
   - If `categoryId` provided: Uses directly
   - If `categoryName` provided: Looks up ID from category map (case-insensitive)
   - Throws error if category name not found

---

### 4. API Endpoint

**File:** `app/api/admin/products/import/route.ts`

**Endpoint:** `POST /api/admin/products/import`

#### Authentication & Authorization

- **Permission Required**: `products:import`
- **Enforced by**: `requirePermission()` middleware
- Returns 401 if not authenticated, 403 if lacking permission

#### Request Format

**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Product import file |
| `fileType` | string | Yes | One of: "json", "csv", "excel" |
| `skipDuplicates` | string | No | "true" or "false" (default: false) |

#### Response Format

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Successfully imported 25 product(s)",
  "imported": 25,
  "skipped": 3,
  "totalRows": 28
}
```

**Validation Error Response (400 Bad Request):**

```json
{
  "success": false,
  "errors": ["General error messages"],
  "validationErrors": [
    {
      "row": 5,
      "errors": [
        "price: Price must be positive",
        "heatLevel: Invalid enum value"
      ]
    }
  ],
  "totalRows": 50,
  "validRows": 45
}
```

**Duplicate SKU Error (409 Conflict):**

```json
{
  "success": false,
  "errors": [
    "3 product(s) with duplicate SKUs already exist: SKU-001, SKU-002, SKU-003",
    "Set skipDuplicates to true to skip these products."
  ],
  "totalRows": 50,
  "validRows": 50
}
```

#### Processing Flow

1. **Authentication**: Verify user has `products:import` permission
2. **Input Validation**:
   - Check file is provided
   - Validate fileType is one of: json, csv, excel
   - Enforce 10MB file size limit
3. **Category Loading**: Fetch all categories and build case-insensitive name→ID map
4. **File Parsing & Validation**: Call `parseProductImport()` with file, type, and category map
5. **Duplicate Detection**:
   - Check for duplicate SKUs within the import file
   - Query database for existing products with same SKUs
   - If `skipDuplicates=false` and duplicates exist: Return 409 error
   - If `skipDuplicates=true`: Filter out existing SKUs
6. **Bulk Import**: Use `prisma.product.createMany()` for efficient insertion
7. **Audit Logging**: Log import action with metadata
8. **Success Response**: Return count of imported and skipped products

---

### 5. Supported File Formats

#### JSON Format

**Option 1: Array of Products**

```json
[
  {
    "name": "Habanero Hot Sauce",
    "slug": "habanero-hot-sauce",
    "sku": "HSS-001",
    "price": 9.99,
    "heatLevel": "HOT",
    "categoryName": "Hot Sauces",
    "ingredients": "Habanero peppers, vinegar, salt",
    "inventory": 50,
    "isActive": true
  },
  {
    "name": "Mild Salsa",
    "slug": "mild-salsa",
    "sku": "SALSA-001",
    "price": 6.99,
    "heatLevel": "MILD",
    "categoryId": "cat_123456",
    "inventory": 100
  }
]
```

**Option 2: Object with Products Array**

```json
{
  "products": [
    { /* product data */ },
    { /* product data */ }
  ]
}
```

#### CSV Format

**Requirements:**
- First row must contain headers
- Headers must match field names exactly (case-sensitive)
- Empty rows are skipped
- Whitespace in headers is trimmed

**Example:**

```csv
name,slug,sku,price,heatLevel,categoryName,ingredients,inventory,isActive
Habanero Hot Sauce,habanero-hot-sauce,HSS-001,9.99,HOT,Hot Sauces,"Habanero peppers, vinegar, salt",50,true
Mild Salsa,mild-salsa,SALSA-001,6.99,MILD,Salsas,"Tomatoes, onions, cilantro",100,true
```

#### Excel Format (.xlsx, .xls)

**Requirements:**
- First sheet is used (subsequent sheets are ignored)
- First row must contain headers
- Headers must match field names exactly
- All cell values are converted to strings
- Empty cells are treated as null

**Example:**

| name | slug | sku | price | heatLevel | categoryName | ingredients | inventory | isActive |
|------|------|-----|-------|-----------|--------------|-------------|-----------|----------|
| Habanero Hot Sauce | habanero-hot-sauce | HSS-001 | 9.99 | HOT | Hot Sauces | Habanero peppers, vinegar, salt | 50 | true |
| Mild Salsa | mild-salsa | SALSA-001 | 6.99 | MILD | Salsas | Tomatoes, onions, cilantro | 100 | true |

---

### 6. Duplicate Handling

#### Strategy

The import system uses **SKU** as the unique identifier for duplicate detection.

#### Detection Levels

1. **Within Import File**:
   - Scans imported data for duplicate SKUs
   - Rejects entire import if duplicates found within file
   - Error message lists all duplicate SKUs

2. **Against Database**:
   - Queries database for products with matching SKUs
   - Behavior depends on `skipDuplicates` setting

#### Skip Duplicates Behavior

**When `skipDuplicates = false` (default):**
- Import fails if any SKU already exists in database
- Returns 409 Conflict status
- Error message lists all conflicting SKUs
- Suggests setting `skipDuplicates=true`
- **No products are imported**

**When `skipDuplicates = true`:**
- Products with existing SKUs are filtered out
- Only new products are imported
- Response includes count of skipped products
- Success if at least one new product imported
- Error if all products already exist

#### Example Scenarios

**Scenario 1: Import with Duplicates, skipDuplicates=false**
- File contains: SKU-001, SKU-002, SKU-003
- Database has: SKU-002
- **Result**: Import rejected, error lists SKU-002

**Scenario 2: Import with Duplicates, skipDuplicates=true**
- File contains: SKU-001, SKU-002, SKU-003
- Database has: SKU-002
- **Result**: SKU-001 and SKU-003 imported, SKU-002 skipped
- Response: `{ imported: 2, skipped: 1, totalRows: 3 }`

**Scenario 3: All Products Exist, skipDuplicates=true**
- File contains: SKU-001, SKU-002
- Database has: SKU-001, SKU-002
- **Result**: Import fails with error "All products in the import already exist"

---

### 7. Audit Logging

#### Implementation

**Function:** `logAudit()` from `lib/audit.ts`

**Trigger:** After successful product import

#### Logged Data

```typescript
{
  userId: string,           // ID of user who performed import
  action: 'products.bulk_import',
  entityType: 'product',
  changes: {
    fileType: 'json' | 'csv' | 'excel',
    totalRows: number,      // Total products in file
    imported: number,       // Successfully imported count
    skipped: number         // Skipped due to duplicate SKUs
  }
}
```

#### Audit Trail Use Cases

- **Compliance**: Track who imported products and when
- **Debugging**: Investigate import issues by reviewing historical imports
- **Analytics**: Analyze import patterns and frequency
- **Accountability**: Attribute bulk data changes to specific users

#### Access to Audit Logs

Audit logs are stored in the database and can be queried through the admin audit log interface (if implemented) or directly via database queries.

---

## Error Handling

### File-Level Errors

| Error | HTTP Status | Cause |
|-------|-------------|-------|
| No file provided | 400 | Missing file in form data |
| Invalid file type | 400 | fileType not in [json, csv, excel] |
| File too large | 400 | File size > 10MB |
| JSON parsing error | 400 | Invalid JSON syntax |
| CSV parsing error | 400 | Malformed CSV structure |
| Excel parsing error | 400 | Corrupted or empty Excel file |
| Invalid JSON structure | 400 | Not an array or object with products array |

### Validation Errors

Returned as structured data with row numbers and specific field errors:

```json
{
  "validationErrors": [
    {
      "row": 12,
      "errors": [
        "price: Price must be positive",
        "heatLevel: Invalid enum value. Expected MILD, MEDIUM, HOT, EXTRA_HOT, or FRUIT"
      ]
    }
  ]
}
```

### Business Logic Errors

| Error | HTTP Status | Cause |
|-------|-------------|-------|
| Duplicate SKUs in file | 400 | Same SKU appears multiple times in import |
| Category not found | 400 | categoryName doesn't match any existing category |
| Existing SKUs in database | 409 | SKUs already exist and skipDuplicates=false |
| All products exist | 400 | All SKUs exist and skipDuplicates=true |

---

## Dependencies

### NPM Packages

- **papaparse** (`^5.4.1`): CSV parsing
- **exceljs** (`^4.4.0`): Excel file parsing
- **zod** (`^3.22.4`): Schema validation and type inference

### Internal Dependencies

- `@/lib/rbac`: Role-based access control
- `@/lib/api`: API response helpers (ok, fail)
- `@/lib/audit`: Audit logging
- `@/lib/prisma`: Database client
- `@/components/ui/*`: Shadcn UI components

---

## Future Enhancements

### Potential Improvements

1. **Image Upload Support**: Allow images to be included in import files (base64 or ZIP archive)
2. **Dry Run Mode**: Preview import results without committing to database
3. **Progress Tracking**: WebSocket-based real-time progress for large imports
4. **Import Templates**: Downloadable Excel/CSV templates with proper headers
5. **Update Existing Products**: Option to update products instead of skipping duplicates
6. **Batch Processing**: Process very large files in chunks to avoid timeouts
7. **Import History**: UI to view past imports and their results
8. **Rollback Support**: Ability to undo an import operation
9. **Field Mapping**: UI to map custom headers to expected field names
10. **Multi-sheet Excel Support**: Import from multiple sheets or select specific sheet

---

## Testing Considerations

### Unit Tests

- Validate ProductImportSchema with valid and invalid data
- Test parseJSON with various JSON structures
- Test parseCSV with different CSV formats and edge cases
- Test parseExcel with single and multi-sheet workbooks
- Test validateProducts with category resolution logic

### Integration Tests

- Test API endpoint with valid JSON, CSV, and Excel files
- Test duplicate detection logic
- Test skipDuplicates behavior
- Test file size validation
- Test permission enforcement
- Test audit log creation

### E2E Tests

- Upload file through UI and verify products created
- Test validation error display in UI
- Test success message and auto-close behavior
- Test skip duplicates checkbox functionality
