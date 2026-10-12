import { prisma } from '@/lib/prisma'
import { isKitId, kitProductSlugs } from '@/lib/fundraising/flavor-kits'

/**
 * The store catalogue a chosen package stands for: one `FundraiserProduct` row per salsa in
 * the kit, in kit order. Approving a fundraiser writes these so nobody has to tick salsas one
 * by one. Inactive products are left out — they could not be sold anyway.
 *
 * A slug that finds no product is reported rather than guessed at; see `shouldBlockApproval`.
 */
export async function resolveKitCatalog(flavorPackage: string | null) {
  const slugs = isKitId(flavorPackage) ? kitProductSlugs(flavorPackage) : []
  const products = slugs.length
    ? await prisma.product.findMany({
        where: { slug: { in: slugs }, isActive: true },
        select: { id: true, slug: true },
      })
    : []
  const idBySlug = new Map(products.map((p) => [p.slug, p.id]))

  return {
    kitSize: slugs.length,
    catalog: slugs.flatMap((slug, sortOrder) => {
      const productId = idBySlug.get(slug)
      return productId ? [{ productId, sortOrder }] : []
    }),
    missingSlugs: slugs.filter((slug) => !idBySlug.has(slug)),
  }
}

/**
 * Whether a kit with salsas missing from the catalogue should stop the approval.
 *
 * Any gap blocks: the store has to match the order forms the group prints, and the error names
 * the missing slugs so a renamed or deactivated product is a quick fix. No package (kitSize 0)
 * never blocks — older sign-ups approve as they always did.
 *
 * @param missingSlugs - kit flavors with no active product
 * @param kitSize - how many flavors the kit has (0 when no package was chosen)
 */
export function shouldBlockApproval(missingSlugs: string[], kitSize: number): boolean {
  return kitSize > 0 && missingSlugs.length > 0
}
