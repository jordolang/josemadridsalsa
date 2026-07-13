import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface IntegrityResult {
  check: string
  status: 'PASS' | 'WARN' | 'FAIL'
  details: string
}

async function verifyDatabaseIntegrity() {
  const results: IntegrityResult[] = []

  try {
    console.log('🔍 Database Integrity Verification\n')
    console.log('='.repeat(60))

    // 1. Verify ProductVariant records have valid productId foreign keys
    console.log('\n📦 1. ProductVariant Foreign Key Integrity')
    const variants = await prisma.productVariant.findMany({
      include: { product: { select: { id: true, name: true } } },
    })
    const orphanedVariants = variants.filter((v) => !v.product)

    if (orphanedVariants.length > 0) {
      results.push({
        check: 'ProductVariant foreign keys',
        status: 'FAIL',
        details: `${orphanedVariants.length} orphaned variants found (missing product)`,
      })
      console.log(`   ❌ ${orphanedVariants.length} orphaned variants detected`)
    } else {
      results.push({
        check: 'ProductVariant foreign keys',
        status: 'PASS',
        details: `All ${variants.length} variants have valid productId references`,
      })
      console.log(`   ✅ All ${variants.length} variants have valid productId references`)
    }

    // Check required fields on variants
    const incompleteVariants = variants.filter((v) => !v.name || !v.type)
    if (incompleteVariants.length > 0) {
      results.push({
        check: 'ProductVariant required fields',
        status: 'FAIL',
        details: `${incompleteVariants.length} variants missing name or type`,
      })
      console.log(`   ❌ ${incompleteVariants.length} variants missing required fields (name/type)`)
    } else {
      results.push({
        check: 'ProductVariant required fields',
        status: 'PASS',
        details: `All variants have name and type populated`,
      })
      console.log(`   ✅ All variants have required fields (name, type) populated`)
    }

    // 2. Verify Product.images array integrity
    console.log('\n🖼️  2. Product Images Integrity')
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        images: true,
        featuredImage: true,
      },
    })

    const productsWithImages = products.filter((p) => p.images.length > 0)
    const productsWithEmptyStrings = products.filter((p) =>
      p.images.some((img) => !img || img.trim() === ''),
    )

    console.log(`   📊 ${productsWithImages.length}/${products.length} products have images`)

    if (productsWithEmptyStrings.length > 0) {
      results.push({
        check: 'Product images - no empty strings',
        status: 'WARN',
        details: `${productsWithEmptyStrings.length} products have empty image URLs`,
      })
      console.log(`   ⚠️  ${productsWithEmptyStrings.length} products have empty image URLs`)
    } else {
      results.push({
        check: 'Product images - no empty strings',
        status: 'PASS',
        details: 'No empty image URLs found',
      })
      console.log(`   ✅ No empty image URLs found`)
    }

    // Check for valid URL format in images
    const invalidUrlProducts = products.filter((p) =>
      p.images.some((img) => img && !img.startsWith('http') && !img.startsWith('/')),
    )
    if (invalidUrlProducts.length > 0) {
      results.push({
        check: 'Product images - valid URLs',
        status: 'WARN',
        details: `${invalidUrlProducts.length} products have potentially invalid image URLs`,
      })
      console.log(`   ⚠️  ${invalidUrlProducts.length} products have potentially invalid image URLs`)
    } else {
      results.push({
        check: 'Product images - valid URLs',
        status: 'PASS',
        details: 'All image URLs appear valid',
      })
      console.log(`   ✅ All image URLs appear valid`)
    }

    // 3. Check for orphaned OrderItems (referencing non-existent products)
    console.log('\n🛒 3. Order & OrderItem Integrity')
    const orderItems = await prisma.orderItem.findMany({
      include: {
        product: { select: { id: true } },
        order: { select: { id: true } },
      },
    })
    const orphanedOrderItems = orderItems.filter((item) => !item.product || !item.order)
    if (orphanedOrderItems.length > 0) {
      results.push({
        check: 'OrderItem references',
        status: 'FAIL',
        details: `${orphanedOrderItems.length} orphaned order items found`,
      })
      console.log(`   ❌ ${orphanedOrderItems.length} orphaned order items detected`)
    } else {
      results.push({
        check: 'OrderItem references',
        status: 'PASS',
        details: `All ${orderItems.length} order items have valid references`,
      })
      console.log(`   ✅ All ${orderItems.length} order items have valid product & order references`)
    }

    // 4. Verify Product required fields
    console.log('\n📋 4. Product Required Fields')
    const incompleteProducts = await prisma.product.findMany({
      where: {
        OR: [
          { name: '' },
          { slug: '' },
          { sku: '' },
          { categoryId: '' },
        ],
      },
      select: { id: true, name: true, slug: true, sku: true },
    })

    if (incompleteProducts.length > 0) {
      results.push({
        check: 'Product required fields',
        status: 'FAIL',
        details: `${incompleteProducts.length} products missing required fields`,
      })
      console.log(`   ❌ ${incompleteProducts.length} products missing required fields`)
    } else {
      results.push({
        check: 'Product required fields',
        status: 'PASS',
        details: 'All products have required fields populated',
      })
      console.log(`   ✅ All products have required fields populated`)
    }

    // 5. Check Order payment/status consistency
    console.log('\n💰 5. Order Status Consistency')
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
      },
    })

    const refundedButNotPaid = orders.filter(
      (o) =>
        (o.status === 'REFUNDED' && o.paymentStatus === 'PENDING') ||
        (o.paymentStatus === 'REFUNDED' && o.status === 'PENDING'),
    )

    if (refundedButNotPaid.length > 0) {
      results.push({
        check: 'Order status consistency',
        status: 'WARN',
        details: `${refundedButNotPaid.length} orders have inconsistent status/paymentStatus`,
      })
      console.log(`   ⚠️  ${refundedButNotPaid.length} orders have inconsistent statuses`)
    } else {
      results.push({
        check: 'Order status consistency',
        status: 'PASS',
        details: `All ${orders.length} orders have consistent status fields`,
      })
      console.log(`   ✅ All ${orders.length} orders have consistent status fields`)
    }

    // 6. Check for duplicate SKUs across products and variants
    console.log('\n🏷️  6. SKU Uniqueness')
    const allProductSkus = await prisma.product.findMany({ select: { sku: true } })
    const allVariantSkus = await prisma.productVariant.findMany({
      where: { sku: { not: null } },
      select: { sku: true },
    })

    const skuSet = new Set<string>()
    const duplicateSkus: string[] = []
    for (const p of allProductSkus) {
      if (skuSet.has(p.sku)) duplicateSkus.push(p.sku)
      skuSet.add(p.sku)
    }
    for (const v of allVariantSkus) {
      if (v.sku && skuSet.has(v.sku)) duplicateSkus.push(v.sku)
      if (v.sku) skuSet.add(v.sku)
    }

    if (duplicateSkus.length > 0) {
      results.push({
        check: 'SKU uniqueness',
        status: 'WARN',
        details: `Duplicate SKUs found: ${duplicateSkus.join(', ')}`,
      })
      console.log(`   ⚠️  Duplicate SKUs: ${duplicateSkus.join(', ')}`)
    } else {
      results.push({
        check: 'SKU uniqueness',
        status: 'PASS',
        details: 'All SKUs are unique across products and variants',
      })
      console.log(`   ✅ All SKUs are unique`)
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('\n📊 INTEGRITY VERIFICATION SUMMARY\n')

    const passed = results.filter((r) => r.status === 'PASS').length
    const warned = results.filter((r) => r.status === 'WARN').length
    const failed = results.filter((r) => r.status === 'FAIL').length

    for (const r of results) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️ ' : '❌'
      console.log(`   ${icon} ${r.check}: ${r.details}`)
    }

    console.log(`\n   Results: ${passed} passed, ${warned} warnings, ${failed} failures`)

    if (failed > 0) {
      console.log('\n   ❌ DATABASE INTEGRITY CHECK FAILED')
      process.exit(1)
    } else if (warned > 0) {
      console.log('\n   ⚠️  DATABASE INTEGRITY CHECK PASSED WITH WARNINGS')
    } else {
      console.log('\n   ✅ DATABASE INTEGRITY CHECK PASSED')
    }
  } catch (error) {
    console.error('\n❌ Verification error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyDatabaseIntegrity()
