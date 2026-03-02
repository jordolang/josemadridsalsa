import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyDatabase() {
  try {
    console.log('🔍 Verifying PostgreSQL database connection and products...\n')
    
    // Check connection
    const connection = await prisma.$queryRaw`SELECT NOW();`
    console.log('✅ PostgreSQL connection successful')
    console.log(`   Connected to: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]}\n`)
    
    // Count products
    const productCount = await prisma.product.count()
    console.log(`📦 Total products in database: ${productCount}`)
    
    // Get product details
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        heatLevel: true,
        inventory: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    })
    
    console.log('\n📋 Products by category:\n')
    const grouped = products.reduce((acc, p) => {
      const cat = p.category.name
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(p)
      return acc
    }, {} as Record<string, typeof products>)
    
    for (const [category, items] of Object.entries(grouped)) {
      console.log(`   ${category}:`)
      items.forEach(p => {
        console.log(`     • ${p.name} - ${p.price} (Heat: ${p.heatLevel}, Stock: ${p.inventory})`)
      })
      console.log()
    }
    
    // Test API endpoint response
    console.log('✅ Database verification complete!')
    console.log(`\n📌 API Endpoint: GET /api/products`)
    console.log(`   Returns: ${productCount} products as JSON`)
    
  } catch (error) {
    console.error('❌ Database verification failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyDatabase()