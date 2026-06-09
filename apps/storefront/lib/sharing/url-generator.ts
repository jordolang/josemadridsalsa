import { ShareContent, SocialPlatform } from '@/types/sharing'
import { PLATFORM_CONFIGS } from './platforms'

/**
 * Generate platform-specific share URLs
 */

/**
 * Add UTM parameters to URL for tracking
 */
export function addUTMParameters(
  url: string,
  platform: SocialPlatform,
  contentType?: string
): string {
  const urlObj = new URL(url)

  urlObj.searchParams.set('utm_source', platform)
  urlObj.searchParams.set('utm_medium', 'social')

  if (contentType) {
    urlObj.searchParams.set('utm_campaign', `share_${contentType}`)
  }

  return urlObj.toString()
}

/**
 * Encode text for URLs
 */
export function encodeShareText(text: string): string {
  return encodeURIComponent(text)
}

/**
 * Generate custom message based on content type
 */
export function generateShareMessage(content: ShareContent): string {
  const { title, description, contentType } = content

  switch (contentType) {
    case 'product':
      return `Check out ${title} from Jose Madrid Salsa! ${description}`

    case 'recipe':
      return `Try this delicious recipe: ${title}! ${description}`

    case 'location':
      return `Find Jose Madrid Salsa at ${title}! ${description}`

    case 'page':
    default:
      return `${title} - ${description}`
  }
}

/**
 * Generate Facebook share URL
 */
function generateFacebookUrl(content: ShareContent): string {
  const config = PLATFORM_CONFIGS.facebook
  const url = addUTMParameters(content.url, 'facebook', content.contentType)

  return config.urlTemplate.replace('{url}', encodeShareText(url))
}

/**
 * Generate Twitter share URL
 */
function generateTwitterUrl(content: ShareContent): string {
  const config = PLATFORM_CONFIGS.twitter
  const url = addUTMParameters(content.url, 'twitter', content.contentType)
  const text = content.description || content.title
  const hashtags = (content.hashtags || ['JoseMadridSalsa']).join(',')
  const via = content.via || 'josemadridsalsa'

  return config.urlTemplate
    .replace('{url}', encodeShareText(url))
    .replace('{text}', encodeShareText(text))
    .replace('{hashtags}', encodeShareText(hashtags))
    .replace('{via}', via)
}

/**
 * Generate LinkedIn share URL
 */
function generateLinkedInUrl(content: ShareContent): string {
  const config = PLATFORM_CONFIGS.linkedin
  const url = addUTMParameters(content.url, 'linkedin', content.contentType)

  return config.urlTemplate.replace('{url}', encodeShareText(url))
}

/**
 * Generate WhatsApp share URL
 */
function generateWhatsAppUrl(content: ShareContent): string {
  const config = PLATFORM_CONFIGS.whatsapp
  const message = generateShareMessage(content)
  const url = addUTMParameters(content.url, 'whatsapp', content.contentType)

  return config.urlTemplate
    .replace('{text}', encodeShareText(message))
    .replace('{url}', encodeShareText(url))
}

/**
 * Generate Pinterest share URL
 */
function generatePinterestUrl(content: ShareContent): string {
  const config = PLATFORM_CONFIGS.pinterest
  const url = addUTMParameters(content.url, 'pinterest', content.contentType)
  const text = content.description || content.title
  const image = content.image || ''

  return config.urlTemplate
    .replace('{url}', encodeShareText(url))
    .replace('{media}', encodeShareText(image))
    .replace('{text}', encodeShareText(text))
}

/**
 * Generate Email share URL
 */
function generateEmailUrl(content: ShareContent): string {
  const config = PLATFORM_CONFIGS.email
  const subject = `Check this out: ${content.title}`
  const message = generateShareMessage(content)
  const url = addUTMParameters(content.url, 'email', content.contentType)
  const body = `${message}\n\n${url}\n\nShared from Jose Madrid Salsa`

  return config.urlTemplate
    .replace('{subject}', encodeShareText(subject))
    .replace('{body}', encodeShareText(body))
}

/**
 * Main function to generate share URL for any platform
 */
export function generateShareUrl(
  platform: SocialPlatform,
  content: ShareContent
): string {
  switch (platform) {
    case 'facebook':
      return generateFacebookUrl(content)

    case 'twitter':
      return generateTwitterUrl(content)

    case 'linkedin':
      return generateLinkedInUrl(content)

    case 'whatsapp':
      return generateWhatsAppUrl(content)

    case 'pinterest':
      return generatePinterestUrl(content)

    case 'email':
      return generateEmailUrl(content)

    case 'copy':
    case 'instagram':
    case 'native':
      // These are handled by custom handlers
      return addUTMParameters(content.url, platform, content.contentType)

    default:
      return content.url
  }
}

/**
 * Open share URL in new window
 */
export function openShareWindow(
  url: string,
  platform: SocialPlatform,
  width: number = 600,
  height: number = 600
): Window | null {
  // Don't open new window for email (opens in default mail client)
  if (platform === 'email') {
    window.location.href = url
    return null
  }

  const left = window.screen.width / 2 - width / 2
  const top = window.screen.height / 2 - height / 2

  return window.open(
    url,
    `share-${platform}`,
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
  )
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Use native Web Share API (mobile-optimized)
 */
export async function nativeShare(content: ShareContent): Promise<boolean> {
  if (!navigator.share) {
    return false
  }

  try {
    await navigator.share({
      title: content.title,
      text: content.description,
      url: addUTMParameters(content.url, 'native', content.contentType),
    })
    return true
  } catch (error) {
    // User cancelled or error occurred
    if ((error as Error).name !== 'AbortError') {
      console.error('Native share failed:', error)
    }
    return false
  }
}
