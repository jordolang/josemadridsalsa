# Data Import Guide

This guide provides comprehensive documentation for importing data into the Jose Madrid Salsa e-commerce system.

## Table of Contents

1. [Overview](#overview)
2. [Products Import](#products-import)
3. [Orders Import](#orders-import)
4. [Gift Certificates Import](#gift-certificates-import)
5. [Retail Locations Import](#retail-locations-import)
6. [Troubleshooting](#troubleshooting)
7. [Template Downloads](#template-downloads)

---

## Overview

The system supports importing data for four main entity types:

- **Products**: Hot sauces and related merchandise
- **Orders**: Customer orders with items and shipping information
- **Gift Certificates**: Digital gift certificates for customers
- **Retail Locations**: Physical stores that carry Jose Madrid Salsa products

### General Import Guidelines

- **File Encoding**: All files must be UTF-8 encoded
- **Header Row**: First row must contain column names (case-sensitive)
- **Empty Lines**: Empty rows are automatically skipped
- **Data Validation**: All imports are validated before processing
- **Error Reporting**: Detailed error messages indicate the row and field with issues
- **Batch Processing**: Large files are processed efficiently in batches

---

## Products Import

Import product catalog including hot sauces, merchandise, and related items.

### Supported Formats

- **CSV** (.csv)
- **Excel** (.xlsx, .xls)
- **JSON** (.json)

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | String | Product name | `Ghost Pepper Hot Sauce` |
| `slug` | String | URL-friendly identifier | `ghost-pepper-hot-sauce` |
| `sku` | String | Stock Keeping Unit (unique) | `JMS-GP-001` |
| `price` | Number | Base price in dollars | `12.99` |
| `heatLevel` | Enum | Heat intensity level | `EXTRA_HOT` |

### Optional Fields

| Field | Type | Default | Description | Example |
|-------|------|---------|-------------|---------|
| `description` | String | null | Product description (Markdown supported) | `Made with fresh ghost peppers...` |
| `compareAtPrice` | Number | null | Original price for sale items | `15.99` |
| `costPrice` | Number | null | Cost basis for margin calculations | `6.50` |
| `inventory` | Integer | 0 | Current stock quantity | `150` |
| `lowStockThreshold` | Integer | 5 | Alert threshold for low inventory | `10` |
| `ingredients` | String | empty | Comma-separated ingredient list | `Ghost peppers, vinegar, salt, garlic` |
| `categoryId` | String | null | Category UUID (if known) | `uuid-123...` |
| `categoryName` | String | null | Category name (alternative to ID) | `Hot Sauces` |
| `barcode` | String | null | UPC/EAN barcode | `012345678901` |
| `weight` | Number | null | Weight in ounces | `5.0` |
| `featuredImage` | String | null | Primary image URL or path | `/images/products/ghost-pepper.jpg` |
| `images` | String | empty | Comma-separated image URLs | `/img1.jpg, /img2.jpg, /img3.jpg` |
| `isActive` | Boolean | true | Product visibility on site | `true`, `1`, `yes` |
| `isFeatured` | Boolean | false | Show on homepage | `false`, `0`, `no` |
| `sortOrder` | Integer | 0 | Display order in listings | `100` |
| `metaTitle` | String | null | SEO page title | `Best Ghost Pepper Sauce - Jose Madrid` |
| `metaDescription` | String | null | SEO meta description | `Authentic ghost pepper hot sauce...` |
| `ogImage` | String | null | Social media share image | `/og-ghost-pepper.jpg` |
| `searchKeywords` | String | empty | Comma-separated search terms | `spicy, hot, ghost pepper, extreme` |

### Field Format Specifications

#### heatLevel (Required Enum)
Must be one of the following values:
- `MILD` - Minimal heat, family-friendly
- `MEDIUM` - Moderate heat, most popular
- `HOT` - Significant heat for spice lovers
- `EXTRA_HOT` - Extreme heat, use caution
- `FRUIT` - Fruit-based sauce with minimal heat

#### Boolean Fields (isActive, isFeatured)
Accepted formats:
- **Boolean**: `true`, `false`
- **Numeric**: `1` (true), `0` (false)
- **Text**: `yes`, `no`, `true`, `false` (case-insensitive)

#### Comma-Separated Fields
For `ingredients`, `images`, and `searchKeywords`:
- Separate values with commas
- Leading/trailing whitespace is automatically trimmed
- Empty values are filtered out
- Example: `peppers, vinegar, salt` → `["peppers", "vinegar", "salt"]`

#### Category Reference
You must provide **either** `categoryId` **or** `categoryName`:
- `categoryId`: Direct UUID reference (preferred for performance)
- `categoryName`: System looks up the category by name (case-insensitive)
- If both provided, `categoryId` takes precedence
- Error if category not found

### CSV Example

```csv
name,slug,sku,price,heatLevel,description,inventory,categoryName,ingredients,isActive,isFeatured
Ghost Pepper Hot Sauce,ghost-pepper-hot-sauce,JMS-GP-001,12.99,EXTRA_HOT,Extreme heat with authentic ghost pepper flavor,150,Hot Sauces,"Ghost peppers, vinegar, salt, garlic",true,true
Mild Habanero,mild-habanero,JMS-MH-002,9.99,MEDIUM,Perfect balance of flavor and heat,200,Hot Sauces,"Habanero, mango, vinegar, spices",true,false
Fruit Fusion,fruit-fusion,JMS-FF-003,11.99,FRUIT,Tropical fruit blend with minimal heat,75,Specialty,"Pineapple, mango, mild peppers, lime",true,false
```

### JSON Example

```json
{
  "products": [
    {
      "name": "Ghost Pepper Hot Sauce",
      "slug": "ghost-pepper-hot-sauce",
      "sku": "JMS-GP-001",
      "price": 12.99,
      "compareAtPrice": 15.99,
      "heatLevel": "EXTRA_HOT",
      "description": "Extreme heat with authentic ghost pepper flavor",
      "inventory": 150,
      "lowStockThreshold": 10,
      "categoryName": "Hot Sauces",
      "ingredients": "Ghost peppers, vinegar, salt, garlic",
      "isActive": true,
      "isFeatured": true,
      "searchKeywords": "ghost, extreme, super hot"
    }
  ]
}
```

### Excel Format

Excel files follow the same column structure as CSV. The first worksheet is used for import.

**Tips for Excel:**
- Use the first row for column headers (exact names from CSV example)
- Format numeric columns (price, inventory) as numbers, not text
- Boolean columns can use TRUE/FALSE or 1/0
- Save as `.xlsx` format for best compatibility

---

## Orders Import

Import historical or migrated customer orders with line items.

### Supported Formats

- **CSV** (.csv)
- **Excel** (.xlsx, .xls)

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `customerEmail` | Email | Customer email address | `john@example.com` |
| `customerName` | String | Customer full name | `John Doe` |
| `shippingFirstName` | String | Recipient first name | `John` |
| `shippingLastName` | String | Recipient last name | `Doe` |
| `shippingStreet` | String | Street address | `123 Main St` |
| `shippingCity` | String | City name | `Austin` |
| `shippingState` | String | State code (2 letters) | `TX` |
| `shippingZip` | String | ZIP/postal code | `78701` |
| `productSku` | String | Product SKU (must exist) | `JMS-GP-001` |
| `productName` | String | Product name | `Ghost Pepper Hot Sauce` |
| `quantity` | Integer | Item quantity (≥1) | `2` |
| `unitPrice` | Number | Price per item | `12.99` |

### Optional Fields

| Field | Type | Default | Description | Example |
|-------|------|---------|-------------|---------|
| `orderNumber` | String | Auto-generated | Unique order identifier | `ORD-202401-00001` |
| `customerPhone` | String | null | Customer phone number | `512-555-1234` |
| `shippingCountry` | String | `US` | Country code | `US` |
| `shippingPhone` | String | null | Delivery phone number | `512-555-1234` |
| `billingFirstName` | String | (shipping) | Billing first name | `John` |
| `billingLastName` | String | (shipping) | Billing last name | `Doe` |
| `billingStreet` | String | (shipping) | Billing street | `456 Oak Ave` |
| `billingCity` | String | (shipping) | Billing city | `Austin` |
| `billingState` | String | (shipping) | Billing state | `TX` |
| `billingZip` | String | (shipping) | Billing ZIP | `78702` |
| `billingCountry` | String | `US` | Billing country | `US` |
| `shippingCost` | Number | 0 | Shipping charges | `8.50` |
| `tax` | Number | 0 | Sales tax | `2.15` |
| `discountAmount` | Number | 0 | Total discount applied | `5.00` |
| `status` | Enum | `PENDING` | Order status | `SHIPPED` |
| `paymentStatus` | Enum | `PENDING` | Payment status | `PAID` |
| `paymentMethod` | String | null | Payment method used | `Credit Card` |
| `customerNotes` | String | null | Customer order notes | `Please leave at door` |
| `adminNotes` | String | null | Internal admin notes | `Customer requested gift wrap` |
| `createdAt` | ISO Date | Current time | Order creation date | `2024-01-15T10:30:00Z` |

### Field Format Specifications

#### status (Order Status Enum)
Must be one of:
- `PENDING` - Order received, awaiting confirmation
- `CONFIRMED` - Order confirmed, ready for processing
- `PROCESSING` - Order being prepared
- `SHIPPED` - Order shipped to customer
- `DELIVERED` - Order delivered successfully
- `CANCELLED` - Order cancelled
- `REFUNDED` - Order refunded

#### paymentStatus (Payment Status Enum)
Must be one of:
- `PENDING` - Payment not yet processed
- `PAID` - Payment completed successfully
- `FAILED` - Payment attempt failed
- `REFUNDED` - Payment fully refunded
- `PARTIALLY_REFUNDED` - Payment partially refunded

#### Multi-Item Orders
To import an order with multiple products:
- Use the same `orderNumber` for all line items
- Provide the same customer and shipping information for each row
- Each row represents one line item
- System automatically groups rows into single order

#### Order Number Format
If not provided, auto-generated in format: `ORD-YYYYMM-NNNNN`
- `YYYY` = Year
- `MM` = Month
- `NNNNN` = Sequential number (padded to 5 digits)
- Example: `ORD-202401-00042`

### CSV Example

```csv
orderNumber,customerEmail,customerName,customerPhone,shippingFirstName,shippingLastName,shippingStreet,shippingCity,shippingState,shippingZip,shippingCountry,productSku,productName,quantity,unitPrice,shippingCost,tax,status,paymentStatus
ORD-001,john@example.com,John Doe,512-555-1234,John,Doe,123 Main St,Austin,TX,78701,US,JMS-GP-001,Ghost Pepper Hot Sauce,2,12.99,8.50,2.15,SHIPPED,PAID
ORD-001,john@example.com,John Doe,512-555-1234,John,Doe,123 Main St,Austin,TX,78701,US,JMS-MH-002,Mild Habanero,1,9.99,8.50,2.15,SHIPPED,PAID
ORD-002,jane@example.com,Jane Smith,512-555-5678,Jane,Smith,456 Oak Ave,Dallas,TX,75201,US,JMS-FF-003,Fruit Fusion,3,11.99,9.00,3.25,DELIVERED,PAID
```

**Note**: Order ORD-001 has two line items (rows 1-2), while ORD-002 has one item (row 3).

### Import Options

When importing orders, you can specify:
- `createMissingProducts`: Auto-create products if SKU not found (default: false)
- `createMissingUsers`: Auto-create user accounts if email not found (default: false)
- `skipDuplicates`: Skip orders with existing order numbers (default: false)

---

## Gift Certificates Import

Import gift certificates for customers to purchase or receive.

### Supported Formats

- **CSV** (.csv)

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `originalAmount` | Number | Initial certificate value | `50.00` |
| `purchaserName` | String | Name of purchaser | `Alice Johnson` |
| `purchaserEmail` | Email | Email of purchaser | `alice@example.com` |
| `recipientName` | String | Name of recipient | `Bob Wilson` |

### Optional Fields

| Field | Type | Default | Description | Example |
|-------|------|---------|-------------|---------|
| `code` | String | Auto-generated | Unique certificate code | `JMS-GC-A4B2-X9Y7` |
| `balance` | Number | originalAmount | Current remaining balance | `50.00` |
| `recipientEmail` | Email | null | Recipient email for delivery | `bob@example.com` |
| `theme` | Enum | `GENERAL` | Visual theme for certificate | `BIRTHDAY` |
| `message` | String | null | Personal message to recipient | `Happy Birthday!` |
| `expiresAt` | ISO Date | null | Expiration date (null = never) | `2025-12-31T23:59:59Z` |

### Field Format Specifications

#### theme (Certificate Theme Enum)
Must be one of:
- `GENERAL` - Standard design for any occasion
- `BIRTHDAY` - Birthday-themed design
- `CHRISTMAS` - Holiday-themed design
- `BOY_CELEBRATION` - Celebration design (boy)
- `GIRL` - Celebration design (girl)

#### code (Certificate Code)
If not provided, auto-generated in format: `JMS-GC-XXXX-YYYY`
- `JMS-GC` = Prefix
- `XXXX` = Random 4-character alphanumeric
- `YYYY` = Random 4-character alphanumeric
- Uses only unambiguous characters (no O, 0, I, 1, etc.)
- System verifies uniqueness before creation

#### expiresAt (Expiration Date)
- ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`
- Leave empty for certificates that never expire
- Example: `2025-12-31T23:59:59Z`

### CSV Example

```csv
originalAmount,balance,purchaserName,purchaserEmail,recipientName,recipientEmail,theme,message,expiresAt
50.00,50.00,Alice Johnson,alice@example.com,Bob Wilson,bob@example.com,BIRTHDAY,Happy Birthday Bob! Enjoy some spicy treats!,2025-12-31T23:59:59Z
25.00,25.00,Carol Davis,carol@example.com,Dave Miller,dave@example.com,GENERAL,Thanks for being awesome!,
100.00,100.00,Eve Brown,eve@example.com,Frank White,frank@example.com,CHRISTMAS,Merry Christmas!,2024-12-31T23:59:59Z
```

---

## Retail Locations Import

Import physical retail locations that carry Jose Madrid Salsa products.

### Supported Formats

- **CSV** (.csv)

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `businessName` | String | Store/business name | `Austin Hot Sauce Shop` |
| `address` | String | Street address | `789 Congress Ave` |
| `city` | String | City name | `Austin` |
| `state` | String | State code (2+ letters) | `TX` |

### Optional Fields

| Field | Type | Default | Description | Example |
|-------|------|---------|-------------|---------|
| `zipCode` | String | null | ZIP/postal code | `78701` |
| `phone` | String | null | Business phone number | `512-555-9999` |
| `website` | URL | null | Store website | `https://austinhotsauce.com` |
| `photoUrl` | URL | null | Store photo URL | `https://example.com/store.jpg` |
| `latitude` | Number | null | GPS latitude | `30.2672` |
| `longitude` | Number | null | GPS longitude | `-97.7431` |
| `county` | String | null | County name | `Travis` |
| `isActive` | Boolean | true | Location is active | `true` |

### Field Format Specifications

#### Unique Constraint
Locations are identified by the combination of `businessName` + `address`
- This prevents duplicate locations
- Update existing: If match found and `updateExisting=true`, location is updated
- Skip existing: If match found and `updateExisting=false`, row is skipped

#### URLs (website, photoUrl)
- Must be valid URLs including protocol
- Examples: `https://example.com`, `http://store.com/photo.jpg`
- Empty strings are converted to null
- Invalid URLs will cause validation error

#### GPS Coordinates
- `latitude`: -90 to 90 (degrees)
- `longitude`: -180 to 180 (degrees)
- Both should be provided together for map features
- Leave empty if coordinates unknown

### CSV Example

```csv
businessName,address,city,state,zipCode,phone,website,latitude,longitude,county,isActive
Austin Hot Sauce Shop,789 Congress Ave,Austin,TX,78701,512-555-9999,https://austinhotsauce.com,30.2672,-97.7431,Travis,true
Dallas Specialty Foods,321 Elm Street,Dallas,TX,75201,214-555-8888,https://dallasspecialty.com,32.7767,-96.7970,Dallas,true
Houston Gourmet Market,654 Main St,Houston,TX,77002,713-555-7777,,29.7604,-95.3698,Harris,true
San Antonio Spice Co,987 Market St,San Antonio,TX,78205,210-555-6666,https://saspieco.com,29.4241,-98.4936,Bexar,false
```

---

## Troubleshooting

### Common Import Errors

#### "Name is required" / "Field is required"
**Cause**: Missing required field value
**Solution**: Ensure all required fields have values for every row

#### "Invalid email address"
**Cause**: Email field contains invalid format
**Solution**: Verify email format (must contain @ and domain)
**Example**: `user@example.com` ✓, `userexample.com` ✗

#### "Price must be positive"
**Cause**: Price, compareAtPrice, or costPrice is zero or negative
**Solution**: Ensure all price fields contain positive numbers
**Example**: `12.99` ✓, `0` ✗, `-5.00` ✗

#### "Invalid enum value"
**Cause**: Enum field contains value not in accepted list
**Solution**: Check field against accepted values (see Field Format Specifications)
**Example** (heatLevel): `EXTRA_HOT` ✓, `SUPER_HOT` ✗

#### "Category 'XYZ' not found"
**Cause**: categoryName references non-existent category
**Solution**: Create category first or use different category name
**Tip**: Category names are case-insensitive

#### "Product with SKU XYZ not found"
**Cause**: Order import references non-existent product SKU
**Solution**:
- Import/create products first before orders
- Enable `createMissingProducts` option
- Verify SKU matches exactly (case-sensitive)

#### "Excel file is empty or has no sheets"
**Cause**: Excel file has no worksheets
**Solution**: Ensure file has at least one worksheet with data

#### "CSV parsing error"
**Cause**: Malformed CSV file
**Solution**:
- Check for unescaped quotes in text fields
- Ensure consistent column count across all rows
- Verify file is UTF-8 encoded
- Use quoted strings for fields containing commas

#### "Quantity must be at least 1"
**Cause**: Order quantity is zero or negative
**Solution**: Ensure all quantity fields are positive integers ≥ 1

#### Duplicate Order Numbers
**Cause**: Attempting to import order with existing order number
**Solution**:
- Use unique order numbers
- Enable `skipDuplicates` option to skip existing orders
- Remove orderNumber field to auto-generate unique numbers

### File Encoding Issues

If you see strange characters (�, Ã, etc.) in imported data:

1. **Save as UTF-8**: In Excel, use "Save As" → "CSV UTF-8 (Comma delimited)"
2. **Text Editor**: Open in Notepad/TextEdit, save with UTF-8 encoding
3. **Google Sheets**: File → Download → CSV will automatically use UTF-8

### Large File Performance

For optimal performance with large imports:

- **CSV**: Best performance, recommended for 1000+ rows
- **Excel**: Good for up to 5000 rows
- **JSON**: Best for complex nested data, moderate files

**Tips**:
- Break large files into smaller batches (1000-2000 rows)
- Import during off-peak hours
- Monitor import progress page for real-time feedback

### Validation Before Import

To minimize errors:

1. **Verify Required Fields**: Check all required columns are present
2. **Test with Sample**: Import 5-10 rows first to verify format
3. **Check Relationships**: Ensure referenced data exists (categories, products)
4. **Validate Enums**: Confirm enum values match exactly (case-sensitive)
5. **Review Dates**: Use ISO 8601 format for all dates

---

## Template Downloads

Download pre-formatted templates for each import type:

### Product Import Templates

- **CSV Template**: [products-template.csv](#) - Simple spreadsheet format
- **Excel Template**: [products-template.xlsx](#) - Excel workbook with formatting
- **JSON Template**: [products-template.json](#) - JSON structure with examples

### Order Import Templates

- **CSV Template**: [orders-template.csv](#) - Order import spreadsheet
- **Excel Template**: [orders-template.xlsx](#) - Excel workbook for orders

### Gift Certificate Template

- **CSV Template**: [gift-certificates-template.csv](#) - Gift certificate spreadsheet

### Retail Location Template

- **CSV Template**: [locations-template.csv](#) - Location import spreadsheet

---

## Additional Resources

- **Admin Dashboard**: Access import tools at `/admin/import`
- **API Documentation**: See [API Guide](./API.md) for programmatic imports
- **Support**: Contact support@josemadridsalsa.com for import assistance
- **Data Migration**: For large-scale migrations, contact us for dedicated support

---

**Last Updated**: January 2024
**Version**: 1.0
