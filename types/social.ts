import type { SocialMediaPlatform, SocialMediaPostStatus, SocialPublishStatus, ShopPlatform, ShopListingStatus } from '@prisma/client'

export type SocialComposerState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Partial<Record<'content' | 'platforms' | 'scheduledAt' | 'media', string[]>>
}

export type SocialPlatformOption = {
  value: SocialMediaPlatform
  label: string
  description: string
  handle?: string
  isConnected?: boolean
  lastSyncedAt?: string | null
  connectUrl?: string
}

export type SocialCredentialProvider = 'facebook' | 'twitter' | 'tiktok' | 'google'

export type AyrshareStatusInfo = {
  configured: boolean
  /** Ayrshare platform ids the owner has linked, e.g. ['facebook','instagram']. */
  linkedAccounts: string[]
  error?: string
}

export type PlatformConfigStatus = {
  platform: SocialMediaPlatform
  label: string
  /** Credential provider powering this platform ('facebook' covers FB + Instagram). */
  provider: SocialCredentialProvider
  /** True when usable credentials exist (entered in admin or via env). */
  configured: boolean
  /** Where the active credentials came from, for honest UI messaging. */
  source: 'admin' | 'env' | null
  /** Env var names a power user could set instead of using the admin form. */
  requiredEnv: string[]
  devConsoleUrl: string
  steps: string[]
  note?: string
  /** Exact OAuth redirect URL to paste into the platform's developer console. */
  redirectUri: string
  /** Set when this platform reuses another's credentials (Instagram → Facebook). */
  sharesCredentialsWith?: SocialMediaPlatform
}

export type SocialAccountInfo = {
  id: string
  platform: SocialMediaPlatform
  accountId: string
  accountName: string
  accountHandle: string | null
  profileImageUrl: string | null
  isActive: boolean
  lastVerifiedAt: string | null
  connectionError: string | null
  scopes: string[]
  tokenExpiresAt: string | null
  createdAt: string
}

export type SocialPostWithPublishes = {
  id: string
  platforms: SocialMediaPlatform[]
  content: string
  facebookContent: string | null
  twitterContent: string | null
  tiktokContent: string | null
  instagramContent: string | null
  scheduledAt: string | null
  status: SocialMediaPostStatus
  hashtags: string[]
  linkUrl: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  media: Array<{
    id: string
    mediaId: string
    order: number
    media: {
      id: string
      url: string
      filename: string
      mimeType: string
      alt: string | null
      width: number | null
      height: number | null
    }
  }>
  publishes: Array<{
    id: string
    platform: SocialMediaPlatform
    externalPostId: string | null
    externalUrl: string | null
    status: SocialPublishStatus
    errorMessage: string | null
    likes: number
    comments: number
    shares: number
    impressions: number
    reach: number
    clicks: number
    publishedAt: string | null
    metricsUpdatedAt: string | null
    account: {
      id: string
      accountName: string
      accountHandle: string | null
      profileImageUrl: string | null
    }
  }>
}

export type PlatformConfig = {
  platform: SocialMediaPlatform
  label: string
  shortLabel: string
  icon: string
  color: string
  bgColor: string
  textColor: string
  maxChars: number
  supportsImages: boolean
  supportsVideo: boolean
  supportsCarousel: boolean
  supportsStories: boolean
  supportsReels: boolean
  maxImages: number
  maxVideoLength: number // seconds
  aspectRatios: string[]
  oauthUrl: string
  requiredScopes: string[]
}

export const PLATFORM_CONFIGS: Record<SocialMediaPlatform, PlatformConfig> = {
  FACEBOOK: {
    platform: 'FACEBOOK',
    label: 'Facebook',
    shortLabel: 'FB',
    icon: 'facebook',
    color: '#1877F2',
    bgColor: 'bg-[#1877F2]',
    textColor: 'text-[#1877F2]',
    maxChars: 63206,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: true,
    supportsStories: true,
    supportsReels: true,
    maxImages: 10,
    maxVideoLength: 240 * 60,
    aspectRatios: ['1:1', '16:9', '4:5', '9:16'],
    oauthUrl: '/api/social/oauth/facebook',
    requiredScopes: [
      'pages_manage_posts',
      'pages_read_engagement',
      'pages_show_list',
      'pages_read_user_content',
      'pages_manage_metadata',
    ],
  },
  INSTAGRAM: {
    platform: 'INSTAGRAM',
    label: 'Instagram',
    shortLabel: 'IG',
    icon: 'instagram',
    color: '#E4405F',
    bgColor: 'bg-[#E4405F]',
    textColor: 'text-[#E4405F]',
    maxChars: 2200,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: true,
    supportsStories: true,
    supportsReels: true,
    maxImages: 10,
    maxVideoLength: 90,
    aspectRatios: ['1:1', '4:5', '9:16'],
    oauthUrl: '/api/social/oauth/facebook', // Instagram uses Facebook OAuth
    requiredScopes: [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
    ],
  },
  TWITTER: {
    platform: 'TWITTER',
    label: 'X (Twitter)',
    shortLabel: 'X',
    icon: 'twitter',
    color: '#000000',
    bgColor: 'bg-black',
    textColor: 'text-black',
    maxChars: 280,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: false,
    supportsStories: false,
    supportsReels: false,
    maxImages: 4,
    maxVideoLength: 140,
    aspectRatios: ['16:9', '1:1'],
    oauthUrl: '/api/social/oauth/twitter',
    requiredScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  },
  TIKTOK: {
    platform: 'TIKTOK',
    label: 'TikTok',
    shortLabel: 'TT',
    icon: 'tiktok',
    color: '#000000',
    bgColor: 'bg-black',
    textColor: 'text-black',
    maxChars: 2200,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: true,
    supportsStories: false,
    supportsReels: false,
    maxImages: 35,
    maxVideoLength: 600,
    aspectRatios: ['9:16', '1:1'],
    oauthUrl: '/api/social/oauth/tiktok',
    requiredScopes: ['user.info.basic', 'video.publish', 'video.upload'],
  },
  GOOGLE_MY_BUSINESS: {
    platform: 'GOOGLE_MY_BUSINESS',
    label: 'Google Business',
    shortLabel: 'GMB',
    icon: 'store',
    color: '#4285F4',
    bgColor: 'bg-[#4285F4]',
    textColor: 'text-[#4285F4]',
    maxChars: 1500,
    supportsImages: true,
    supportsVideo: false,
    supportsCarousel: false,
    supportsStories: false,
    supportsReels: false,
    maxImages: 1,
    maxVideoLength: 0,
    aspectRatios: ['4:3', '1:1'],
    oauthUrl: '/api/social/oauth/google',
    requiredScopes: ['https://www.googleapis.com/auth/business.manage'],
  },
}

export type DashboardTab = 'overview' | 'compose' | 'calendar' | 'accounts' | 'shops' | 'analytics'

// Shop types
export type ShopListingInfo = {
  id: string
  productId: string
  productName: string
  productSku: string
  productPrice: string
  productImage: string | null
  productInventory: number
  shopPlatform: ShopPlatform
  socialAccountId: string | null
  targetAccountName: string | null
  targetAccountHandle: string | null
  targetAccountPlatform: SocialMediaPlatform | null
  externalId: string | null
  externalUrl: string | null
  catalogId: string | null
  status: ShopListingStatus
  syncError: string | null
  titleOverride: string | null
  descriptionOverride: string | null
  priceOverride: string | null
  condition: string | null
  availability: string | null
  marketplaceCategory: string | null
  lastSyncedAt: string | null
  publishedAt: string | null
}

export type ShopOverview = {
  totalListings: number
  activeListings: number
  errorListings: number
  pendingListings: number
  byPlatform: Record<string, { total: number; active: number; errors: number }>
}

export const SHOP_PLATFORM_CONFIG: Record<ShopPlatform, {
  label: string
  shortLabel: string
  description: string
  color: string
  bgColor: string
  textColor: string
  borderColor: string
}> = {
  FACEBOOK_SHOP: {
    label: 'Facebook Shop',
    shortLabel: 'FB Shop',
    description: 'List products on your Facebook Page Shop tab for customers to browse and purchase.',
    color: '#1877F2',
    bgColor: 'bg-[#1877F2]',
    textColor: 'text-[#1877F2]',
    borderColor: 'border-[#1877F2]',
  },
  FACEBOOK_MARKETPLACE: {
    label: 'Facebook Marketplace',
    shortLabel: 'Marketplace',
    description: 'List products on Facebook Marketplace for local and shipped sales.',
    color: '#1877F2',
    bgColor: 'bg-[#1877F2]',
    textColor: 'text-[#1877F2]',
    borderColor: 'border-[#1877F2]',
  },
  TIKTOK_SHOP: {
    label: 'TikTok Shop',
    shortLabel: 'TT Shop',
    description: 'Sell products directly on TikTok through in-app shopping and live commerce.',
    color: '#000000',
    bgColor: 'bg-black',
    textColor: 'text-black',
    borderColor: 'border-black',
  },
}

export type CalendarPost = {
  id: string
  content: string
  platforms: SocialMediaPlatform[]
  status: SocialMediaPostStatus
  scheduledAt: string
  publishedAt: string | null
}

export type PlatformMetrics = {
  platform: SocialMediaPlatform
  totalPosts: number
  totalLikes: number
  totalComments: number
  totalShares: number
  totalImpressions: number
  totalReach: number
  totalClicks: number
  engagementRate: number
}
