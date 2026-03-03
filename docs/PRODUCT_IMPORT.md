# Product Import Feature

The product import feature allows administrators to bulk import products from JSON, CSV, or Excel files.

## Access

Navigate to **Admin Panel > Products** and click the **Import** button (requires `products:import` permission).

## Supported File Formats

- **JSON** (.json)
- **CSV** (.csv)
- **Excel** (.xlsx, .xls)

Maximum file size: **10MB**

## Required Fields

The following fields are required for each product:

- `name` - Product name
- `slug` - URL-friendly slug (must be unique)
- `sku` - Stock Keeping Unit (must be unique)
- `price` - Product price (numeric)
- `heatLevel` - One of: `MILD`, `MEDIUM`, `HOT`, `EXTRA_HOT`, `FRUIT`
- `categoryId` OR `categoryName` - Product category

## Optional Fields

- `description` - Product description
- `compareAtPrice` - Original price for showing discounts
- `costPrice` - Internal cost price
- `inventory` - Stock quantity (default: 0)
- `lowStockThreshold` - Alert threshold (default: 5)
- `ingredients` - Comma-separated list of ingredients
- `barcode` - Product barcode
- `weight` - Product weight in ounces
- `featuredImage` - URL or relative path to featured image (e.g., `/images/products/mild.jpg`)
- `images` - Comma-separated URLs or paths to additional images
- `isActive` - Active status (true/false, yes/no, 1/0)
- `isFeatured` - Featured status (true/false, yes/no, 1/0)
- `sortOrder` - Sort order (numeric, default: 0)
- `metaTitle` - SEO meta title
- `metaDescription` - SEO meta description
- `ogImage` - Open Graph image URL or relative path
- `searchKeywords` - Comma-separated search keywords

## File Format Examples

### JSON Format

```json
[
  {
    "name": "Mild Salsa",
    "slug": "mild-salsa",
    "sku": "MILD-001",
    "description": "A delicious mild salsa",
    "price": 8.99,
    "compareAtPrice": 10.99,
    "inventory": 50,
    "heatLevel": "MILD",
    "ingredients": "Tomatoes, Onions, Cilantro, Lime Juice, Salt",
    "categoryName": "Salsa",
    "isActive": true,
    "isFeatured": false
  }
]
```

You can also use an object with a `products` array:

```json
{
  "products": [
    { ... },
    { ... }
  ]
}
```

### CSV Format

```csv
name,slug,sku,description,price,heatLevel,ingredients,categoryName,isActive
"Mild Salsa",mild-salsa,MILD-001,"A delicious mild salsa",8.99,MILD,"Tomatoes, Onions, Cilantro",Salsa,true
"Hot Salsa",hot-salsa,HOT-001,"Spicy salsa",9.99,HOT,"Tomatoes, Habanero",Salsa,yes
```

### Excel Format

Create an Excel spreadsheet with the same column headers as the CSV format. The first row should contain the field names, and each subsequent row represents a product.

## Import Process

1. Click the **Import** button on the Products page
2. Select your file (JSON, CSV, or Excel)
3. The file type will be auto-detected based on the extension
4. Optionally check **"Skip products with duplicate SKUs"** to only import new products
5. Click **Import Products**

### Duplicate Handling

- By default, the import will fail if any SKUs already exist in the database
- Enable **"Skip duplicates"** to import only new products and skip existing ones
- Duplicate SKUs within the import file itself will always cause an error

## Validation

The system validates all data before importing:

- Required fields must be present
- Numeric fields must contain valid numbers
- Heat levels must match allowed values
- Categories must exist (by name or ID)
- SKUs must be unique

If validation fails, you'll see detailed error messages for each row that has issues.

## Sample Files

Sample import files are available in the `/public/samples/` directory:

- `products-import-sample.json` - JSON example
- `products-import-sample.csv` - CSV example

## Tips

1. **Test with small batches** - Start with a few products to ensure your format is correct
2. **Use category names** - It's easier to use `categoryName` than looking up category IDs
3. **Boolean values** - Accepts `true/false`, `yes/no`, or `1/0` for boolean fields
4. **Comma-separated values** - For arrays like ingredients, images, and keywords
5. **Verify required fields** - Double-check that all required fields are present before importing

## Permissions

The following permission is required:
- `products:import` - Import products from files

This permission is granted to ADMIN, DEVELOPER, and STAFF roles by default.

## Troubleshooting

### "Category not found" error
- Ensure the category name exactly matches an existing category in your system
- Category matching is case-insensitive
- Alternatively, use `categoryId` with the exact category ID

### "Duplicate SKU" error
- Check that all SKUs in your file are unique
- Enable "Skip duplicates" if you want to import only new products
- Verify existing products don't have conflicting SKUs

### "Invalid heat level" error
- Must be one of: `MILD`, `MEDIUM`, `HOT`, `EXTRA_HOT`, `FRUIT`
- Case-sensitive - use all caps

### File too large
- Maximum file size is 10MB
- Split large imports into smaller batches
- Remove unnecessary columns to reduce file size
