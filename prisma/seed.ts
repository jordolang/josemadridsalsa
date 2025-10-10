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

  // Create products
  const products = [
    // Mild Salsas
    {
      name: 'Jose Madrid Mild Salsa',
      slug: 'jose-madrid-mild-salsa',
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
      images: ['/images/products/mild-salsa-1.jpg', '/images/products/mild-salsa-2.jpg'],
      featuredImage: '/images/products/mild-salsa-1.jpg',
      searchKeywords: ['mild', 'family friendly', 'tomato', 'signature'],
      metaTitle: 'Jose Madrid Mild Salsa - Perfect for the Whole Family',
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

    // Medium Salsas
    {
      name: 'Jose Madrid Medium Salsa',
      slug: 'jose-madrid-medium-salsa',
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
      images: ['/images/products/medium-salsa-1.jpg', '/images/products/medium-salsa-2.jpg'],
      featuredImage: '/images/products/medium-salsa-1.jpg',
      searchKeywords: ['medium', 'popular', 'balanced', 'jalapeño'],
      metaTitle: 'Jose Madrid Medium Salsa - Perfect Balance of Flavor & Heat',
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

    // Hot Salsas
    {
      name: 'Jose Madrid Hot Salsa',
      slug: 'jose-madrid-hot-salsa',
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
      images: ['/images/products/hot-salsa-1.jpg', '/images/products/hot-salsa-2.jpg'],
      featuredImage: '/images/products/hot-salsa-1.jpg',
      searchKeywords: ['hot', 'heat lovers', 'serrano', 'habanero', 'bold'],
      metaTitle: 'Jose Madrid Hot Salsa - For Serious Heat Lovers',
      metaDescription: 'Our hot salsa packs serious heat and bold flavor with serrano and habanero peppers.',
    },
    {
      name: 'Fire Roasted Extra Hot',
      slug: 'fire-roasted-extra-hot',
      description: 'Our hottest salsa yet! Fire-roasted peppers create intense heat and incredible smoky flavor.',
      heatLevel: HeatLevel.EXTRA_HOT,
      ingredients: ['Fire-Roasted Ghost Peppers', 'Carolina Reapers', 'Tomatoes', 'Onions', 'Garlic', 'Lime'],
      price: 12.99,
      sku: 'JMS-HOT-002',
      inventory: 50,
      weight: 16.0,
      categoryId: hotCategory.id,
      images: ['/images/products/extra-hot-1.jpg'],
      featuredImage: '/images/products/extra-hot-1.jpg',
      searchKeywords: ['extra hot', 'ghost pepper', 'carolina reaper', 'fire roasted', 'intense'],
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
      images: ['/images/products/mango-habanero-1.jpg'],
      featuredImage: '/images/products/mango-habanero-1.jpg',
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
      name: 'Pineapple Cilantro Salsa',
      slug: 'pineapple-cilantro-salsa',
      description: 'Tropical pineapple and fresh cilantro create a refreshing, zesty salsa perfect for summer.',
      heatLevel: HeatLevel.FRUIT,
      ingredients: ['Fresh Pineapple', 'Cilantro', 'Red Bell Peppers', 'Lime Juice', 'Mint', 'Sea Salt'],
      price: 10.49,
      sku: 'JMS-FRUIT-003',
      inventory: 65,
      weight: 16.0,
      categoryId: fruitCategory.id,
      images: ['/images/products/pineapple-cilantro-1.jpg'],
      featuredImage: '/images/products/pineapple-cilantro-1.jpg',
      searchKeywords: ['pineapple', 'cilantro', 'tropical', 'refreshing', 'summer'],
    },
  ]

  for (const productData of products) {
    await prisma.product.create({
      data: productData,
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