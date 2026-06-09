/**
 * Social Media Sharing Types
 * Defines interfaces and types for social sharing functionality
 */

export type SocialPlatform =
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'linkedin'
  | 'whatsapp'
  | 'pinterest'
  | 'email'
  | 'copy'
  | 'native'

export type ContentType = 'product' | 'recipe' | 'location' | 'page'

export interface ShareContent {
  /** The title to share */
  title: string

  /** Description/summary text */
  description: string

  /** Full URL to share */
  url: string

  /** Image URL for visual platforms */
  image?: string

  /** Content type for analytics */
  contentType: ContentType

  /** Content ID for tracking */
  contentId?: string

  /** Additional hashtags (without #) */
  hashtags?: string[]

  /** Twitter handle to mention (without @) */
  via?: string
}

export interface ShareButtonProps {
  /** Platform to share to */
  platform: SocialPlatform

  /** Content to share */
  content: ShareContent

  /** Button size variant */
  size?: 'sm' | 'md' | 'lg'

  /** Show platform label text */
  showLabel?: boolean

  /** Custom className */
  className?: string

  /** Callback after successful share */
  onShare?: () => void

  /** Callback on share error */
  onError?: (error: Error) => void
}

export interface SocialShareProps {
  /** Content to share */
  content: ShareContent

  /** Platforms to display (defaults to all) */
  platforms?: SocialPlatform[]

  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical'

  /** Show platform labels */
  showLabels?: boolean

  /** Button size */
  size?: 'sm' | 'md' | 'lg'

  /** Title for the share section */
  title?: string

  /** Custom className */
  className?: string
}

export interface PlatformConfig {
  /** Platform identifier */
  name: SocialPlatform

  /** Display label */
  label: string

  /** Icon name (from lucide-react) */
  icon: string

  /** Brand color */
  color: string

  /** Share URL template */
  urlTemplate: string

  /** Supports images */
  supportsImage: boolean

  /** Requires custom handling */
  customHandler?: boolean
}

export interface ShareAnalyticsEvent {
  /** Platform shared to */
  platform: SocialPlatform

  /** Type of content shared */
  contentType: ContentType

  /** Content identifier */
  contentId?: string

  /** Page URL where share occurred */
  sourceUrl: string

  /** Timestamp */
  timestamp: Date

  /** User ID if authenticated */
  userId?: string
}

export interface ShareMetadata {
  /** Open Graph title */
  ogTitle: string

  /** Open Graph description */
  ogDescription: string

  /** Open Graph image */
  ogImage: string

  /** Open Graph type */
  ogType: 'website' | 'article' | 'product'

  /** Twitter card type */
  twitterCard: 'summary' | 'summary_large_image'

  /** Twitter title */
  twitterTitle: string

  /** Twitter description */
  twitterDescription: string

  /** Twitter image */
  twitterImage: string

  /** Canonical URL */
  canonicalUrl: string
}

export interface ProductShareContent extends ShareContent {
  contentType: 'product'

  /** Product price */
  price?: number

  /** Heat level */
  heatLevel?: string

  /** Availability */
  inStock?: boolean
}

export interface RecipeShareContent extends ShareContent {
  contentType: 'recipe'

  /** Prep time in minutes */
  prepTime?: number

  /** Cook time in minutes */
  cookTime?: number

  /** Number of servings */
  servings?: number

  /** Difficulty level */
  difficulty?: string
}

export interface LocationShareContent extends ShareContent {
  contentType: 'location'

  /** Business name */
  businessName?: string

  /** Address */
  address?: string

  /** City, State */
  cityState?: string

  /** Phone number */
  phone?: string
}
