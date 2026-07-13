#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Import the recommendation function logic directly
async function getFrequentlyBoughtTogether(productId, limit = 4) {
  const isDev = process.env.NODE_ENV === 'development'
  try {
    const startTime = isDev ? Date.now() : 0
    if (isDev) {
      console.log('[Recommendations] getFrequentlyBoughtTogether: Starting query for productId:', productId)
    }

    const results = await prisma.$queryRaw`
      WITH orders_with_product AS (
        SELECT DISTINCT "orderId"
        FROM order_items
        WHERE "productId" = ${productId}
        ORDER BY "orderId" DESC
        LIMIT 100
      ),
      co_occurrences AS (
        SELECT
          oi."productId",
          COUNT(DISTINCT oi."orderId")::int AS co_occurrence_count,
          MAX(COUNT(DISTINCT oi."orderId")) OVER ()::int AS max_count
        FROM order_items oi
        INNER JOIN orders_with_product owp ON owp."orderId" = oi."orderId"
        WHERE oi."productId" != ${productId}
        GROUP BY oi."productId"
        ORDER BY co_occurrence_count DESC
        LIMIT ${limit * 2}
      )
      SELECT
        p.id,
        p.name,
        p.slug,
        p.price::float AS price,
        p."featuredImage",
        p."heatLevel",
        p.sku,
        p.inventory,
        co.co_occurrence_count,
        co.max_count
      FROM co_occurrences co
      INNER JOIN products p ON p.id = co."productId"
      WHERE p."isActive" = true AND p.inventory > 0
      ORDER BY co.co_occurrence_count DESC
      LIMIT ${limit}
    `

    if (isDev) {
      const duration = Date.now() - startTime
      console.log(`[Recommendations] getFrequentlyBoughtTogether: Query completed in ${duration}ms (${results.length} results)`)
    }

    // Calculate normalized scores
    return results.map(product => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      featuredImage: product.featuredImage,
      heatLevel: product.heatLevel,
      sku: product.sku,
      inventory: product.inventory,
      score: product.max_count > 0 ? product.co_occurrence_count / product.max_count : 0,
    }))
  } catch (error) {
    console.error('Error getting frequently bought together:', error)
    return []
  }
}

async function testProducts() {
  console.log('=== Testing Recommendation Function ===\n')

  try {
    // First, find products with different characteristics
    console.log('Finding test products...\n')

    // Get products with most orders
    const popularProducts = await prisma.$queryRaw`
      SELECT p.id, p.name, COUNT(DISTINCT oi."orderId")::int as order_count
      FROM products p
      INNER JOIN order_items oi ON oi."productId" = p.id
      WHERE p."isActive" = true
      GROUP BY p.id, p.name
      ORDER BY order_count DESC
      LIMIT 3
    `

    // Get a product with no orders
    const productNoOrders = await prisma.$queryRaw`
      SELECT p.id, p.name
      FROM products p
      LEFT JOIN order_items oi ON oi."productId" = p.id
      WHERE p."isActive" = true AND oi."productId" IS NULL
      LIMIT 1
    `

    // Get a random active product
    const randomProduct = await prisma.product.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    const testCases = [
      ...popularProducts.map(p => ({ id: p.id, name: p.name, description: `Popular product (${p.order_count} orders)` })),
      ...(productNoOrders.length > 0 ? [{ id: productNoOrders[0].id, name: productNoOrders[0].name, description: 'Product with no orders' }] : []),
      ...(randomProduct ? [{ id: randomProduct.id, name: randomProduct.name, description: 'Random product' }] : []),
    ]

    console.log(`Found ${testCases.length} test products:\n`)
    testCases.forEach((tc, i) => {
      console.log(`${i + 1}. ${tc.name} (${tc.id})`)
      console.log(`   ${tc.description}`)
    })

    console.log('\n' + '='.repeat(80) + '\n')

    // Test each product
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]
      console.log(`\nTest ${i + 1}/${testCases.length}: ${testCase.name}`)
      console.log(`Product ID: ${testCase.id}`)
      console.log(`Description: ${testCase.description}`)
      console.log('-'.repeat(80))

      const recommendations = await getFrequentlyBoughtTogether(testCase.id, 4)

      if (recommendations.length === 0) {
        console.log('❌ No recommendations found')
      } else {
        console.log(`✅ Found ${recommendations.length} recommendations:`)
        recommendations.forEach((rec, idx) => {
          console.log(`   ${idx + 1}. ${rec.name} (${rec.id})`)
          console.log(`      Price: $${rec.price.toFixed(2)}`)
          console.log(`      Score: ${rec.score.toFixed(3)} (${(rec.score * 100).toFixed(1)}%)`)
          console.log(`      Stock: ${rec.inventory}`)
          console.log(`      SKU: ${rec.sku}`)
          console.log(`      Heat Level: ${rec.heatLevel || 'N/A'}`)
        })

        // Verify data quality
        console.log('\n   Data Quality Checks:')
        const allHaveRequiredFields = recommendations.every(r =>
          r.id && r.name && r.slug && r.price >= 0 && r.sku && r.inventory > 0
        )
        console.log(`   - All products have required fields: ${allHaveRequiredFields ? '✅' : '❌'}`)

        const allScoresValid = recommendations.every(r => r.score >= 0 && r.score <= 1)
        console.log(`   - All scores in range [0,1]: ${allScoresValid ? '✅' : '❌'}`)

        const scoresDescending = recommendations.every((r, i) =>
          i === 0 || r.score <= recommendations[i - 1].score
        )
        console.log(`   - Scores in descending order: ${scoresDescending ? '✅' : '❌'}`)

        const allInStock = recommendations.every(r => r.inventory > 0)
        console.log(`   - All products in stock: ${allInStock ? '✅' : '❌'}`)

        const noDuplicates = new Set(recommendations.map(r => r.id)).size === recommendations.length
        console.log(`   - No duplicate products: ${noDuplicates ? '✅' : '❌'}`)
      }

      console.log('\n' + '='.repeat(80))
    }

    console.log('\n✅ Testing complete!')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Set NODE_ENV to development to see timing logs
process.env.NODE_ENV = 'development'
testProducts()
