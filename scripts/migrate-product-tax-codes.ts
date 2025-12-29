/**
 * Product Tax Code Migration Script
 * José Madrid Salsa E-commerce Platform
 *
 * This script adds Stripe Tax codes to all products for accurate tax calculation
 *
 * Usage:
 *   tsx scripts/migrate-product-tax-codes.ts
 *   tsx scripts/migrate-product-tax-codes.ts --dry-run
 */

import prisma from '../lib/prisma'

/**
 * Stripe Tax Codes for different product types
 * Reference: https://stripe.com/docs/tax/tax-codes
 */
const TAX_CODES = {
  // Food & Beverage - Packaged food (salsa products)
  FOOD_PACKAGED: 'txcd_30011000',

  // Food & Beverage - Prepared meals (if selling prepared foods)
  FOOD_PREPARED: 'txcd_30012000',

  // General Merchandise (for non-food products like t-shirts, etc.)
  GENERAL_MERCHANDISE: 'txcd_99999999',
}

/**
 * Determine the appropriate tax code for a product
 */
function getTaxCodeForProduct(product: any): string {
  // For now, assume all products are packaged salsa (food products)
  // You can add logic here to determine the tax code based on product category

  // Example logic (customize as needed):
  if (product.name?.toLowerCase().includes('shirt')) {
    return TAX_CODES.GENERAL_MERCHANDISE
  }

  // Default: packaged food (salsa)
  return TAX_CODES.FOOD_PACKAGED
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  console.log('🏷️  Product Tax Code Migration')
  console.log('================================\n')

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n')
  }

  try {
    // Check if taxCode field exists in schema
    // If not, you'll need to add it to the Prisma schema first

    // Fetch all products
    console.log('📦 Fetching all products...')
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
      },
    })

    console.log(`✅ Found ${products.length} products\n`)

    if (products.length === 0) {
      console.log('No products to update.')
      return
    }

    // Group products by tax code
    const taxCodeGroups: Record<string, any[]> = {}

    for (const product of products) {
      const taxCode = getTaxCodeForProduct(product)

      if (!taxCodeGroups[taxCode]) {
        taxCodeGroups[taxCode] = []
      }

      taxCodeGroups[taxCode].push(product)
    }

    // Display summary
    console.log('📊 Tax Code Distribution:')
    console.log('─'.repeat(50))
    for (const [taxCode, prods] of Object.entries(taxCodeGroups)) {
      const taxCodeName = Object.entries(TAX_CODES).find(
        ([_, code]) => code === taxCode
      )?.[0]
      console.log(`  ${taxCodeName || taxCode}: ${prods.length} products`)
    }
    console.log('')

    if (isDryRun) {
      console.log('🔍 Sample products by tax code:\n')
      for (const [taxCode, prods] of Object.entries(taxCodeGroups)) {
        const taxCodeName = Object.entries(TAX_CODES).find(
          ([_, code]) => code === taxCode
        )?.[0]
        console.log(`${taxCodeName}:`)
        prods.slice(0, 3).forEach((p) => {
          console.log(`  - ${p.name} (${p.sku})`)
        })
        if (prods.length > 3) {
          console.log(`  ... and ${prods.length - 3} more`)
        }
        console.log('')
      }

      console.log('✅ Dry run complete. Run without --dry-run to apply changes.')
      return
    }

    // Apply updates
    console.log('💾 Updating products with tax codes...\n')

    let updated = 0
    let failed = 0

    for (const product of products) {
      const taxCode = getTaxCodeForProduct(product)

      try {
        // Note: This will fail if taxCode field doesn't exist in Prisma schema
        // You need to add it to the schema first
        await (prisma as any).product.update({
          where: { id: product.id },
          data: { taxCode },
        })

        updated++
        if (updated % 10 === 0) {
          process.stdout.write(`  Updated ${updated}/${products.length} products...\r`)
        }
      } catch (error) {
        failed++
        console.error(`\n❌ Failed to update product ${product.sku}:`, error)
      }
    }

    console.log(`\n\n✅ Migration complete!`)
    console.log(`─`.repeat(50))
    console.log(`  Updated: ${updated} products`)
    if (failed > 0) {
      console.log(`  Failed: ${failed} products`)
    }
    console.log('')

    console.log('📝 Next Steps:')
    console.log('  1. Verify tax codes in Stripe Dashboard')
    console.log('  2. Test checkout with tax calculation')
    console.log('  3. Update product creation forms to include tax code field')
    console.log('')
  } catch (error) {
    console.error('\n❌ Migration failed:', error)

    if ((error as any).message?.includes('Unknown field')) {
      console.log('\n⚠️  The taxCode field does not exist in the Prisma schema.')
      console.log('   You need to add it first:\n')
      console.log('   1. Add to prisma/schema.prisma:')
      console.log('      model Product {')
      console.log('        ...')
      console.log('        taxCode String? // Stripe Tax Code')
      console.log('        ...')
      console.log('      }\n')
      console.log('   2. Run: npx prisma migrate dev --name add_tax_code')
      console.log('   3. Run this script again')
      console.log('')
    }

    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
