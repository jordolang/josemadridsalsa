import { PrismaClient } from '@prisma/client'
import { recipeData } from '../lib/data/recipes'

const prisma = new PrismaClient()

async function main() {
  for (const recipe of recipeData) {
    const { id: _legacyId, ...data } = recipe

    await prisma.recipe.upsert({
      where: { slug: data.slug },
      update: data,
      create: data,
    })
  }

  console.log(`✅ Synced ${recipeData.length} recipes`)
}

main()
  .catch((error) => {
    console.error('Failed to sync recipes', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
