#!/usr/bin/env python3
"""
Generate complete TypeScript files with correct product data
"""

import json

# Load organized products
with open('/Users/jordanlang/Repos/josemadridsalsa/organized-products.json', 'r') as f:
    data = json.load(f)

all_products = data['all_products']
by_heat = data['by_heat_level']

print(f"Loaded {len(all_products)} products")
print("Generating TypeScript files...")
print("=" * 70)

# Category mapping
category_map = {
    'MILD': 'mildCategory',
    'MEDIUM': 'mediumCategory',
    'HOT': 'hotCategory',
    'EXTRA_HOT': 'hotCategory',  # Extra hot goes in hot category
    'FRUIT': 'fruitCategory'
}

# Generate product entries for seed.ts
def generate_seed_product(product, index):
    """Generate a product object for seed.ts"""
    name = product['name'].replace("'", "\\'")
    slug = product['slug']
    desc = product['full_description'].replace("'", "\\'")
    price = product['price']
    image = product['local_image']
    heat_level = product['heat_level']
    category = category_map[heat_level]
    sku_num = str(index + 1).zfill(3)
    
    # Determine SKU prefix
    if heat_level == 'MILD':
        sku_prefix = 'JMS-MILD'
    elif heat_level == 'MEDIUM':
        sku_prefix = 'JMS-MED'
    elif heat_level == 'HOT':
        sku_prefix = 'JMS-HOT'
    elif heat_level == 'EXTRA_HOT':
        sku_prefix = 'JMS-XHOT'
    else:
        sku_prefix = 'JMS-FRUIT'
    
    sku = f"{sku_prefix}-{sku_num}"
    
    # Mark featured products (Original Mild, Clovis Medium, Original Hot, Ghost of Clovis)
    is_featured = name in ['Original Mild', 'Clovis Medium (Original Medium Chunky)', 'Original Hot', 'Ghost of Clovis', 'Mango Habanero']
    
    return f"""    {{
      name: '{name}',
      slug: '{slug}',
      description: '{desc}',
      heatLevel: HeatLevel.{heat_level},
      ingredients: ['Fresh ingredients', 'Spices', 'Premium produce'],
      price: {price},
      sku: '{sku}',
      inventory: 100,
      weight: 16.0,
      categoryId: {category}.id,
      {'isFeatured: true,' if is_featured else ''}
      images: ['{image}'],
      featuredImage: '{image}',
      searchKeywords: {json.dumps(name.lower().split())},
    }},"""

# Generate seed.ts products array
print("\n1. Generating seed.ts products...")
seed_products = []
for idx, product in enumerate(all_products):
    seed_products.append(generate_seed_product(product, idx))

seed_output = '\n'.join(seed_products)

print(f"   ✓ Generated {len(seed_products)} product entries for seed.ts")

# Save to file for review
with open('/Users/jordanlang/Repos/josemadridsalsa/generated-seed-products.txt', 'w') as f:
    f.write(seed_output)

print(f"   ✓ Saved to: generated-seed-products.txt")

# Generate salsas page mock data
print("\n2. Generating salsas/page.tsx mock data...")

def generate_page_product(product, index):
    """Generate a product object for page.tsx"""
    name = product['name'].replace('"', '\\"')
    slug = product['slug']
    desc = product['full_description'].replace('"', '\\"')
    price = product['price']
    image = product['local_image']
    heat_level = product['heat_level']
    
    sku_num = str(index + 1).zfill(3)
    if heat_level == 'MILD':
        sku_prefix = 'JMS-MILD'
    elif heat_level == 'MEDIUM':
        sku_prefix = 'JMS-MED'
    elif heat_level == 'HOT':
        sku_prefix = 'JMS-HOT'
    elif heat_level == 'EXTRA_HOT':
        sku_prefix = 'JMS-XHOT'
    else:
        sku_prefix = 'JMS-FRUIT'
    
    sku = f"{sku_prefix}-{sku_num}"
    
    is_featured = name in ['Original Mild', 'Clovis Medium (Original Medium Chunky)', 'Original Hot', 'Ghost of Clovis', 'Mango Habanero']
    
    return f"""  {{
    id: '{index + 1}',
    name: "{name}",
    slug: "{slug}",
    description: "{desc}",
    price: {price},
    featuredImage: "{image}",
    heatLevel: '{heat_level}',
    sku: '{sku}',
    inventory: 100,
    isFeatured: {'true' if is_featured else 'false'},
  }},"""

page_products = []
for idx, product in enumerate(all_products):
    page_products.append(generate_page_product(product, idx))

page_output = '\n'.join(page_products)

with open('/Users/jordanlang/Repos/josemadridsalsa/generated-page-products.txt', 'w') as f:
    f.write(page_output)

print(f"   ✓ Generated {len(page_products)} product entries for salsas/page.tsx")
print(f"   ✓ Saved to: generated-page-products.txt")

# Summary report
print("\n" + "=" * 70)
print("GENERATION COMPLETE")
print("=" * 70)
print(f"\nTotal products: {len(all_products)}")
print(f"All priced at: $7.00")
print("\nNext steps:")
print("1. Review generated-seed-products.txt")
print("2. Review generated-page-products.txt")
print("3. Update prisma/seed.ts with the new product data")
print("4. Update app/salsas/page.tsx with the new product data")
print("5. Update app/api/products/featured/route.ts with featured products")
print("=" * 70)
