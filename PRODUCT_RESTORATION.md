# Product Restoration Guide

This guide documents the process of restoring products from your old BigCommerce site to the new Jose Madrid Salsa website.

## Overview

Your original `products.csv` file from BigCommerce had a different format than what the new import system expects. We've created tools to transform the old format to the new format and import the products.

## Files Created

### 1. Transform Script
**Location:** `scripts/transform-products-csv.ts`

Transforms old BigCommerce CSV format to new import format.

**Old format fields:**
- `id`, `name`, `slug`, `url`, `price`, `heat_level`, `image_url`, `local_image`, `full_description`

**New format fields:**
- `name`, `slug`, `sku`, `description`, `price`, `heatLevel`, `categoryName`, `featuredImage`, `isActive`, `isFeatured`, `inventory`, `lowStockThreshold`, `weight`

**Transformations applied:**
- `id` → `sku` (with JMS- prefix, e.g., JMS-135)
- `full_description` → `description`
- `heat_level` → `heatLevel` (uppercase)
- `local_image` or `image_url` → `featuredImage`
- Default values: inventory=50, weight=16, categoryName='Salsa', isActive=true

### 2. Category Setup Script
**Location:** `scripts/ensure-salsa-category.ts`

Ensures the "Salsa" category exists in the database before importing products.

### 3. Package.json Scripts

Two new commands have been added:

```bash
# Transform products.csv to products-transformed.csv
npm run products:transform

# Ensure Salsa category exists in database
npm run products:ensure-category
```

## Step-by-Step Restoration Process

### Step 1: Prepare Your CSV File

Place your `products.csv` file in the project root:
```
/Users/jordanlang/Repos/josemadridsalsa/products.csv
```

### Step 2: Transform the CSV

Run the transformation script:
```bash
npm run products:transform
```

This will create `products-transformed.csv` with all 27 products in the correct format.

### Step 3: Ensure Category Exists

Make sure the "Salsa" category exists:
```bash
npm run products:ensure-category
```

### Step 4: Import via Web UI

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to the Admin Panel → Products

3. Click the **Import** button

4. Upload `products-transformed.csv`

5. Select file type: **CSV**

6. Check **"Skip products with duplicate SKUs"** if you want to avoid errors on re-import

7. Click **Import Products**

### Alternative: Direct Import via API

You can also use curl to import directly:

```bash
curl -X POST http://localhost:3000/api/admin/products/import \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -F "file=@products-transformed.csv" \
  -F "fileType=csv" \
  -F "skipDuplicates=false"
```

## Transformed Products Summary

✅ **27 products** successfully transformed from the old format:

- Cherry Hot (JMS-135)
- Green Apple (JMS-130)
- Ghost of Clovis (JMS-129)
- Mango Habanero (JMS-128)
- Peach Mild (JMS-124)
- Spanish Verde X X Hot (JMS-116)
- Spanish Verde Mild (JMS-115)
- Spanish Verde Hot (JMS-114)
- Strawberry Mild (JMS-113)
- Roasted Pineapple Habanero Hot (JMS-112)
- Roasted Garlic & Olives (JMS-111)
- Raspberry Mild (JMS-110)
- Raspberry BBQ Chipotle (JMS-109)
- Pineapple Mild (JMS-108)
- Mango Mild (JMS-107)
- Jamaican Jerk (JMS-106)
- Garden Fresh Cilantro Salsa Mild (JMS-105)
- Original Mild (JMS-104)
- Garden Fresh Cilantro Salsa Hot (JMS-103)
- Original X Hot (JMS-102)
- Clovis Medium (JMS-101)
- Chipotle Con Queso (JMS-100)
- Chipotle Hot (JMS-99)
- Original Hot (JMS-98)
- Cherry Mild (JMS-97)
- Cherry Chocolate Hot (JMS-96)
- Black Bean Corn Pablano (JMS-95)

## Customizing After Import

After importing, you may want to:

### 1. Update Categories
Some products might fit better in other categories:
- Navigate to Admin → Products
- Edit individual products
- Change category from "Salsa" to:
  - "Mild Salsa"
  - "Medium Salsa"
  - "Hot Salsa"
  - "Gourmet & Fruit Salsa"

### 2. Update Prices
All products are set to $7.00 by default. Update as needed.

### 3. Update Inventory
Default inventory is set to 50 units. Adjust based on actual stock.

### 4. Add Product Images
The transformation uses the `local_image` field when available:
- Images are expected in `/images/products/` directory
- Make sure all referenced images exist
- Upload missing images to `/public/images/products/`

### 5. Update Product Details
- Add or refine descriptions
- Add ingredients lists
- Update heat levels if needed
- Add search keywords for better SEO

## Troubleshooting

### "Category not found" Error
Run: `npm run products:ensure-category`

### Duplicate SKU Errors
- Enable "Skip duplicates" option in the import dialog
- Or delete existing products first via Admin → Products

### Invalid Heat Level
Heat levels must be one of:
- `MILD`
- `MEDIUM`
- `HOT`
- `EXTRA_HOT`
- `FRUIT`

(All uppercase)

### Missing Images
If images are not displaying:
1. Check that files exist in `/public/images/products/`
2. Verify the file names match what's in `featuredImage` column
3. Download missing images from BigCommerce if needed

## Re-running the Process

If you need to re-import:

1. Delete existing products (if desired):
   - Admin → Products → Select All → Delete

2. Or use "Skip duplicates" option when importing

3. The transform script can be re-run safely - it will overwrite `products-transformed.csv`

## Files Generated

- `products-transformed.csv` - Transformed product data ready for import
- SKUs generated as `JMS-{original_id}` (e.g., JMS-135, JMS-130, etc.)

## Future Imports

For future product imports, use the standard format documented in:
- `docs/PRODUCT_IMPORT.md`
- Sample file: `public/samples/products-import-sample.csv`

The new format is more comprehensive and includes all modern e-commerce fields.
