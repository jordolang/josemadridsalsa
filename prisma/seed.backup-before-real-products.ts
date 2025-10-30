import { PrismaClient } from '@prisma/client'
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

  // Create products - REAL products from josemadridsalsa.com
  const products = [
    // Mild Salsas
    {
      name: 'Jose Madrid Original Mild',
      slug: 'jose-madrid-original-mild',
      description: 'Our signature mild salsa made with fresh tomatoes, onions, and a perfect blend of spices. Great for the whole family.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Tomatoes', 'Onions', 'Bell Peppers', 'Garlic', 'Vinegar', 'Salt', 'Spices'],
      price: 8.99,
      compareAtPrice: 10.99,
      costPrice: 4.50,
      sku: 'JMS-MILD-001',
      inventory: 150,
      weight: 16.0,
      categoryId: mildCategory.id,
      isFeatured: true,
      images: ['/images/products/mild.png', '/images/products/original-mild-1.jpg'],
      featuredImage: '/images/products/mild.png',
      searchKeywords: ['mild', 'family friendly', 'tomato', 'signature', 'original'],
      metaTitle: 'Jose Madrid Original Mild Salsa - Perfect for the Whole Family',
      metaDescription: 'Our signature mild salsa with fresh tomatoes and perfect spice blend. Great for kids and mild palates.',
    },
    {
      name: 'Garden Fresh Mild Salsa',
      slug: 'garden-fresh-mild-salsa',
      description: 'Made with garden-fresh vegetables and herbs, this mild salsa brings out the natural flavors of fresh produce.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Fresh Tomatoes', 'Sweet Onions', 'Cilantro', 'Lime Juice', 'Sea Salt'],
      price: 9.49,
      sku: 'JMS-MILD-002',
      inventory: 120,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/garden-mild-1.jpg'],
      featuredImage: '/images/products/garden-mild-1.jpg',
      searchKeywords: ['garden fresh', 'vegetables', 'herbs', 'natural'],
    },
    {
      name: 'Garden Cilantro Mild',
      slug: 'garden-cilantro-mild',
      description: 'Fresh cilantro takes center stage in this bright, herbaceous mild salsa.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Fresh Cilantro', 'Tomatoes', 'Onions', 'Lime', 'Garlic', 'Sea Salt'],
      price: 9.49,
      sku: 'JMS-MILD-003',
      inventory: 100,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/garden-cilantro-mild-1.jpg'],
      featuredImage: '/images/products/garden-cilantro-mild-1.jpg',
      searchKeywords: ['cilantro', 'garden', 'fresh', 'herbaceous'],
    },
    {
      name: 'Spanish Verde Mild',
      slug: 'spanish-verde-mild',
      description: 'A mild green salsa with tomatillos and fresh herbs, inspired by traditional Spanish verde sauces.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Tomatillos', 'Green Peppers', 'Cilantro', 'Onions', 'Lime', 'Cumin'],
      price: 9.99,
      sku: 'JMS-MILD-004',
      inventory: 90,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/spanish-verde-mild.png'],
      featuredImage: '/images/products/spanish-verde-mild.png',
      searchKeywords: ['verde', 'green', 'tomatillo', 'spanish'],
    },
    {
      name: 'Peach Mild Salsa',
      slug: 'peach-mild-salsa',
      description: 'Sweet, juicy peaches create a delightfully fruity and mild salsa perfect for any occasion.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Fresh Peaches', 'Tomatoes', 'Sweet Onions', 'Honey', 'Cinnamon'],
      price: 10.99,
      sku: 'JMS-MILD-005',
      inventory: 85,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/peach-mild.png'],
      featuredImage: '/images/products/peach-mild.png',
      searchKeywords: ['peach', 'fruit', 'sweet', 'mild'],
    },
    {
      name: 'Pineapple Mild Salsa',
      slug: 'pineapple-mild-salsa',
      description: 'Tropical pineapple brings bright, sweet flavors to this refreshing mild salsa.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Fresh Pineapple', 'Bell Peppers', 'Onions', 'Lime', 'Mint'],
      price: 10.49,
      sku: 'JMS-MILD-006',
      inventory: 80,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/pineapple-mild.png'],
      featuredImage: '/images/products/pineapple-mild.png',
      searchKeywords: ['pineapple', 'tropical', 'fruit', 'sweet'],
    },
    {
      name: 'Mango Mild Salsa',
      slug: 'mango-mild-salsa',
      description: 'Ripe mangos blend beautifully with mild spices for a tropical twist on traditional salsa.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Fresh Mango', 'Tomatoes', 'Red Onions', 'Lime', 'Cilantro'],
      price: 10.99,
      sku: 'JMS-MILD-007',
      inventory: 75,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/mango-mild-1.jpg'],
      featuredImage: '/images/products/mango-mild-1.jpg',
      searchKeywords: ['mango', 'tropical', 'fruit', 'mild'],
    },
    {
      name: 'Strawberry Mild Salsa',
      slug: 'strawberry-mild-salsa',
      description: 'Fresh strawberries bring unexpected sweetness to this unique, mild fruit salsa.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Fresh Strawberries', 'Tomatoes', 'Red Onions', 'Basil', 'Balsamic'],
      price: 11.49,
      sku: 'JMS-MILD-008',
      inventory: 70,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/strawberry-mild-1.jpg'],
      featuredImage: '/images/products/strawberry-mild-1.jpg',
      searchKeywords: ['strawberry', 'fruit', 'sweet', 'unique'],
    },
    {
      name: 'Raspberry Mild Salsa',
      slug: 'raspberry-mild-salsa',
      description: 'Tart raspberries create a sophisticated, mildly sweet salsa with complex flavors.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Fresh Raspberries', 'Tomatoes', 'Red Onions', 'Lime', 'Mint'],
      price: 11.49,
      sku: 'JMS-MILD-009',
      inventory: 65,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/raspberry-mild-1.jpg'],
      featuredImage: '/images/products/raspberry-mild-1.jpg',
      searchKeywords: ['raspberry', 'fruit', 'tart', 'gourmet'],
    },

    // Medium Salsas
    {
      name: 'Clovis Medium Salsa',
      slug: 'clovis-medium-salsa',
      description: 'Our most popular salsa! The perfect balance of flavor and heat that everyone loves.',
      heatLevel: HeatLevel.MEDIUM,
      ingredients: ['Tomatoes', 'Jalapeño Peppers', 'Onions', 'Garlic', 'Cilantro', 'Lime', 'Spices'],
      price: 8.99,
      compareAtPrice: 10.99,
      costPrice: 4.50,
      sku: 'JMS-MED-001',
      inventory: 200,
      weight: 16.0,
      categoryId: mediumCategory.id,
      isFeatured: true,
      images: ['/images/products/clovis-medium.png', '/images/products/medium-salsa-1.jpg'],
      featuredImage: '/images/products/clovis-medium.png',
      searchKeywords: ['medium', 'popular', 'balanced', 'jalapeño', 'clovis'],
      metaTitle: 'Clovis Medium Salsa - Perfect Balance of Flavor & Heat',
      metaDescription: 'Our most popular medium salsa with the perfect balance of flavor and heat. Made with fresh jalapeños.',
    },
    {
      name: 'Smoky Chipotle Medium Salsa',
      slug: 'smoky-chipotle-medium-salsa',
      description: 'Rich, smoky flavor from chipotle peppers adds depth to this medium-heat salsa.',
      heatLevel: HeatLevel.MEDIUM,
      ingredients: ['Fire-Roasted Tomatoes', 'Chipotle Peppers', 'Onions', 'Garlic', 'Cumin', 'Paprika'],
      price: 9.99,
      sku: 'JMS-MED-002',
      inventory: 100,
      weight: 16.0,
      categoryId: mediumCategory.id,
      images: ['/images/products/chipotle-medium-1.jpg'],
      featuredImage: '/images/products/chipotle-medium-1.jpg',
      searchKeywords: ['smoky', 'chipotle', 'fire-roasted', 'depth'],
    },
    {
      name: 'Black Bean Corn Poblano',
      slug: 'black-bean-corn-poblano',
      description: 'A hearty salsa with black beans, sweet corn, and roasted poblano peppers.',
      heatLevel: HeatLevel.MEDIUM,
      ingredients: ['Black Beans', 'Sweet Corn', 'Poblano Peppers', 'Tomatoes', 'Cumin', 'Lime'],
      price: 9.99,
      sku: 'JMS-MED-003',
      inventory: 90,
      weight: 16.0,
      categoryId: mediumCategory.id,
      images: ['/images/products/black-bean-corn-poblano-salsa.png'],
      featuredImage: '/images/products/black-bean-corn-poblano-salsa.png',
      searchKeywords: ['black bean', 'corn', 'poblano', 'hearty'],
    },

    // Hot Salsas
    {
      name: 'Jose Madrid Original Hot',
      slug: 'jose-madrid-original-hot',
      description: 'For heat lovers! This bold salsa packs serious flavor with a kick that builds with each bite.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Tomatoes', 'Serrano Peppers', 'Habanero Peppers', 'Onions', 'Garlic', 'Vinegar', 'Spices'],
      price: 9.49,
      compareAtPrice: 11.49,
      costPrice: 4.75,
      sku: 'JMS-HOT-001',
      inventory: 80,
      weight: 16.0,
      categoryId: hotCategory.id,
      isFeatured: true,
      images: ['/images/products/hot.png', '/images/products/original-hot-1.jpg'],
      featuredImage: '/images/products/hot.png',
      searchKeywords: ['hot', 'heat lovers', 'serrano', 'habanero', 'bold', 'original'],
      metaTitle: 'Jose Madrid Original Hot Salsa - For Serious Heat Lovers',
      metaDescription: 'Our hot salsa packs serious heat and bold flavor with serrano and habanero peppers.',
    },
    {
      name: 'Chipotle Hot Salsa',
      slug: 'chipotle-hot-salsa',
      description: 'Smoky chipotle peppers deliver intense heat and deep, complex flavors.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Chipotle Peppers', 'Fire-Roasted Tomatoes', 'Habanero', 'Onions', 'Garlic'],
      price: 9.99,
      sku: 'JMS-HOT-002',
      inventory: 75,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/chipotle-hot.png'],
      featuredImage: '/images/products/chipotle-hot.png',
      searchKeywords: ['chipotle', 'smoky', 'hot', 'intense'],
    },
    {
      name: 'Garden Cilantro Hot',
      slug: 'garden-cilantro-hot',
      description: 'Fresh cilantro meets fiery peppers in this bright, spicy salsa.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Fresh Cilantro', 'Serrano Peppers', 'Habanero', 'Tomatoes', 'Lime', 'Garlic'],
      price: 9.99,
      sku: 'JMS-HOT-003',
      inventory: 70,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/garden-cilantro-hot-1.jpg'],
      featuredImage: '/images/products/garden-cilantro-hot-1.jpg',
      searchKeywords: ['cilantro', 'hot', 'fresh', 'spicy'],
    },
    {
      name: 'Verde Hot Salsa',
      slug: 'verde-hot-salsa',
      description: 'A fiery green salsa with tomatillos and hot peppers for serious heat lovers.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Tomatillos', 'Serrano Peppers', 'Habanero', 'Cilantro', 'Lime', 'Garlic'],
      price: 10.49,
      sku: 'JMS-HOT-004',
      inventory: 65,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/verde-hot-1.jpg'],
      featuredImage: '/images/products/verde-hot-1.jpg',
      searchKeywords: ['verde', 'green', 'hot', 'tomatillo'],
    },
    {
      name: 'Cherry Hot Salsa',
      slug: 'cherry-hot-salsa',
      description: 'Sweet cherries balance the heat in this unique hot salsa with complex flavors.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Fresh Cherries', 'Habanero Peppers', 'Tomatoes', 'Red Onions', 'Balsamic'],
      price: 11.99,
      sku: 'JMS-HOT-005',
      inventory: 60,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/cherry-hot.jpg'],
      featuredImage: '/images/products/cherry-hot.jpg',
      searchKeywords: ['cherry', 'fruit', 'hot', 'sweet heat'],
    },
    {
      name: 'Jamaican Jerk Hot',
      slug: 'jamaican-jerk-hot',
      description: 'Caribbean spices and scotch bonnet peppers create authentic Jamaican jerk flavors.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Scotch Bonnet Peppers', 'Allspice', 'Thyme', 'Ginger', 'Garlic', 'Scallions'],
      price: 11.49,
      sku: 'JMS-HOT-006',
      inventory: 55,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/jamaican-jerk.png'],
      featuredImage: '/images/products/jamaican-jerk.png',
      searchKeywords: ['jamaican', 'jerk', 'caribbean', 'scotch bonnet'],
    },

    // Extra Hot Salsas
    {
      name: 'X-Hot Extreme Salsa',
      slug: 'x-hot-extreme-salsa',
      description: 'Our hottest salsa yet! Fire-roasted peppers create intense heat and incredible smoky flavor.',
      heatLevel: HeatLevel.EXTRA_HOT,
      ingredients: ['Fire-Roasted Ghost Peppers', 'Carolina Reapers', 'Tomatoes', 'Onions', 'Garlic', 'Lime'],
      price: 12.99,
      sku: 'JMS-XHOT-001',
      inventory: 50,
      weight: 16.0,
      categoryId: hotCategory.id,
      isFeatured: true,
      images: ['/images/products/x-hot.png', '/images/products/original-x-hot-1.jpg'],
      featuredImage: '/images/products/x-hot.png',
      searchKeywords: ['extra hot', 'ghost pepper', 'carolina reaper', 'extreme', 'intense'],
      metaTitle: 'X-Hot Extreme Salsa - Our Hottest Yet',
      metaDescription: 'Fire-roasted ghost peppers and Carolina reapers deliver extreme heat for serious chile heads.',
    },
    {
      name: 'Ghost of Clovis',
      slug: 'ghost-of-clovis',
      description: 'An otherworldly hot salsa that will haunt your taste buds with incredible flavor and ghost pepper heat.',
      heatLevel: HeatLevel.EXTRA_HOT,
      ingredients: ['Ghost Peppers', 'Tomatoes', 'Onions', 'Garlic', 'Vinegar', 'Spices'],
      price: 13.99,
      sku: 'JMS-XHOT-002',
      inventory: 45,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/ghost-of-clovis.png'],
      featuredImage: '/images/products/ghost-of-clovis.png',
      searchKeywords: ['ghost pepper', 'extreme', 'extra hot', 'clovis'],
    },
    {
      name: 'Verde XX Hot Salsa',
      slug: 'verde-xx-hot-salsa',
      description: 'A double-extra-hot green salsa that combines tomatillos with the hottest peppers.',
      heatLevel: HeatLevel.EXTRA_HOT,
      ingredients: ['Tomatillos', 'Ghost Peppers', 'Habanero', 'Serrano', 'Cilantro', 'Lime'],
      price: 12.99,
      sku: 'JMS-XHOT-003',
      inventory: 40,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/verde-xx-hot-1.jpg'],
      featuredImage: '/images/products/verde-xx-hot-1.jpg',
      searchKeywords: ['verde', 'extra hot', 'ghost pepper', 'extreme'],
    },
    {
      name: 'Cherry Chocolate Hot',
      slug: 'cherry-chocolate-hot',
      description: 'Dark cherries and rich chocolate meet scorching heat in this gourmet extreme salsa.',
      heatLevel: HeatLevel.EXTRA_HOT,
      ingredients: ['Black Cherries', 'Dark Chocolate', 'Ghost Peppers', 'Tomatoes', 'Red Wine'],
      price: 14.99,
      sku: 'JMS-XHOT-004',
      inventory: 35,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/cherry-chocolate-hot.png'],
      featuredImage: '/images/products/cherry-chocolate-hot.png',
      searchKeywords: ['cherry', 'chocolate', 'gourmet', 'extreme hot'],
    },

    // Gourmet & Fruit Salsas
    {
      name: 'Mango Habanero Salsa',
      slug: 'mango-habanero-salsa',
      description: 'Sweet tropical mango meets spicy habanero in this gourmet fruit salsa. Perfect balance of sweet and heat.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Mango', 'Habanero Peppers', 'Red Onions', 'Cilantro', 'Lime Juice', 'Honey'],
      price: 11.99,
      sku: 'JMS-FRUIT-001',
      inventory: 75,
      weight: 16.0,
      categoryId: fruitCategory.id,
      isFeatured: true,
      images: ['/images/products/mango-habanero.png', '/images/products/mango-habanero-1.jpg'],
      featuredImage: '/images/products/mango-habanero.png',
      searchKeywords: ['mango', 'habanero', 'fruit', 'tropical', 'sweet heat'],
      metaTitle: 'Mango Habanero Salsa - Sweet & Spicy Gourmet Blend',
      metaDescription: 'Experience the perfect balance of sweet tropical mango and spicy habanero peppers.',
    },
    {
      name: 'Peach Jalapeño Salsa',
      slug: 'peach-jalapeno-salsa',
      description: 'Juicy peaches and mild jalapeños create a delightfully sweet and slightly spicy gourmet salsa.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Peaches', 'Jalapeño Peppers', 'Sweet Onions', 'Basil', 'Balsamic Vinegar'],
      price: 10.99,
      sku: 'JMS-FRUIT-002',
      inventory: 60,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/peach-jalapeno-1.jpg'],
      featuredImage: '/images/products/peach-jalapeno-1.jpg',
      searchKeywords: ['peach', 'jalapeño', 'sweet', 'gourmet', 'fruit'],
    },
    {
      name: 'Pineapple Habanero Salsa',
      slug: 'pineapple-habanero-salsa',
      description: 'Tropical pineapple brings sweetness to counter the habanero heat in this exotic salsa.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Pineapple', 'Habanero Peppers', 'Red Bell Peppers', 'Lime Juice', 'Cilantro'],
      price: 11.99,
      sku: 'JMS-FRUIT-003',
      inventory: 65,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/pineapple-habanero-1.jpg'],
      featuredImage: '/images/products/pineapple-habanero-1.jpg',
      searchKeywords: ['pineapple', 'habanero', 'tropical', 'sweet heat'],
    },
    {
      name: 'Pineapple Cilantro Salsa',
      slug: 'pineapple-cilantro-salsa',
      description: 'Tropical pineapple and fresh cilantro create a refreshing, zesty salsa perfect for summer.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Pineapple', 'Cilantro', 'Red Bell Peppers', 'Lime Juice', 'Mint', 'Sea Salt'],
      price: 10.49,
      sku: 'JMS-FRUIT-004',
      inventory: 65,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/pineapple-cilantro-1.jpg'],
      featuredImage: '/images/products/pineapple-cilantro-1.jpg',
      searchKeywords: ['pineapple', 'cilantro', 'tropical', 'refreshing', 'summer'],
    },
    {
      name: 'Green Apple Salsa',
      slug: 'green-apple-salsa',
      description: 'Crisp green apples bring a tart, refreshing twist to this unique fruit salsa.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Granny Smith Apples', 'Jalapeño', 'Cilantro', 'Lime', 'Honey'],
      price: 10.99,
      sku: 'JMS-FRUIT-005',
      inventory: 55,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/green-apple.jpg'],
      featuredImage: '/images/products/green-apple.jpg',
      searchKeywords: ['apple', 'tart', 'fruit', 'unique'],
    },
    {
      name: 'Raspberry BBQ Salsa',
      slug: 'raspberry-bbq-salsa',
      description: 'Raspberries meet smoky BBQ spices in this versatile salsa perfect for grilling.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Raspberries', 'Tomatoes', 'BBQ Spices', 'Brown Sugar', 'Vinegar'],
      price: 11.49,
      sku: 'JMS-FRUIT-006',
      inventory: 50,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/raspberry-bbq-1.jpg'],
      featuredImage: '/images/products/raspberry-bbq-1.jpg',
      searchKeywords: ['raspberry', 'bbq', 'grilling', 'smoky'],
    },

    // Specialty Items
    {
      name: 'Chipotle Queso',
      slug: 'chipotle-queso',
      description: 'Creamy cheese dip with smoky chipotle peppers - perfect for chips or topping your favorite dishes.',
      heatLevel: HeatLevel.MEDIUM,
      ingredients: ['Cheese', 'Chipotle Peppers', 'Cream', 'Garlic', 'Spices'],
      price: 12.99,
      sku: 'JMS-SPEC-001',
      inventory: 70,
      weight: 16.0,
      categoryId: mediumCategory.id,
      images: ['/images/products/chipotle-queso-1.jpg'],
      featuredImage: '/images/products/chipotle-queso-1.jpg',
      searchKeywords: ['queso', 'cheese', 'dip', 'chipotle'],
    },
    {
      name: 'Garlic & Olives Salsa',
      slug: 'garlic-olives-salsa',
      description: 'Mediterranean-inspired salsa with roasted garlic and briny olives.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Roasted Garlic', 'Kalamata Olives', 'Tomatoes', 'Olive Oil', 'Oregano'],
      price: 11.49,
      sku: 'JMS-SPEC-002',
      inventory: 60,
      weight: 16.0,
      categoryId: mildCategory.id,
      images: ['/images/products/garlic-olives-1.jpg'],
      featuredImage: '/images/products/garlic-olives-1.jpg',
      searchKeywords: ['garlic', 'olives', 'mediterranean', 'gourmet'],
    },
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

  console.log('✅ Created products')

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
      commissionRate: 40.00, // 40% commission
      status: 'ACTIVE',
      isActive: true,
    },
  })

  console.log('✅ Created sample fundraiser')

  // Create sample analytics data
  await prisma.analytics.createMany({
    data: [
      {
        type: 'PAGE_VIEW',
        page: '/',
        sessionId: 'session_001',
        country: 'US',
        region: 'OH',
        city: 'Columbus',
      },
      {
        type: 'PRODUCT_VIEW',
        page: '/salsas/jose-madrid-medium-salsa',
        category: 'product',
        label: 'jose-madrid-medium-salsa',
        sessionId: 'session_001',
        country: 'US',
        region: 'OH',
        city: 'Columbus',
      },
      {
        type: 'ADD_TO_CART',
        page: '/salsas/jose-madrid-medium-salsa',
        category: 'ecommerce',
        action: 'add_to_cart',
        label: 'jose-madrid-medium-salsa',
        value: 1,
        sessionId: 'session_001',
        country: 'US',
        region: 'OH',
        city: 'Columbus',
      },
    ],
  })

  console.log('✅ Created sample analytics')
  console.log('🌱 Database has been seeded successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })