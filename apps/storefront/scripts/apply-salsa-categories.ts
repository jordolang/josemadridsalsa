/**
 * Creates/updates the five salsa categories (lib/salsa-categories.ts) and moves each salsa into its
 * category. Dry run by default: prints what would change and writes nothing. Pass --apply to write.
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
      }
      for (const { product, target } of moves) {
        await tx.product.update({
          where: { id: product.id },
          data: { categoryId: idBySlug.get(target) },
        })
      }
    })
    console.log(`\n✅ Upserted ${SALSA_CATEGORIES.length} categories and assigned ${moves.length} products`)
  } catch (error: unknown) {
    console.error('❌ Error:', getErrorMessage(error))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

applySalsaCategories()
