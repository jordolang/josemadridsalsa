import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

const client = prisma.$extends(withAccelerate())

async function testConnection() {
  try {
    console.log('Testing database connection...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')

    // Test simple query
    const count = await client.product.count()
    console.log('✓ Database connection successful!')
    console.log(`Found ${count} products in database`)

    // Get a sample product
    const product = await client.product.findFirst()
    if (product) {
      console.log('Sample product:', product.name)
    }

    process.exit(0)
  } catch (error) {
    console.error('✗ Database connection failed!')
    console.error('Error:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  }
}

testConnection()
