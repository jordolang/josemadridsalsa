#!/usr/bin/env python3
"""
Create complete seed.ts file with all correct product data from scraped JSON
"""

import json

# Load scraped products
with open('/Users/jordanlang/Repos/josemadridsalsa/scraped-products.json', 'r') as f:
    products = json.load(f)

# Filter out bundle products
individual_products = [p for p in products if not p['name'].startswith('Choose-')]

# Image mappings
image_map = {
    'cherry-hot': 'cherry-hot.jpg',
    'green-apple': 'green-apple.jpg',
    'ghost-of-clovis': 'ghost-of-clovis.png',
    'mango-habanero': 'mango-habanero.png',
    'peach-mild-1': 'peach-mild.png',
    'spanish-verde-x-x-hot': 'spanish-verde-xx-hot.jpg',
    'spanish-verde-mild': 'spanish-verde-mild.png',
    'spanish-verde-hot': 'spanish-verde-hot.jpg',
    'strawberry-mild': 'strawberry-mild.jpg',
    'roasted-pineapple-habanero-hot': 'roasted-pineapple-habanero-hot.jpg',
    'roasted-garlic-olives': 'roasted-garlic-olives.jpg',
    'raspberry-mild': 'raspberry-mild.jpg',
    'raspberry-bbq-chipotle': 'raspberry-bbq-chipotle.jpg',
    'pineapple-mild': 'pineapple-mild.jpg',
    'mango-mild': 'mango-mild.jpg',
    'jamaican-jerk': 'jamaican-jerk.png',
    'garden-fresh-cilantro-salsa-mild': 'garden-cilantro-mild.jpg',
    'original-mild': 'original-mild.jpg',
    'garden-fresh-cilantro-salsa-hot': 'garden-cilantro-hot.jpg',
    'original-x-hot': 'original-x-hot.jpg',
    'clovis-medium-original-medium-chunky': 'clovis-medium.png',
    'chipotle-con-queso': 'chipotle-queso.jpg',
    'chipotle-hot': 'chipotle-hot.png',
    'original-hot': 'original-hot.jpg',
    'cherry-mild': 'cherry-mild.jpg',
    'cherry-chocolate-hot': 'cherry-chocolate-hot.jpg',
    'black-bean-corn-pablano': 'black-bean-corn-poblano.jpg',
}

descriptions = {
    'Cherry Hot': 'Sweet cherries meet fiery heat in this unique hot salsa with bold flavors.',
    'Green Apple': 'Crisp green apples bring a tart, refreshing twist to this unique fruit salsa.',
    'Ghost of Clovis': 'An otherworldly hot salsa featuring ghost peppers that will haunt your taste buds.',
    'Mango Habanero': 'Sweet tropical mango meets spicy habanero peppers in perfect balance.',
    'Peach Mild': 'Sweet, juicy peaches create a delightfully fruity and mild salsa.',
    'Spanish Verde X X Hot': 'A double-extra-hot green salsa made with tomatillos and the hottest peppers.',
    'Spanish Verde Mild': 'A mild green salsa with fresh tomatillos and herbs.',
    'Spanish Verde Hot': 'A fiery green salsa with tomatillos and hot peppers for serious heat lovers.',
    'Strawberry Mild': 'Fresh strawberries bring unexpected sweetness to this unique mild salsa.',
    'Roasted Pineapple Habanero Hot': 'Roasted tropical pineapple balances intense habanero heat.',
    'Roasted Garlic & Olives': 'Mediterranean-inspired salsa with roasted garlic and briny olives.',
    'Raspberry Mild': 'Tart raspberries create a sophisticated, mildly sweet salsa.',
    'Raspberry BBQ Chipotle': 'Raspberries meet smoky chipotle and BBQ spices - perfect for grilling.',
    'Pineapple Mild': 'Tropical pineapple brings bright, sweet flavors to this refreshing mild salsa.',
    'Mango Mild': 'Ripe mangos blend beautifully with mild spices for a tropical twist.',
    'Jamaican Jerk': 'Caribbean spices and scotch bonnet peppers create authentic Jamaican jerk flavors.',
    'Garden Fresh Cilantro Salsa Mild': 'Fresh cilantro takes center stage in this bright, herbaceous mild salsa.',
    'Original Mild': 'Our signature mild salsa made with fresh tomatoes, onions, and perfect spices.',
    'Garden Fresh Cilantro Salsa Hot': 'Fresh cilantro meets fiery peppers in this bright, spicy salsa.',
    'Original X Hot': 'Our hottest salsa yet! Fire-roasted peppers create intense heat and incredible flavor.',
    'Clovis Medium (Original Medium Chunky)': 'Our most popular salsa! Perfect balance of flavor and heat.',
    'Chipotle Con Queso': 'Creamy cheese dip with smoky chipotle peppers - perfect for chips.',
    'Chipotle Hot': 'Smoky chipotle peppers deliver intense heat and deep, complex flavors.',
    'Original Hot': 'For heat lovers! This bold salsa packs serious flavor with a kick that builds.',
    'Cherry Mild': 'Sweet cherries create a delightfully fruity and mild salsa.',
    'Cherry Chocolate Hot': 'Dark cherries and rich chocolate meet scorching heat in this gourmet salsa.',
    'Black Bean Corn Pablano': 'A hearty salsa with black beans, sweet corn, and roasted poblano peppers.',
}

category_map = {
    'MILD': 'mildCategory',
    'MEDIUM': 'mediumCategory',
    'HOT': 'hotCategory',
    'EXTRA_HOT': 'hotCategory',
    'FRUIT': 'fruitCategory'
}

# Generate product entries
product_entries = []
for idx, p in enumerate(individual_products):
    name = p['name'].replace("'", "\\'").replace('&', '&amp;')
    slug = p['slug']
    desc = descriptions.get(p['name'], f"Delicious {p['name']} salsa").replace("'", "\\'")
    heat = p['heat_level']
    category = category_map[heat]
    image = f"/images/products/{image_map.get(slug, slug + '.jpg')}"
    
    # SKU generation
    if heat == 'MILD':
        sku_prefix = 'JMS-MILD'
    elif heat == 'MEDIUM':
        sku_prefix = 'JMS-MED'
    elif heat == 'HOT':
        sku_prefix = 'JMS-HOT'
    elif heat == 'EXTRA_HOT':
        sku_prefix = 'JMS-XHOT'
    else:
        sku_prefix = 'JMS-FRUIT'
    
    sku = f"{sku_prefix}-{str(idx+1).zfill(3)}"
    
    # Featured products
    featured = name in ['Original Mild', 'Clovis Medium (Original Medium Chunky)', 'Original Hot', 'Ghost of Clovis', 'Mango Habanero']
    featured_line = '      isFeatured: true,' if featured else ''
    
    entry = f"""    {{
      name: '{name}',
      slug: '{slug}',
      description: '{desc}',
      heatLevel: HeatLevel.{heat},
      ingredients: ['Fresh ingredients', 'Spices', 'Premium produce'],
      price: 7.0,
      sku: '{sku}',
      inventory: 100,
      weight: 16.0,
      categoryId: {category}.id,
{featured_line}
      images: ['{image}'],
      featuredImage: '{image}',
      searchKeywords: {json.dumps(name.lower().split())},
    }},"""
    
    product_entries.append(entry)

# Now create the complete seed.ts file
seed_content = """import { PrismaClient } from '@prisma/client'
import { HeatLevel } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean up existing data
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.wishlistItem.deleteMany()
  await prisma.review.deleteMany()
  await prisma.fundraiserProduct.deleteMany()
  await prisma.fundraiser.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.address.deleteMany()
  await prisma.wholesaleAccount.deleteMany()
  await prisma.user.deleteMany()

  console.log('🗑️  Cleaned existing data')

  // Create categories
  const mildCategory = await prisma.category.create({
    data: {
      name: 'Mild Salsa',
      slug: 'mild-salsa',
      description: 'Perfect for those who enjoy flavor without the heat. Great for kids and mild palates.',
      metaTitle: 'Mild Salsa - Jose Madrid Salsa',
      metaDescription: 'Discover our mild salsa varieties, perfect for those who prefer flavor without the heat.',
      sortOrder: 1,
    },
  })

  const mediumCategory = await prisma.category.create({
    data: {
      name: 'Medium Salsa',
      slug: 'medium-salsa',
      description: 'The perfect balance of flavor and heat. Our most popular choice for everyday enjoyment.',
      metaTitle: 'Medium Salsa - Jose Madrid Salsa',
      metaDescription: 'Try our medium heat salsa - the perfect balance of flavor and spice.',
      sortOrder: 2,
    },
  })

  const hotCategory = await prisma.category.create({
    data: {
      name: 'Hot Salsa',
      slug: 'hot-salsa',
      description: 'For those who love the heat! Bold flavors with a serious kick that builds with each bite.',
      metaTitle: 'Hot Salsa - Jose Madrid Salsa',
      metaDescription: 'Experience our hot salsa varieties for those who love bold flavors and serious heat.',
      sortOrder: 3,
    },
  })

  const fruitCategory = await prisma.category.create({
    data: {
      name: 'Gourmet & Fruit Salsa',
      slug: 'gourmet-fruit-salsa',
      description: 'Unique gourmet salsas featuring fresh fruits and premium ingredients.',
      metaTitle: 'Gourmet & Fruit Salsa - Jose Madrid Salsa',
      metaDescription: 'Explore our gourmet and fruit salsa collection with unique flavors and premium ingredients.',
      sortOrder: 4,
    },
  })

  console.log('✅ Created categories')

  // Create products - ALL 27 individual jars from josemadridsalsa.com at $7.00
  const products = [
""" + '\n'.join(product_entries) + """
  ]

  for (const productData of products) {
    await prisma.product.create({
      data: {
        ...productData,
        price: productData.price,
        compareAtPrice: productData.compareAtPrice || null,
        costPrice: productData.costPrice || null,
        weight: productData.weight || null,
      },
    })
  }

  console.log('✅ Created 27 products - all priced at $7.00')

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@josemadridsalsa.com',
      name: 'Jose Madrid',
      role: 'ADMIN',
      isEmailVerified: true,
      phone: '740-521-4304',
    },
  })

  // Create sample customer
  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      name: 'John Customer',
      role: 'CUSTOMER',
      isEmailVerified: true,
      phone: '555-123-4567',
    },
  })

  // Create customer address
  await prisma.address.create({
    data: {
      userId: customer.id,
      type: 'BOTH',
      firstName: 'John',
      lastName: 'Customer',
      street: '123 Main Street',
      city: 'Columbus',
      state: 'OH',
      zipCode: '43215',
      country: 'US',
      phone: '555-123-4567',
      isDefault: true,
    },
  })

  console.log('✅ Created users and addresses')

  // Create sample fundraiser
  await prisma.fundraiser.create({
    data: {
      name: 'Spring Band Fundraiser',
      slug: 'spring-band-fundraiser',
      description: 'Help support our school band program by purchasing delicious Jose Madrid Salsa!',
      organizationName: 'Springfield High School Band',
      contactEmail: 'band@springfieldhs.edu',
      contactPhone: '555-987-6543',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-04-30'),
      goal: 5000.00,
      commissionRate: 40.00,
      status: 'ACTIVE',
      isActive: true,
    },
  })

  console.log('✅ Created sample fundraiser')
  console.log('\\n🎉 Database seeded successfully with correct data!')
  console.log('📦 All 27 individual jars priced at $7.00')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
"""

# Write the complete seed.ts file
output_path = '/Users/jordanlang/Repos/josemadridsalsa/prisma/seed.ts'
with open(output_path, 'w') as f:
    f.write(seed_content)

print("=" * 70)
print("✅ COMPLETE SEED.TS FILE GENERATED")
print("=" * 70)
print(f"Written to: {output_path}")
print(f"Total products: {len(individual_products)}")
print(f"All priced at: $7.00")
print("\nFile is ready to use!")
print("=" * 70)
