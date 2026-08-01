'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

// Homepage hero. The footage scrubs frame-by-frame as the page scrolls. The copy
// sits in a tight left-hand column over a left-edge legibility gradient that fades
// to fully transparent before the centred subject — so the text always has
// contrast while the jar/table (centre-frame throughout) stay clean.

// The site navigation is `sticky top-0` and changes height between routes
// (72px normally, 103px on `/`), so measure it instead of hardcoding.
const DEFAULT_NAV_HEIGHT = 72

// Copy sits in the left column, clear of the centred subject. A firm shadow
// keeps it readable even where the gradient has faded out.
const COPY_SHADOW = '0 1px 3px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.75)'

const PANELS = [
  {
    eyebrow: 'Award-winning since 1987',
    title: 'Premium Gourmet',
    accent: 'Salsa',
    body: 'Made with the finest ingredients in Ohio. From mild to fiery hot, discover the perfect salsa for every taste, handcrafted in small batches.',
    cta: true,
  },
  {
    eyebrow: 'Small batch, always',
    title: '25+ flavors,',
    accent: 'one obsession',
    body: 'Every jar is cooked in small batches from Mike’s kitchen in Zanesville, Ohio — the same way it has been done since 1987.',
    cta: false,
  },
  {
    eyebrow: 'On the road',
    title: 'Find us at',
    accent: 'the market',
    body: '500+ fundraisers and 35+ years later, you will still find us behind the table at farmers markets and street fairs across Ohio.',
    cta: false,
  },
]

export function ScrollVideoHeroHome() {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const video = videoRef.current
    if (!section || !video) return

    // Nudge the decoder awake so the first seek paints immediately (iOS Safari
    // ignores currentTime on a video it has never started).
    video.play().then(() => video.pause()).catch(() => {})

    const measureNav = () => {
      const nav = document.querySelector('header')
      section.style.setProperty('--hero-nav-offset', `${nav?.offsetHeight || DEFAULT_NAV_HEIGHT}px`)
    }
    measureNav()
    window.addEventListener('resize', measureNav)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return () => window.removeEventListener('resize', measureNav)
    }

    let raf = 0
    let scrubbed = 0

    const tick = () => {
      const rect = section.getBoundingClientRect()
      const range = rect.height - window.innerHeight
      const progress = range > 0 ? Math.min(Math.max(-rect.top / range, 0), 1) : 0

      if (video.duration) {
        const target = progress * video.duration
        // Ease toward the target so flicks of the wheel read as motion, not jumps.
        scrubbed += (target - scrubbed) * 0.12
        if (Math.abs(video.currentTime - scrubbed) > 1 / 48) {
          video.currentTime = scrubbed
        }
      }

      if (cueRef.current) {
        cueRef.current.style.opacity = String(Math.min(Math.max((0.08 - progress) / 0.06, 0), 1))
      }

      raf = requestAnimationFrame(tick)
    }

    // Only run the loop while the hero is on screen.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !raf) {
        raf = requestAnimationFrame(tick)
      } else if (!entry.isIntersecting && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    })
    observer.observe(section)

    return () => {
      window.removeEventListener('resize', measureNav)
      observer.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      aria-labelledby="home-hero-title"
      className="relative isolate w-full max-w-[100vw] overscroll-x-none bg-[#070503] text-white"
      style={{ ['--hero-nav-offset' as string]: `${DEFAULT_NAV_HEIGHT}px` }}
    >
      {/* Pinned video layer. The negative margin pulls the panels below back up
          over it so they scroll in normal flow across a stationary backdrop.
          No overlay — the footage plays clean. */}
      <div
        className="sticky z-0 overflow-hidden"
        style={{
          top: 'var(--hero-nav-offset)',
          height: 'calc(100svh - var(--hero-nav-offset))',
          marginBottom: 'calc((100svh - var(--hero-nav-offset)) * -1)',
        }}
      >
        <video
          ref={videoRef}
          src="/images/home/hero-video-scrub.mp4"
          poster="/images/home/hero-video-poster.jpg"
          muted
          playsInline
          preload="auto"
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
        {/* Left-edge legibility gradient — behind the copy column, fading to
            fully transparent before the centred subject so the jar/table stay
            clean. This is a partial left scrim, not a full-frame cover. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.5) 22%, rgba(0,0,0,0) 52%)',
          }}
        />
        <div
          ref={cueRef}
          aria-hidden
          className="absolute inset-x-0 top-8 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70"
          style={{ textShadow: COPY_SHADOW }}
        >
          Scroll
        </div>
      </div>

      {/* Scrolling content — one full screen per panel, then a text-free outro
          so the closing beats (pan out the window, the outdoor booth) play
          full-screen after the last line of copy before the store section slides
          up over them. The copy is a narrow left column so it clears the jar. */}
      <div className="relative z-10">
        {PANELS.map((panel, idx) => (
          <div
            key={panel.title}
            className="flex items-center px-5 sm:px-8 md:px-14"
            style={{ minHeight: 'calc(100svh - var(--hero-nav-offset))' }}
          >
            <div className="max-w-sm md:max-w-md" style={{ textShadow: COPY_SHADOW }}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#f0c46a]">
                {panel.eyebrow}
              </p>
              {idx === 0 ? (
                <h1
                  id="home-hero-title"
                  className="font-serif text-4xl font-bold leading-[0.96] text-white sm:text-5xl md:text-6xl"
                >
                  {panel.title} <span className="text-[#f0c46a]">{panel.accent}</span>
                </h1>
              ) : (
                <h2 className="font-serif text-3xl font-bold leading-[1] text-white sm:text-4xl md:text-5xl">
                  {panel.title} <span className="text-[#f0c46a]">{panel.accent}</span>
                </h2>
              )}
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/90 md:max-w-sm md:text-base">
                {panel.body}
              </p>
              {panel.cta && (
                <p className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/products"
                    className="inline-flex min-h-12 items-center rounded-full bg-[#d9a235] px-7 py-3 text-sm font-bold uppercase tracking-wide text-[#140d06] shadow-lg transition-colors hover:bg-[#e6b54e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    style={{ textShadow: 'none' }}
                  >
                    Shop salsas
                  </Link>
                  <Link
                    href="/our-story"
                    className="inline-flex min-h-12 items-center rounded-full border border-white/50 bg-black/20 px-7 py-3 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    style={{ textShadow: 'none' }}
                  >
                    Our story
                  </Link>
                </p>
              )}
            </div>
          </div>
        ))}
        {/* Outro — one screen of scroll with no copy so the video runs out to its
            final frame (the outdoor booth) full-screen before the store covers it. */}
        <div aria-hidden style={{ height: 'calc(100svh - var(--hero-nav-offset))' }} />
      </div>
    </section>
  )
}
