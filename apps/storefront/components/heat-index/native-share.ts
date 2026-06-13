export interface SharePayload {
  title: string
  url: string
  text?: string
}

/**
 * Hand a post to a social platform, preferring the device's native share sheet.
 *
 * On mobile the Facebook/X apps intercept their web share URLs as universal
 * links and open their home feed instead of a share composer, so nothing
 * actually gets shared. The Web Share API avoids that by handing the post to
 * whichever app the user picks. When it isn't available (e.g. desktop) we fall
 * back to the platform's web intent — or, for networks with no web link-share
 * endpoint (Instagram/TikTok), a brand profile URL.
 */
export function nativeShareOr(fallbackUrl: string, payload: SharePayload) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share(payload).catch((error: unknown) => {
      // Dismissing the share sheet rejects with AbortError — that's the user's
      // choice, not a failure, so leave it be. For any genuine error, fall back
      // to opening the web intent.
      if ((error as Error)?.name !== 'AbortError') {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
      }
    })
  } else {
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
  }
}
