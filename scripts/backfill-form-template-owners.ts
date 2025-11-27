import { PrismaClient } from '@prisma/client'
import { resolveTemplateOwner } from '@/lib/forms/ownership'

const prisma = new PrismaClient()

async function main() {
  const systemUser = await resolveTemplateOwner()
  console.log(`Using ${systemUser.email ?? systemUser.id} as the fallback owner.`)

  const templatesNeedingUpdates = await prisma.formTemplate.findMany({
    where: {
      OR: [{ createdById: null }, { updatedById: null }],
    },
    select: {
      id: true,
      createdById: true,
      updatedById: true,
    },
  })

  let templateUpdates = 0

  for (const template of templatesNeedingUpdates) {
    await prisma.formTemplate.update({
      where: { id: template.id },
      data: {
        createdById: template.createdById ?? systemUser.id,
        updatedById: template.updatedById ?? template.createdById ?? systemUser.id,
      },
    })
    templateUpdates += 1
  }

  const versionsNeedingUpdates = await prisma.formTemplateVersion.findMany({
    where: { createdById: null },
    select: { id: true },
  })

  let versionUpdates = 0

  for (const version of versionsNeedingUpdates) {
    await prisma.formTemplateVersion.update({
      where: { id: version.id },
      data: { createdById: systemUser.id },
    })
    versionUpdates += 1
  }

  console.log(`Updated ${templateUpdates} templates and ${versionUpdates} template versions.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
