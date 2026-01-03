import { PlatformConfig, SocialPlatform } from '@/types/sharing'

/**
 * Platform-specific configurations for social sharing
 * Includes branding, URL templates, and capabilities
 */

export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  facebook: {
    name: 'facebook',
    label: 'Facebook',
    icon: 'Facebook',
    color: '#1877F2',
    urlTemplate: 'https://www.facebook.com/sharer/sharer.php?u={url}',
    supportsImage: true,
  },

  twitter: {
    name: 'twitter',
    label: 'Twitter',
    icon: 'Twitter',
    color: '#1DA1F2',
    urlTemplate: 'https://twitter.com/intent/tweet?url={url}&text={text}&hashtags={hashtags}&via={via}',
    supportsImage: true,
  },

  instagram: {
    name: 'instagram',
    label: 'Instagram',
    icon: 'Instagram',
    color: '#E4405F',
    urlTemplate: '', // Instagram doesn't support direct sharing URLs
    supportsImage: true,
    customHandler: true,
  },

  linkedin: {
    name: 'linkedin',
    label: 'LinkedIn',
    icon: 'Linkedin',
    color: '#0A66C2',
    urlTemplate: 'https://www.linkedin.com/sharing/share-offsite/?url={url}',
    supportsImage: true,
  },

  whatsapp: {
    name: 'whatsapp',
    label: 'WhatsApp',
    icon: 'MessageCircle',
    color: '#25D366',
    urlTemplate: 'https://wa.me/?text={text}%20{url}',
    supportsImage: false,
  },

  pinterest: {
    name: 'pinterest',
    label: 'Pinterest',
    icon: 'Pin',
    color: '#E60023',
    urlTemplate: 'https://pinterest.com/pin/create/button/?url={url}&media={image}&description={text}',
    supportsImage: true,
  },

  email: {
    name: 'email',
    label: 'Email',
    icon: 'Mail',
    color: '#6B7280',
    urlTemplate: 'mailto:?subject={subject}&body={body}',
    supportsImage: false,
    customHandler: true,
  },

  copy: {
    name: 'copy',
    label: 'Copy Link',
    icon: 'Link',
    color: '#6B7280',
    urlTemplate: '', // Handled via clipboard API
    supportsImage: false,
    customHandler: true,
  },

  native: {
    name: 'native',
    label: 'Share',
    icon: 'Share2',
    color: '#6B7280',
    urlTemplate: '', // Uses Web Share API
    supportsImage: true,
    customHandler: true,
  },
}

/**
 * Default platforms to show (can be overridden per component)
 */
export const DEFAULT_PLATFORMS: SocialPlatform[] = [
  'facebook',
  'twitter',
  'linkedin',
  'whatsapp',
  'pinterest',
  'email',
  'copy',
]

/**
 * Mobile-optimized platforms (includes native share)
 */
export const MOBILE_PLATFORMS: SocialPlatform[] = [
  'native',
  'facebook',
  'twitter',
  'whatsapp',
  'copy',
]

/**
 * Recipe-optimized platforms (emphasizes Pinterest)
 */
export const RECIPE_PLATFORMS: SocialPlatform[] = [
  'pinterest',
  'facebook',
  'twitter',
  'email',
  'copy',
]

/**
 * Product-optimized platforms
 */
export const PRODUCT_PLATFORMS: SocialPlatform[] = [
  'facebook',
  'twitter',
  'pinterest',
  'whatsapp',
  'email',
  'copy',
]

/**
 * Location-optimized platforms
 */
export const LOCATION_PLATFORMS: SocialPlatform[] = [
  'facebook',
  'twitter',
  'whatsapp',
  'email',
  'copy',
]

/**
 * Check if a platform is available
 */
export function isPlatformAvailable(platform: SocialPlatform): boolean {
  const config = PLATFORM_CONFIGS[platform]

  // Native share only available if browser supports it
  if (platform === 'native') {
    return typeof navigator !== 'undefined' && 'share' in navigator
  }

  return !!config
}

/**
 * Get platform configuration
 */
export function getPlatformConfig(platform: SocialPlatform): PlatformConfig | null {
  return PLATFORM_CONFIGS[platform] || null
}

/**
 * Get available platforms based on device and content type
 */
export function getAvailablePlatforms(
  contentType?: string,
  isMobile: boolean = false
): SocialPlatform[] {
  // Start with default platforms
  let platforms: SocialPlatform[]

  // Choose based on content type
  switch (contentType) {
    case 'recipe':
      platforms = RECIPE_PLATFORMS
      break
    case 'product':
      platforms = PRODUCT_PLATFORMS
      break
    case 'location':
      platforms = LOCATION_PLATFORMS
      break
    default:
      platforms = DEFAULT_PLATFORMS
  }

  // On mobile, add native share if available
  if (isMobile && isPlatformAvailable('native')) {
    platforms = ['native', ...platforms.filter(p => p !== 'email')]
  }

  // Filter to only available platforms
  return platforms.filter(isPlatformAvailable)
}
