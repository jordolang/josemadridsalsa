import type { BusinessFormSection } from '@/types/forms'
import { prisma } from '@/lib/prisma'

export const structureFromSections = (sections: BusinessFormSection[]) =>
  JSON.parse(
    JSON.stringify({
      sections,
    }),
  ) as { sections: BusinessFormSection[] }

export const templateHistoryInclude = {
  versions: {
    orderBy: { version: 'desc' as const },
    take: 10,
  },
}

export const fetchTemplateWithHistory = (slug: string) =>
  prisma.formTemplate.findUnique({
    where: { slug },
    include: templateHistoryInclude,
  })
