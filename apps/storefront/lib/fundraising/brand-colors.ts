export type BrandColors = { primaryColor: string; secondaryColor: string; accentColor: string }

type BrandColorSource = {
  brandColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  pageConfig: unknown
}

const DEFAULT_BRAND_COLORS: BrandColors = {
  primaryColor: '#B91C1C',
  secondaryColor: '#F59E0B',
  accentColor: '#16A34A',
}

/**
 * The palette the admin Branding tab starts from. A palette saved there (in pageConfig) is the
 * latest choice, so it wins; otherwise the columns hold what the group chose at sign-up. Saving
 * writes both, keeping them in step.
 */
export function initialBrandColors(fundraiser: BrandColorSource): BrandColors {
  const saved = (fundraiser.pageConfig ?? {}) as Partial<Record<keyof BrandColors, string>>
  return {
    primaryColor: saved.primaryColor ?? fundraiser.brandColor ?? DEFAULT_BRAND_COLORS.primaryColor,
    secondaryColor: saved.secondaryColor ?? fundraiser.secondaryColor ?? DEFAULT_BRAND_COLORS.secondaryColor,
    accentColor: saved.accentColor ?? fundraiser.accentColor ?? DEFAULT_BRAND_COLORS.accentColor,
  }
}
