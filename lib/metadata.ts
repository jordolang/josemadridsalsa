import type { Metadata } from 'next'

const SITE_URL = 'https://www.josemadrid.net'
const OG_IMAGE_BASE_PATH = '/images/Opengraph'
const DEFAULT_OG_IMAGE = `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`

const ogImageMap: Record<string, string> = {
  '/': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/accessibility': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/account': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/account/orders': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/account/settings': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/about': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/auth': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/checkout': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/cookies': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/find-us': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/forms': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/fundraising': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/gift-certificates': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/merchandise': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/our-story': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/privacy': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/products': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/recipes': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/salsas': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/terms': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/where-is-jose': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/wholesale': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/developer': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/products': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/fundraisers': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/wholesale': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/gift-certificates': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/merchandise': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/messages': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/communications': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/find-us': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/where-is-jose': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
  '/admin/story': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadrid-hero.png`,
}

function resolveOgImage(pathname: string) {
  if (!pathname) return DEFAULT_OG_IMAGE

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const withoutTrailingSlash =
    normalized === '/' ? normalized : normalized.replace(/\/+$/, '')

  if (ogImageMap[withoutTrailingSlash]) {
    return ogImageMap[withoutTrailingSlash]
  }

  const segments = withoutTrailingSlash.split('/').filter(Boolean)

  while (segments.length > 0) {
    const candidate = `/${segments.join('/')}`
    if (ogImageMap[candidate]) {
      return ogImageMap[candidate]
    }
    segments.pop()
  }

  return DEFAULT_OG_IMAGE
}

type CreateMetadataInput = {
  title: string
  description: string
  pathname?: string
  imageOverride?: string
  keywords?: string[]
}

export function createMetadata({
  title,
  description,
  pathname = '/',
  imageOverride,
  keywords,
}: CreateMetadataInput): Metadata {
  const image = imageOverride ?? resolveOgImage(pathname)

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

