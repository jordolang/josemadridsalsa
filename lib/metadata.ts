import type { Metadata } from 'next'

const OG_IMAGE_BASE_PATH = '/images/OpenGraph'
const DEFAULT_OG_IMAGE = `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`

const ogImageMap: Record<string, string> = {
  '/': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/accessibility': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/account': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/account/orders': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/account/settings': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/about': `${OG_IMAGE_BASE_PATH}/about.png`,
  '/auth': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/checkout': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/cookies': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/find-us': `${OG_IMAGE_BASE_PATH}/find-us.png`,
  '/forms': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/fundraising': `${OG_IMAGE_BASE_PATH}/fundraising.png`,
  '/gift-certificates': `${OG_IMAGE_BASE_PATH}/gift-certificates.png`,
  '/merchandise': `${OG_IMAGE_BASE_PATH}/merch.png`,
  '/our-story': `${OG_IMAGE_BASE_PATH}/story.png`,
  '/privacy': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/products': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/recipes': `${OG_IMAGE_BASE_PATH}/recipes.png`,
  '/salsas': `${OG_IMAGE_BASE_PATH}/Salsas.png`,
  '/terms': `${OG_IMAGE_BASE_PATH}/Home-Opengraph-Dark.png`,
  '/where-is-jose': `${OG_IMAGE_BASE_PATH}/where-is-jose.png`,
  '/wholesale': `${OG_IMAGE_BASE_PATH}/wholesale.png`,
  '/admin': `${OG_IMAGE_BASE_PATH}/dark-mode/home-dark.png`,
  '/admin/products': `${OG_IMAGE_BASE_PATH}/dark-mode/products-dark.png`,
  '/admin/recipes': `${OG_IMAGE_BASE_PATH}/dark-mode/recipes-dark.png`,
  '/admin/fundraisers': `${OG_IMAGE_BASE_PATH}/dark-mode/fundraising-dark.png`,
  '/admin/wholesale': `${OG_IMAGE_BASE_PATH}/dark-mode/wholesale-dark.png`,
  '/admin/gift-certificates': `${OG_IMAGE_BASE_PATH}/dark-mode/gift-certificates-dark.png`,
  '/admin/merchandise': `${OG_IMAGE_BASE_PATH}/dark-mode/merch-dark.png`,
  '/admin/messages': `${OG_IMAGE_BASE_PATH}/dark-mode/chat-dark.png`,
  '/admin/communications': `${OG_IMAGE_BASE_PATH}/dark-mode/chat-dark.png`,
  '/admin/find-us': `${OG_IMAGE_BASE_PATH}/dark-mode/find-us-dark.png`,
  '/admin/where-is-jose': `${OG_IMAGE_BASE_PATH}/dark-mode/where-is-jose-dark.png`,
  '/admin/story': `${OG_IMAGE_BASE_PATH}/dark-mode/story-dark.png`,
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

