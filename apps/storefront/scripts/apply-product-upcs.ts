/**
 * Saves each salsa's UPC (lib/product-upcs.ts) to its product's `barcode`, so Google Customer
 * Reviews and the shopping feeds can send a GTIN. Dry run by default: prints what would change and
 * writes nothing. Pass --apply to write.
 *
 *   npm run products:upcs --workspace @jose-madrid/storefront            # dry run
 *   npm run products:upcs --workspace @jose-madrid/storefront -- --apply # write
 *
 * A product that already has a different barcode is reported and left alone. Products whose name
 * isn't a known single-jar flavor (variety packs, gift boxes, merchandise) are listed and skipped.
 */
import { PrismaClient } from '@prisma/client'
import { getErrorMessage } from '@/lib/errors'
import { KIOSK_FLAVORS } from '@/lib/kiosk/catalog'
import { getProductUpc } from '@/lib/product-upcs'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function applyProductUpcs() {
  try {
    const products = await prisma.product.findMany({
      select: { id: true, name: true, sku: true, barcode: true, isActive: true },
      orderBy: { name: 'asc' },
    })

    const label = (p: (typeof products)[number]) => `${p.name} (${p.sku})${p.isActive ? '' : ' [inactive]'}`
    const matched = products.flatMap((product) => {
      const upc = getProductUpc(product.name)
      return upc ? [{ product, upc }] : []
    })
    const updates = matched.filter(({ product }) => !product.barcode)
    const unchanged = matched.filter(({ product, upc }) => product.barcode === upc)
    const conflicts = matched.filter(({ product, upc }) => product.barcode && product.barcode !== upc)
    const skipped = products.filter((product) => !getProductUpc(product.name))
    const found = new Set(matched.map(({ upc }) => upc))
    const missing = KIOSK_FLAVORS.filter((flavor) => flavor.upc && !found.has(flavor.upc))

    console.log(apply ? 'APPLYING product UPCs\n' : 'DRY RUN (pass --apply to write)\n')
    console.log(`Barcode to set: ${updates.length}`)
    for (const { product, upc } of updates) console.log(`  - ${label(product)} → ${upc}`)
    console.log(`\nAlready correct: ${unchanged.length}`)
    for (const { product, upc } of unchanged) console.log(`  - ${label(product)} = ${upc}`)
    console.log(`\nHas a different barcode, left alone: ${conflicts.length}`)
    for (const { product, upc } of conflicts) console.log(`  - ${label(product)} has ${product.barcode}, label says ${upc}`)
    console.log(`\nNo product found for: ${missing.length}`)
    for (const flavor of missing) console.log(`  - ${flavor.name} (${flavor.upc})`)
    console.log(`\nNot a single-jar flavor, skipped: ${skipped.length}`)
    for (const product of skipped) console.log(`  - ${label(product)}`)

    if (!apply) return

    await prisma.$transaction(
      updates.map(({ product, upc }) =>
        prisma.product.update({ where: { id: product.id }, data: { barcode: upc } })
      )
    )
    console.log(`\n✅ Set the barcode on ${updates.length} products`)
  } catch (error) {
    console.error('❌ Failed to apply product UPCs:', getErrorMessage(error))
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

applyProductUpcs()
