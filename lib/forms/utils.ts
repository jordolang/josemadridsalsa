import { prisma } from '@/lib/prisma'

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export async function ensureUniqueSlug(baseSlug: string, existingId?: string | null) {
  let slug = baseSlug || 'form-template'
  let attempt = 1

  while (true) {
    const match = await prisma.formTemplate.findFirst({
      where: existingId
        ? { slug, NOT: { id: existingId } }
        : { slug },
      select: { id: true },
    })

    if (!match) {
      return slug
    }

    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }
}
