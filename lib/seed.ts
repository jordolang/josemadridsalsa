import { PrismaClient, HeatLevel } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { recipeData } from './data/recipes'

const prisma = new PrismaClient()

export async function seedDatabase() {
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
  await prisma.recipe.deleteMany()
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
      description: 'For true heat lovers who enjoy an authentic spicy kick with their salsa.',
      metaTitle: 'Hot Salsa - Jose Madrid Salsa',
      metaDescription: 'Experience our hot salsa varieties for those who love authentic heat.',
      sortOrder: 3,
    },
  })

  const fruitCategory = await prisma.category.create({
    data: {
      name: 'Fruit Salsa',
      slug: 'fruit-salsa',
      description: 'Sweet and tangy fruit-based salsas perfect for a unique flavor experience.',
      metaTitle: 'Fruit Salsa - Jose Madrid Salsa',
      metaDescription: 'Discover our sweet and tangy fruit salsa varieties.',
      sortOrder: 4,
    },
  })

  console.log('✅ Created categories')

  // Create products
  const products = [
    {
      name: 'Mild Salsa - 16oz',
      slug: 'mild-salsa-16oz',
      description: 'Our classic mild salsa with fresh tomatoes, onions, and just a hint of jalapeño for flavor without the heat.',
      heatLevel: HeatLevel.MILD,
      ingredients: ['Tomatoes', 'Onions', 'Jalapeños', 'Cilantro', 'Lime Juice', 'Salt', 'Garlic'],
      price: 6.99,
      costPrice: 3.50,
      sku: 'JMS-MILD-16',
      barcode: '850012345001',
      inventory: 100,
      images: ['/images/products/mild-16oz.jpg'],
      featuredImage: '/images/products/mild-16oz.jpg',
      weight: 16,
      categoryId: mildCategory.id,
      isFeatured: true,
      searchKeywords: ['mild', 'salsa', 'tomato', 'fresh'],
    },
    {
      name: 'Medium Salsa - 16oz',
      slug: 'medium-salsa-16oz',
      description: 'The perfect balance of flavor and heat. Our most popular salsa with a medium kick.',
      heatLevel: HeatLevel.MEDIUM,
      ingredients: ['Tomatoes', 'Jalapeños', 'Serranos', 'Onions', 'Cilantro', 'Lime Juice', 'Salt', 'Garlic'],
      price: 6.99,
      costPrice: 3.50,
      sku: 'JMS-MED-16',
      barcode: '850012345002',
      inventory: 150,
      images: ['/images/products/medium-16oz.jpg'],
      featuredImage: '/images/products/medium-16oz.jpg',
      weight: 16,
      categoryId: mediumCategory.id,
      isFeatured: true,
      searchKeywords: ['medium', 'salsa', 'spicy', 'popular'],
    },
    {
      name: 'Hot Salsa - 16oz',
      slug: 'hot-salsa-16oz',
      description: 'For true heat lovers! Packed with habaneros and serranos for an authentic spicy experience.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Tomatoes', 'Habaneros', 'Serranos', 'Jalapeños', 'Onions', 'Cilantro', 'Lime Juice', 'Salt', 'Garlic'],
      price: 7.99,
      costPrice: 3.75,
      sku: 'JMS-HOT-16',
      barcode: '850012345003',
      inventory: 75,
      images: ['/images/products/hot-16oz.jpg'],
      featuredImage: '/images/products/hot-16oz.jpg',
      weight: 16,
      categoryId: hotCategory.id,
      isFeatured: true,
      searchKeywords: ['hot', 'salsa', 'spicy', 'habanero'],
    },
    {
      name: 'Mango Habanero Salsa - 12oz',
      slug: 'mango-habanero-12oz',
      description: 'Sweet mango meets fiery habanero in this tropical fusion salsa.',
      heatLevel: HeatLevel.HOT,
      ingredients: ['Mango', 'Habaneros', 'Red Bell Pepper', 'Onions', 'Lime Juice', 'Cilantro', 'Salt'],
      price: 8.99,
      costPrice: 4.25,
      sku: 'JMS-MANGO-12',
      barcode: '850012345004',
      inventory: 50,
      images: ['/images/products/mango-12oz.jpg'],
      featuredImage: '/images/products/mango-12oz.jpg',
      weight: 12,
      categoryId: fruitCategory.id,
      isFeatured: true,
      searchKeywords: ['mango', 'fruit', 'habanero', 'sweet', 'spicy'],
    },
  ]

  for (const product of products) {
    await prisma.product.create({ data: product })
  }

  console.log('✅ Created products')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.create({
    data: {
      email: 'admin@josemadrid.net',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
      isEmailVerified: true,
    },
  })

  console.log('✅ Created admin user')

  // Seed recipes
  for (const recipe of recipeData) {
    await prisma.recipe.create({
      data: recipe,
    })
  }

  console.log('✅ Seeded recipes')

  return {
    categories: 4,
    products: products.length,
    recipes: recipeData.length,
    users: 1,
  }
}
