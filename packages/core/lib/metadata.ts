import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site-url'

const OG_IMAGE_BASE_PATH = '/images/opengraph'
const DEFAULT_OG_IMAGE = `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`

const ogImageMap: Record<string, string> = {
  '/': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/accessibility': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/account': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/account/orders': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/account/settings': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/about': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/contact': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/auth': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/checkout': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/cookies': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/find-us': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/forms': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/fundraising': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/gift-certificates': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/merchandise': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/our-story': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/privacy': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/products': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/recipes': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/salsas': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/terms': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/where-is-jose': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/wholesale': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/developer': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/products': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/fundraisers': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/wholesale': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/gift-certificates': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/merchandise': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/messages': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/communications': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/find-us': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/where-is-jose': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
  '/admin/story': `${SITE_URL}${OG_IMAGE_BASE_PATH}/josemadridhome.png`,
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

