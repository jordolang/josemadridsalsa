import { ShareMetadata, ContentType } from '@/types/sharing'
import { SITE_URL as DEFAULT_SITE_URL } from '@/lib/site-url'

/**
 * Extract and generate metadata for social sharing
 */

const SITE_NAME = 'Jose Madrid Salsa'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
const DEFAULT_IMAGE = `${SITE_URL}/images/og-default.jpg`
const TWITTER_HANDLE = '@josemadridsalsa'

/**
 * Generate Open Graph and Twitter Card metadata
 */
export function generateShareMetadata(params: {
  title: string
  description: string
  image?: string
  url: string
  type?: 'website' | 'article' | 'product'
}): ShareMetadata {
  const {
    title,
    description,
    image = DEFAULT_IMAGE,
    url,
    type = 'website',
  } = params

  const ogTitle = `${title} | ${SITE_NAME}`
  const twitterCard = image ? 'summary_large_image' : 'summary'

  return {
    ogTitle,
    ogDescription: description,
    ogImage: image,
    ogType: type,
    twitterCard,
    twitterTitle: ogTitle,
    twitterDescription: description,
    twitterImage: image,
    canonicalUrl: url,
  }
}

/**
 * Extract product metadata
 */
export function extractProductMetadata(product: {
  name: string
  description: string
  featuredImage: string
  price: number
  heatLevel: string
  slug: string
}): ShareMetadata {
  const url = `${SITE_URL}/salsas/${product.slug}`
  const title = product.name
  const description = `${product.description} - Heat Level: ${product.heatLevel} - $${product.price.toFixed(2)}`

  return generateShareMetadata({
    title,
    description,
    image: product.featuredImage,
    url,
    type: 'product',
  })
}

/**
 * Extract recipe metadata
 */
export function extractRecipeMetadata(recipe: {
  title: string
  description: string
  image?: string
  prepTime?: number
  cookTime?: number
  servings?: number
  slug: string
}): ShareMetadata {
  const url = `${SITE_URL}/recipes/${recipe.slug}`
  const timeParts: string[] = []

  if (recipe.prepTime) {
    timeParts.push(`${recipe.prepTime} min prep`)
  }
  if (recipe.cookTime) {
    timeParts.push(`${recipe.cookTime} min cook`)
  }
  if (recipe.servings) {
    timeParts.push(`Serves ${recipe.servings}`)
  }

  const timeInfo = timeParts.length > 0 ? ` - ${timeParts.join(', ')}` : ''
  const description = `${recipe.description}${timeInfo}`

  return generateShareMetadata({
    title: recipe.title,
    description,
    image: recipe.image,
    url,
    type: 'article',
  })
}

/**
 * Extract location metadata
 */
export function extractLocationMetadata(location: {
  businessName: string
  address: string
  city: string
  state: string
  photoUrl?: string
  id: string
}): ShareMetadata {
  const url = `${SITE_URL}/find-us/${location.id}`
  const title = `${location.businessName} - Find Jose Madrid Salsa`
  const description = `Get Jose Madrid Salsa at ${location.businessName} located at ${location.address}, ${location.city}, ${location.state}`

  return generateShareMetadata({
    title,
    description,
    image: location.photoUrl,
    url,
    type: 'website',
  })
}

/**
 * Extract page metadata
 */
export function extractPageMetadata(params: {
  title: string
  description: string
  path: string
  image?: string
}): ShareMetadata {
  const url = `${SITE_URL}${params.path}`

  return generateShareMetadata({
    title: params.title,
    description: params.description,
    image: params.image,
    url,
    type: 'website',
  })
}

/**
 * Convert metadata to meta tags (for Next.js metadata API)
 */
export function metadataToMetaTags(metadata: ShareMetadata) {
  return {
    title: metadata.ogTitle,
    description: metadata.ogDescription,
    openGraph: {
      title: metadata.ogTitle,
      description: metadata.ogDescription,
      url: metadata.canonicalUrl,
      siteName: SITE_NAME,
      images: [
        {
          url: metadata.ogImage,
          width: 1200,
          height: 630,
          alt: metadata.ogTitle,
        },
      ],
      type: metadata.ogType,
    },
    twitter: {
      card: metadata.twitterCard,
      title: metadata.twitterTitle,
      description: metadata.twitterDescription,
      images: [metadata.twitterImage],
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
    },
    alternates: {
      canonical: metadata.canonicalUrl,
    },
  }
}

/**
 * Generate default hashtags based on content type
 */
export function generateHashtags(contentType: ContentType): string[] {
  const baseHashtags = ['JoseMadridSalsa', 'Salsa']

  switch (contentType) {
    case 'product':
      return [...baseHashtags, 'SpicyFood', 'Foodie']

    case 'recipe':
      return [...baseHashtags, 'Recipe', 'Cooking', 'Foodie']

    case 'location':
      return [...baseHashtags, 'ShopLocal', 'FindUs']

    default:
      return baseHashtags
  }
}
