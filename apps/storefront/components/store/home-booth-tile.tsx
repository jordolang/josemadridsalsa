'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Play } from 'lucide-react'

/**
 * The tilted "Real Flavor. Real Impact." card in the homepage shop band. The play
 * button swaps the still for the real booth footage.
 */
export function HomeBoothTile() {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="relative mx-auto aspect-[232/285] w-full max-w-[320px] -rotate-2 overflow-hidden rounded-sm border border-desert-sun-gold/40 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
      {playing ? (
        <video
          src="/images/home/hero-video-scrub.mp4"
          poster="/images/home/redesign/booth-tile-photo.webp"
          className="h-full w-full object-cover"
          controls
          autoPlay
          muted
          playsInline
        />
      ) : (
        <>
          <Image
            src="/images/home/redesign/booth-tile-photo.webp"
            alt="A bowl of Jose Madrid salsa with tortilla chips at our market booth"
            fill
            sizes="(min-width: 1024px) 320px, 80vw"
            className="object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />
          <p className="font-script absolute left-5 top-6 max-w-[60%] text-[clamp(1.75rem,3vw,2.6rem)] leading-[1.05] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
            Real Flavor.
            <br />
            Real Impact.
          </p>
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute left-1/2 top-[62%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/90 bg-black/45 text-white transition-colors hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-desert-sun-gold"
            aria-label="Play our booth video"
          >
            <Play className="ml-1 h-6 w-6 fill-current" />
          </button>
        </>
      )}
    </div>
  )
}
