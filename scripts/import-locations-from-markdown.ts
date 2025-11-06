import { PrismaClient } from '@prisma/client'
import { parseFindUsMarkdown, readFindUsMarkdownAbsolute } from '@/lib/find-us-parser'

const prisma = new PrismaClient()

async function main() {
  const mdPath = await readFindUsMarkdownAbsolute()
  const parsed = await parseFindUsMarkdown(mdPath)
  let upserted = 0

  for (const loc of parsed) {
    await prisma.retailLocation.upsert({
      where: { businessName_address: { businessName: loc.businessName, address: loc.address } },
      update: {
        city: loc.city,
        state: loc.state,
        zipCode: loc.zipCode || null,
        phone: loc.phone || null,
        website: loc.website || null,
        isActive: true,
      },
      create: {
        businessName: loc.businessName,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        zipCode: loc.zipCode || null,
        phone: loc.phone || null,
        website: loc.website || null,
        isActive: true,
        sortOrder: 0,
      },
    })
    upserted++
  }

  console.log(`Imported/updated ${upserted} locations from markdown`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})


