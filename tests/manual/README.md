# Manual Test Data for Product Import

This directory contains sample product data files for manually testing the product import functionality.

## Test Files

### 1. sample-products.csv
CSV format with 10 products including:
- **Valid products (7)**: Various heat levels, complete data, ready to import
- **Invalid price (1)**: Negative price to test validation
- **Missing SKU (1)**: Missing required field to test validation
- **Duplicate SKU (1)**: Duplicate of HSC-001 to test duplicate detection

### 2. sample-products.json
JSON format with 6 products including:
- **Valid products (3)**: Different heat levels and configurations
- **Invalid heat level (1)**: Invalid enum value "SUPER_ULTRA_HOT"
- **Missing required fields (1)**: Missing SKU and price
- **Duplicate SKU (1)**: Duplicate of SER-001 to test duplicate detection

### 3. sample-products.xlsx
Excel format with 6 products including:
- **Valid products (4)**: Complete product data
- **Missing name (1)**: Missing required field
- **Duplicate SKU (1)**: Duplicate of CHP-001 to test duplicate detection

## How to Test

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the admin products page**:
   ```
   http://localhost:3000/admin/products
   ```

3. **Click the "Import" button**

4. **Test each file type**:
   - Upload `sample-products.csv`
   - Upload `sample-products.json`
   - Upload `sample-products.xlsx`

## Expected Results

### Valid Products
- Should be imported successfully
- Should appear in the products list
- All fields should be correctly populated

### Validation Errors
- Invalid price: Should show error "Price must be positive" for row with negative price
- Missing SKU: Should show error "SKU is required" with row number
- Invalid heat level: Should show error about invalid enum value
- Missing required fields: Should show specific errors for each missing field

### Duplicate SKU Detection
- Should detect duplicate SKUs across imports
- With "Skip duplicates" option: Should skip and report skipped items
- Without "Skip duplicates" option: Should show error about duplicate SKUs

## Heat Levels

The following heat levels are valid:
- `MILD` - Gentle heat
- `MEDIUM` - Moderate heat
- `HOT` - Spicy heat
- `EXTRA_HOT` - Very spicy
- `FRUIT` - Fruit-based with heat

## Required Fields

The following fields are required for all products:
- `name` - Product name
- `slug` - URL-friendly identifier
- `sku` - Stock keeping unit (must be unique)
- `price` - Product price (must be positive)
- `heatLevel` - One of the valid heat levels above
- `categoryId` OR `categoryName` - Either category ID or name for lookup

## Optional Fields

All other fields are optional but recommended for complete product data:
- `description`, `compareAtPrice`, `costPrice`
- `inventory`, `lowStockThreshold`
- `ingredients` (comma-separated)
- `images` (comma-separated URLs)
- `barcode`, `weight`, `featuredImage`
- `isActive`, `isFeatured`, `sortOrder`
- `metaTitle`, `metaDescription`, `ogImage`
- `searchKeywords` (comma-separated)

## Regenerating the Excel File

If you need to regenerate the Excel file:

```bash
npx tsx tests/manual/generate-excel.ts
```

This will overwrite the existing `sample-products.xlsx` file.

## Notes

- Boolean fields accept: `true/false`, `yes/no`, `1/0`
- Comma-separated fields: ingredients, images, searchKeywords
- Prices are in USD (or your configured currency)
- Inventory and lowStockThreshold default to 0 and 5 respectively
