/**
 * Creates/updates the five salsa categories (lib/salsa-categories.ts), moves each salsa into its
 * category, and mirrors each category as a collection of the same name and slug (shown at
 * /admin/collections) holding the same salsas. Dry run by default: prints what would change and
 * writes nothing. Pass --apply to write.
 *
 *   npm run products:salsa-categories --workspace @jose-madrid/storefront            # dry run
 *   npm run products:salsa-categories --workspace @jose-madrid/storefront -- --apply # write
 *
 * Products whose name isn't a known flavor (variety packs, merchandise, gift boxes) are listed and
 * left in their current category.
 */
import { PrismaClient } from '@prisma/client'
import { getErrorMessage } from '@/lib/errors'
import { SALSA_CATEGORIES, getSalsaCategorySlug } from '@/lib/salsa-categories'
import { collectionProductRows } from '@/lib/collections'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function applySalsaCategories() {
  try {
    const products = await prisma.product.findMany({
      select: { id: true, name: true, slug: true, isActive: true, category: { select: { slug: true } } },
      orderBy: { name: 'asc' },
    })

    const moves = products.flatMap((product) => {
      const target = getSalsaCategorySlug(product.name)
      return target ? [{ product, target }] : []
    })
    const unmatched = products.filter((product) => !getSalsaCategorySlug(product.name))

    console.log(apply ? 'APPLYING salsa categories\n' : 'DRY RUN (pass --apply to write)\n')
    for (const category of SALSA_CATEGORIES) {
      const members = moves.filter((move) => move.target === category.slug)
      console.log(`${category.name} (${category.slug}): ${members.length}`)
      for (const { product } of members) {
        const from = product.category.slug === category.slug ? 'unchanged' : `from ${product.category.slug}`
        console.log(`  - ${product.name}${product.isActive ? '' : ' [inactive]'} (${from})`)
      }
    }
    console.log(`\nNot a known flavor, left as is: ${unmatched.length}`)
    for (const product of unmatched) {
      console.log(`  - ${product.name} (${product.slug}, in ${product.category.slug})`)
    }

    if (!apply) return

    await prisma.$transaction(async (tx) => {
      const idBySlug = new Map<string, string>()
      for (const { slug, ...fields } of SALSA_CATEGORIES) {
        const category = await tx.category.upsert({
          where: { slug },
          create: { slug, ...fields, isActive: true },
          update: { ...fields, isActive: true },
        })
        idBySlug.set(slug, category.id)

        // Same salsas as a collection; its membership is replaced so reruns stay in sync.
        const collection = await tx.collection.upsert({
          where: { slug },
          create: { slug, ...fields, isActive: true },
          update: { ...fields, isActive: true },
        })
        await tx.collectionProduct.deleteMany({ where: { collectionId: collection.id } })
        await tx.collectionProduct.createMany({
          data: collectionProductRows(
            moves.filter((move) => move.target === slug).map((move) => move.product.id)
          ).map((row) => ({ ...row, collectionId: collection.id })),
        })
      }
      for (const { product, target } of moves) {
        await tx.product.update({
          where: { id: product.id },
          data: { categoryId: idBySlug.get(target) },
        })
      }
    }, { timeout: 60_000 })
    console.log(`\n✅ Upserted ${SALSA_CATEGORIES.length} categories and collections and assigned ${moves.length} products`)
  } catch (error: unknown) {
    console.error('❌ Error:', getErrorMessage(error))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

applySalsaCategories()
