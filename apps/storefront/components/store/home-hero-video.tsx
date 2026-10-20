'use client'

import { useEffect, useRef } from 'react'

/**
 * The homepage hero loop. The poster still underneath is the page's largest paint, so the
 * 1.2 MB video only starts downloading after the page has loaded, and never for visitors
 * who ask for reduced motion (it is hidden for them).
 */
export function HomeHeroVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const start = () => {
      video.src = src
      video.play().catch(() => {})
    }
    if (document.readyState === 'complete') {
      start()
      return
    }
    window.addEventListener('load', start, { once: true })
    return () => window.removeEventListener('load', start)
  }, [src])

  return <video ref={ref} aria-hidden className={className} autoPlay muted loop playsInline preload="none" />
}
