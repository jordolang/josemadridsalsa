import { prisma } from '@/lib/prisma'

export interface SeoConfig {
  siteName: string
  siteDescription: string
  siteUrl: string
  defaultOgImage?: string
  twitterHandle?: string
  facebookAppId?: string
  defaultKeywords: string[]
  productTitleTemplate?: string
  productDescTemplate?: string
  categoryTitleTemplate?: string
  categoryDescTemplate?: string
  recipeTitleTemplate?: string
  recipeDescTemplate?: string
  locationTitleTemplate?: string
  locationDescTemplate?: string
  robotsTxt?: string
  sitemapPriorities?: Record<string, number>
}

export async function getSeoConfiguration(): Promise<SeoConfig | null> {
  const config = await prisma.seoConfiguration.findFirst()
  if (!config) return null

  return {
    siteName: config.siteName,
    siteDescription: config.siteDescription,
    siteUrl: config.siteUrl,
    defaultOgImage: config.defaultOgImage || undefined,
    twitterHandle: config.twitterHandle || undefined,
    facebookAppId: config.facebookAppId || undefined,
    defaultKeywords: config.defaultKeywords || [],
    productTitleTemplate: config.productTitleTemplate || undefined,
    productDescTemplate: config.productDescTemplate || undefined,
    categoryTitleTemplate: config.categoryTitleTemplate || undefined,
    categoryDescTemplate: config.categoryDescTemplate || undefined,
    recipeTitleTemplate: config.recipeTitleTemplate || undefined,
    recipeDescTemplate: config.recipeDescTemplate || undefined,
    locationTitleTemplate: config.locationTitleTemplate || undefined,
    locationDescTemplate: config.locationDescTemplate || undefined,
    robotsTxt: config.robotsTxt || undefined,
    sitemapPriorities: config.sitemapPriorities as Record<string, number> || {},
  }
}

export async function updateSeoConfiguration(data: Partial<SeoConfig>): Promise<void> {
  const existing = await prisma.seoConfiguration.findFirst()

  if (existing) {
    await prisma.seoConfiguration.update({
      where: { id: existing.id },
      data: data as any,
    })
  } else {
    await prisma.seoConfiguration.create({
      data: {
        siteName: data.siteName || 'Jose Madrid Salsa',
        siteDescription: data.siteDescription || '',
        siteUrl: data.siteUrl || '',
        ...data,
      } as any,
    })
  }
}

export function applyMetadataTemplate(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return result
}
