export interface SharePayload {
  title: string
  url: string
  text?: string
}

/**
 * Whether to prefer the device's native share sheet over a platform web intent.
 *
 * Only true on touch / coarse-pointer devices (phones, tablets). That's where
 * the Facebook/X apps intercept their web share URLs as universal links and
 * open their home feed instead of a share composer — the native sheet hands the
 * post to the chosen app correctly. On desktop we deliberately stay false:
 * desktop browsers that expose `navigator.share` (Safari/macOS, Edge & Chrome on
 * Windows) would otherwise open a generic OS share sheet that may not even list
 * the target network, so the platform's own web intent is the reliable path.
 */
function prefersNativeShare(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share) return false
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches
  }
  return (navigator.maxTouchPoints ?? 0) > 0
}

/**
 * Hand a post to a social platform. On touch devices this prefers the native
 * share sheet (see {@link prefersNativeShare}); everywhere else, and whenever
 * native sharing isn't available, it opens the provided fallback URL — the
 * platform's web intent, or for networks with no web link-share endpoint
 * (Instagram/TikTok) a brand profile URL.
 */
export function nativeShareOr(fallbackUrl: string, payload: SharePayload) {
  if (prefersNativeShare()) {
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
