import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'

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
  googleSiteVerification?: string
  gscProperty?: string
  /** True when a Search Console service account is stored. The JSON itself is never returned. */
  hasGscCredentials?: boolean
}

/** Fields accepted on update. gscServiceAccountJson is write-only and encrypted at rest. */
export type SeoConfigUpdate = Partial<Omit<SeoConfig, 'hasGscCredentials'>> & {
  gscServiceAccountJson?: string | null
}

export interface GscServiceAccount {
  client_email: string
  private_key: string
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
    googleSiteVerification: config.googleSiteVerification || undefined,
    gscProperty: config.gscProperty || undefined,
    hasGscCredentials: Boolean(config.gscServiceAccountJson),
  }
}

/**
 * Request-deduped SEO configuration lookup for use in generateMetadata and
 * server components. Returns null (instead of throwing) when the DB is unreachable.
 */
export const getCachedSeoConfiguration = cache(async (): Promise<SeoConfig | null> => {
  try {
    return await getSeoConfiguration()
  } catch (error) {
    console.error('Failed to fetch SEO configuration:', error)
    return null
  }
})

export async function updateSeoConfiguration(data: SeoConfigUpdate): Promise<void> {
  const { gscServiceAccountJson, ...rest } = data

  const payload: Record<string, unknown> = { ...rest }
  if (gscServiceAccountJson !== undefined) {
    // Empty string / null clears the stored credentials
    payload.gscServiceAccountJson = gscServiceAccountJson
      ? encrypt(gscServiceAccountJson)
      : null
  }

  const existing = await prisma.seoConfiguration.findFirst()

  if (existing) {
    await prisma.seoConfiguration.update({
      where: { id: existing.id },
      data: payload as any,
    })
  } else {
    await prisma.seoConfiguration.create({
      data: {
        siteName: data.siteName || 'Jose Madrid Salsa',
        siteDescription: data.siteDescription || '',
        siteUrl: data.siteUrl || '',
        ...payload,
      } as any,
    })
  }
}

/**
 * Decrypt and parse the stored Search Console service account.
 * Returns null when not configured or invalid.
 */
export async function getGscServiceAccount(): Promise<GscServiceAccount | null> {
  const config = await prisma.seoConfiguration.findFirst({
    select: { gscServiceAccountJson: true },
  })
  if (!config?.gscServiceAccountJson) return null

  try {
    const parsed = JSON.parse(decrypt(config.gscServiceAccountJson))
    if (typeof parsed.client_email === 'string' && typeof parsed.private_key === 'string') {
      return parsed as GscServiceAccount
    }
    return null
  } catch (error) {
    console.error('Failed to decrypt/parse GSC service account:', error)
    return null
  }
}

export { applyMetadataTemplate } from './templates'
