export interface SeoConfigForm {
  siteName: string
  siteDescription: string
  siteUrl: string
  defaultOgImage?: string
  twitterHandle?: string
  facebookAppId?: string
  defaultKeywords?: string[]
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
  hasGscCredentials?: boolean
}

export type UpdateConfig = <K extends keyof SeoConfigForm>(
  field: K,
  value: SeoConfigForm[K]
) => void
