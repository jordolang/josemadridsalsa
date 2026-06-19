# Orders Import Feature Documentation

## Overview

The orders import feature allows administrators to bulk import orders from CSV or Excel files. The system validates data, looks up customers and products, handles addresses, and creates orders with proper error handling and reporting.

## Architecture

### Components

1. **UI Layer**: `app/admin/orders/_components/import-orders-dialog.tsx`
2. **API Layer**: `app/api/admin/orders/import/route.ts`
3. **Business Logic**: `lib/orders/import.ts`

## UI Component

### ImportOrdersDialog

**Location**: `app/admin/orders/_components/import-orders-dialog.tsx`

**Features**:
- Dialog-based file upload interface
- File type support: CSV (`.csv`) and Excel (`.xlsx`, `.xls`)
- Import options:
  - `skipDuplicates`: Skip orders with duplicate order numbers
  - `createMissingUsers`: Create customer accounts if they don't exist
  - `createMissingProducts`: Create products if they don't exist (configured but not in UI)
- Real-time import progress indication
- Result summary display with success/error counts
- Detailed error reporting (shows first 5 errors, with count of additional errors)

**User Flow**:
1. User clicks "Import Orders" button
2. Dialog opens with file selection area
3. User selects CSV or Excel file
4. User clicks "Import Orders" to start process
5. System processes file and displays results
6. User reviews success/error summary
7. User clicks "Done" to close dialog

**State Management**:
- `open`: Dialog visibility state
- `file`: Selected file object
- `uploading`: Loading state during import
- `result`: Import result data (success/error counts, error details)

**Error Display**:
- Success count with green checkmark icon
- Error count with red alert icon
- Individual error details showing row number and message
- Truncated error list (first 5 errors) with count of remaining errors

## API Endpoint

### POST /api/admin/orders/import

**Location**: `app/api/admin/orders/import/route.ts`

**Authentication**:
- Requires valid session (NextAuth)
- Requires `orders:import` permission (RBAC check)

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  ```
  FormData {
    file: File (CSV or Excel)
    skipDuplicates: 'true' | 'false'
    createMissingUsers: 'true' | 'false'
    createMissingProducts: 'true' | 'false'
  }
  ```

**Response** (Success - 200):
```json
{
  "success": true,
  "totalRows": 100,
  "successCount": 95,
  "errorCount": 5,
  "errors": [
    {
      "row": 3,
      "field": "customerEmail",
      "message": "Invalid email address",
      "data": {...}
    }
  ],
  "createdOrderIds": ["order-id-1", "order-id-2", ...]
}
```

**Response** (Error):
- 401: Unauthorized (no session)
- 403: Forbidden (insufficient permissions)
- 400: Bad request (no file, file parsing errors)
- 500: Internal server error

**Audit Logging**:
- Logs all import attempts with user ID, action type, and result summary
- Action: `orders.import`
- Entity Type: `Order`
- Changes: totalRows, successCount, errorCount

## Business Logic

### File Parsing

**Supported Formats**:
- CSV: Parsed using `papaparse`
- Excel (XLSX/XLS): Parsed using `exceljs`

**CSV Parsing** (`parseCSV`):
- Uses PapaParse with header detection
- Transforms headers by trimming whitespace
- Skips empty lines
- Returns rows and parsing errors

**Excel Parsing** (`parseExcel`):
- Loads first worksheet only
- Reads headers from first row
- Maps cell values to header keys
- Skips empty rows

### Schema Validation

**OrderImportRowSchema** (Zod):

**Required Fields**:
- `customerEmail`: Valid email address
- `customerName`: Non-empty string
- `shippingFirstName`: Non-empty string
- `shippingLastName`: Non-empty string
- `shippingStreet`: Non-empty string
- `shippingCity`: Non-empty string
- `shippingState`: Min 2 characters
- `shippingZip`: Non-empty string
- `productSku`: Non-empty string
- `productName`: Non-empty string
- `quantity`: Integer >= 1
- `unitPrice`: Number >= 0

**Optional Fields**:
- `orderNumber`: String (auto-generated if not provided)
- `customerPhone`: String
- `shippingPhone`: String
- `shippingCountry`: String (default: 'US')
- `billingFirstName`, `billingLastName`, `billingStreet`, `billingCity`, `billingState`, `billingZip`, `billingCountry`: Billing address (optional)
- `shippingCost`: Number >= 0 (default: 0)
- `tax`: Number >= 0 (default: 0)
- `discountAmount`: Number >= 0 (default: 0)
- `status`: Enum (default: 'PENDING')
- `paymentStatus`: Enum (default: 'PENDING')
- `paymentMethod`: String
- `customerNotes`: String
- `adminNotes`: String
- `createdAt`: String (ISO date)

**Enums**:
- `status`: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED
- `paymentStatus`: PENDING, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED

### Order Grouping

Orders are grouped by `orderNumber` (or generated key) to handle multiple line items:

1. Rows with same `orderNumber` are grouped together
2. If no `orderNumber`, generates unique key: `{customerEmail}-{rowIndex}`
3. First row in group defines order-level data (customer, addresses, shipping, tax)
4. All rows in group become order items (product, quantity, price)

**Example**:
```csv
orderNumber,customerEmail,...,productSku,quantity
ORD-001,john@example.com,...,SHIRT-L,2
ORD-001,john@example.com,...,HAT-RED,1
```
Creates ONE order with TWO items.

### Customer Lookup

**Process**:
1. Query database for existing user by email
2. If found: Use existing user ID
3. If not found:
   - If `createMissingUsers: true`: Create new user account
   - If `createMissingUsers: false`: Add error and skip order

**User Creation**:
- Email, name, and phone from import data
- Random secure password (user must reset)
- Default role: 'customer'
- Email verified: false

### Product Lookup

**Process**:
1. Query database for existing product by SKU
2. If found: Use existing product ID and price
3. If not found:
   - If `createMissingProducts: true`: Create new product
   - If `createMissingProducts: false`: Add error and skip order

**Product Creation**:
- SKU, name from import data
- Price from `unitPrice` field
- Status: 'draft' (requires manual review)
- Basic product record only (no inventory, variants, etc.)

### Address Handling

**Shipping Address** (Required):
- Created as separate Address record
- Linked to order via `shippingAddressId`
- All fields required in import

**Billing Address** (Optional):
- If billing fields provided: Create separate Address record
- If billing fields missing: Use shipping address as billing address
- Linked to order via `billingAddressId`

### Price Calculation

**Subtotal**:
```javascript
subtotal = sum(item.quantity * item.price)
```

**Total**:
```javascript
total = subtotal + shippingCost + tax - discountAmount
```

**Item Prices**:
- If product exists: Use `unitPrice` from import (overrides product price)
- If product created: Use `unitPrice` from import
- Allows historical pricing / special pricing per order

### Order Number Generation

**Format**: `ORD-YYYYMM-NNNNN`

**Process**:
1. Get current year and month
2. Query last order with prefix `ORD-YYYYMM`
3. Extract sequence number and increment
4. Pad sequence to 5 digits
5. Example: `ORD-202401-00001`

**Uniqueness**: Enforced at database level

### Duplicate Handling

**If `skipDuplicates: true`**:
1. Check if order with same `orderNumber` exists
2. If exists: Skip row and add to error list with "Order already exists" message
3. If not exists: Proceed with creation

**If `skipDuplicates: false`**:
- Attempt to create order
- If duplicate: Database constraint error returned
- Error added to result

### Transaction Safety

**Database Transactions**:
Each order creation is wrapped in a transaction:
```javascript
await prisma.$transaction(async (tx) => {
  // Create/lookup user
  // Create/lookup products
  // Create addresses
  // Create order
  // Create order items
})
```

**Benefits**:
- Atomic operations: All-or-nothing per order
- Prevents partial order creation
- Automatic rollback on error

**Isolation**:
- Each order in separate transaction
- One order failure doesn't affect others
- Allows batch processing with partial success

## Error Handling

### Error Types

1. **Validation Errors**:
   - Source: Zod schema validation
   - Includes: row number, field path, error message, original data
   - Example: "Invalid email address" on row 5, field "customerEmail"

2. **Customer Lookup Errors**:
   - Customer not found and `createMissingUsers: false`
   - Message: "Customer not found: {email}"

3. **Product Lookup Errors**:
   - Product not found and `createMissingProducts: false`
   - Message: "Product not found: {sku}"

4. **Duplicate Order Errors**:
   - Order number already exists and `skipDuplicates: true`
   - Message: "Order already exists: {orderNumber}"

5. **Database Errors**:
   - Transaction failures
   - Constraint violations
   - Connection errors

### Error Result Format

```javascript
{
  row: number,        // 1-based row number (includes header)
  field?: string,     // Field path (e.g., "customerEmail")
  message: string,    // Human-readable error message
  data?: any         // Original row data for debugging
}
```

### Error Recovery

**Row-Level Errors**:
- Single row errors don't stop processing
- Failed rows added to error list
- Successful rows continue to process
- Final result includes both successes and failures

**Critical Errors**:
- File parsing errors: Stop immediately
- Invalid file format: Return 400 error
- Authentication errors: Return 401/403

## Usage Example

### CSV Format

```csv
orderNumber,customerEmail,customerName,shippingFirstName,shippingLastName,shippingStreet,shippingCity,shippingState,shippingZip,productSku,productName,quantity,unitPrice,shippingCost,tax
ORD-001,john@example.com,John Doe,John,Doe,123 Main St,Portland,OR,97201,SHIRT-L,Blue T-Shirt,2,29.99,5.00,2.50
ORD-001,john@example.com,John Doe,John,Doe,123 Main St,Portland,OR,97201,HAT-RED,Red Hat,1,19.99,0,0
ORD-002,jane@example.com,Jane Smith,Jane,Smith,456 Oak Ave,Seattle,WA,98101,PANTS-M,Jeans,1,59.99,8.00,5.20
```

### Excel Format

Same column structure as CSV, but in Excel workbook format (.xlsx or .xls).

## Best Practices

### Data Preparation

1. **Clean Data**: Remove empty rows, ensure consistent formatting
2. **Validate Emails**: Ensure email addresses are valid
3. **Product SKUs**: Verify SKUs match existing products (or enable auto-creation)
4. **Order Numbers**: Use unique order numbers (or omit for auto-generation)
5. **Addresses**: Include complete shipping addresses

### Import Options

**Recommended Settings**:
- `skipDuplicates: true` - Prevents accidental duplicates
- `createMissingUsers: false` - Ensures customer data is validated manually
- `createMissingProducts: false` - Prevents inventory/pricing issues

**Bulk Historical Import**:
- `createMissingUsers: true` - Useful for initial data migration
- `createMissingProducts: true` - Useful for migrating from another system
- Review created users/products after import

### Error Resolution

1. **Review Errors**: Check error messages in import result
2. **Fix Data**: Correct issues in source file
3. **Re-import**: Import again with fixed data
4. **Verify**: Check created orders in admin panel

## Performance Considerations

### File Size Limits

- No explicit file size limit enforced
- Practical limit: ~10,000 orders per file
- Larger files: Consider splitting into batches

### Processing Time

- Approximate: 100-500ms per order (including lookups)
- 1,000 orders: ~2-8 minutes
- Processing is sequential (not parallel)

### Memory Usage

- File loaded entirely into memory
- Large files (>10MB) may cause memory issues
- Consider implementing streaming for very large imports

## Security Considerations

### Authentication & Authorization

- Requires authenticated session
- Requires `orders:import` permission
- Admin-only feature

### Data Validation

- All input validated with Zod schemas
- SQL injection prevented by Prisma ORM
- File type restricted to CSV/Excel

### Audit Trail

- All imports logged with user ID
- Import statistics recorded
- Allows tracking of data changes

## Future Enhancements

### Potential Improvements

1. **Progress Updates**: Real-time progress via WebSockets or SSE
2. **Async Processing**: Background job queue for large imports
3. **Template Download**: Provide CSV/Excel template with correct headers
4. **Preview Mode**: Dry-run to validate before actual import
5. **Rollback Feature**: Ability to undo an import
6. **Duplicate Detection**: More sophisticated duplicate checking (beyond orderNumber)
7. **Field Mapping**: UI to map custom column names to expected fields
8. **Incremental Import**: Resume failed imports from last successful row
9. **Bulk Update**: Support for updating existing orders (not just creating)
10. **Import History**: Dashboard showing past imports with status

## Related Features

- **Customer Import**: Similar pattern for bulk customer creation
- **Product Import**: Bulk product/inventory updates
- **Export Orders**: Reverse operation - export orders to CSV/Excel
- **Audit Logs**: Track all import operations for compliance

## Troubleshooting

### Common Issues

**Issue**: "Invalid email address"
- **Cause**: Malformed email in customerEmail field
- **Fix**: Validate email format (user@domain.com)

**Issue**: "Product not found: SKU-123"
- **Cause**: Product SKU doesn't exist in database
- **Fix**: Create product first, or enable `createMissingProducts`

**Issue**: "Customer not found: user@example.com"
- **Cause**: Customer email doesn't exist in database
- **Fix**: Create customer first, or enable `createMissingUsers`

**Issue**: "Order already exists: ORD-12345"
- **Cause**: Duplicate order number in database
- **Fix**: Use different order number, or disable `skipDuplicates`

**Issue**: "File parsing errors"
- **Cause**: Invalid CSV/Excel format
- **Fix**: Ensure proper file format, check for encoding issues (use UTF-8)

**Issue**: Import succeeds but orders missing
- **Cause**: Validation errors silently failing
- **Fix**: Check error count in result, review error messages
