import { ShareAnalyticsEvent, SocialPlatform, ContentType } from '@/types/sharing'

/**
 * Track social sharing events with Amplitude
 */

/**
 * Track share event
 */
export function trackShareEvent(params: {
  platform: SocialPlatform
  contentType: ContentType
  contentId?: string
  contentTitle?: string
  userId?: string
}): void {
  const { platform, contentType, contentId, contentTitle, userId } = params

  // Track in Amplitude (if available)
  if (typeof window !== 'undefined' && (window as any).amplitude) {
    const amplitude = (window as any).amplitude

    amplitude.track('Content Shared', {
      platform,
      content_type: contentType,
      content_id: contentId,
      content_title: contentTitle,
      source_url: window.location.href,
      timestamp: new Date().toISOString(),
      user_id: userId,
    })
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Share Analytics]', {
      event: 'Content Shared',
      platform,
      contentType,
      contentId,
      contentTitle,
      url: typeof window !== 'undefined' ? window.location.href : '',
    })
  }
}

/**
 * Track share success
 */
export function trackShareSuccess(params: {
  platform: SocialPlatform
  contentType: ContentType
  contentId?: string
}): void {
  const { platform, contentType, contentId } = params

  if (typeof window !== 'undefined' && (window as any).amplitude) {
    const amplitude = (window as any).amplitude

    amplitude.track('Share Successful', {
      platform,
      content_type: contentType,
      content_id: contentId,
    })
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Share Analytics] Success:', { platform, contentType, contentId })
  }
}

/**
 * Track share error
 */
export function trackShareError(params: {
  platform: SocialPlatform
  contentType: ContentType
  error: string
  contentId?: string
}): void {
  const { platform, contentType, error, contentId } = params

  if (typeof window !== 'undefined' && (window as any).amplitude) {
    const amplitude = (window as any).amplitude

    amplitude.track('Share Failed', {
      platform,
      content_type: contentType,
      content_id: contentId,
      error_message: error,
    })
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('[Share Analytics] Error:', { platform, contentType, error, contentId })
  }
}

/**
 * Track copy to clipboard
 */
export function trackCopyToClipboard(params: {
  contentType: ContentType
  contentId?: string
  url: string
}): void {
  const { contentType, contentId, url } = params

  if (typeof window !== 'undefined' && (window as any).amplitude) {
    const amplitude = (window as any).amplitude

    amplitude.track('Link Copied', {
      content_type: contentType,
      content_id: contentId,
      url,
    })
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Share Analytics] Link copied:', { contentType, contentId, url })
  }
}

/**
 * Track native share usage
 */
export function trackNativeShare(params: {
  contentType: ContentType
  contentId?: string
}): void {
  const { contentType, contentId } = params

  if (typeof window !== 'undefined' && (window as any).amplitude) {
    const amplitude = (window as any).amplitude

    amplitude.track('Native Share Used', {
      content_type: contentType,
      content_id: contentId,
      user_agent: navigator.userAgent,
    })
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Share Analytics] Native share:', { contentType, contentId })
  }
}

/**
 * Batch track multiple shares (for analytics aggregation)
 */
export function trackBatchShares(events: ShareAnalyticsEvent[]): void {
  if (typeof window !== 'undefined' && (window as any).amplitude) {
    const amplitude = (window as any).amplitude

    events.forEach(event => {
      amplitude.track('Content Shared', {
        platform: event.platform,
        content_type: event.contentType,
        content_id: event.contentId,
        source_url: event.sourceUrl,
        timestamp: event.timestamp.toISOString(),
        user_id: event.userId,
      })
    })
  }
}

/**
 * Get share analytics summary
 */
export async function getShareAnalytics(params: {
  contentType?: ContentType
  contentId?: string
  dateRange?: { start: Date; end: Date }
}): Promise<{
  totalShares: number
  byPlatform: Record<SocialPlatform, number>
  byContent: Record<string, number>
}> {
  // This would typically fetch from your analytics backend
  // For now, returning placeholder structure
  return {
    totalShares: 0,
    byPlatform: {
      facebook: 0,
      twitter: 0,
      instagram: 0,
      linkedin: 0,
      whatsapp: 0,
      pinterest: 0,
      email: 0,
      copy: 0,
      native: 0,
    },
    byContent: {},
  }
}
