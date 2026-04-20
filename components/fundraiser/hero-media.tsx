import Image from 'next/image'
import { Swords } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeroMediaProps {
  imageUrl?: string | null
  videoUrl?: string | null
  posterUrl?: string | null
  alt?: string
  priority?: boolean
  className?: string
  /** Team color used for the placeholder gradient when no media is set. */
  teamColor?: string | null
  /** Dark variant of the team color used for the placeholder gradient. */
  teamColorDark?: string | null
}

export function HeroMedia({
  imageUrl,
  videoUrl,
  posterUrl,
  alt = '',
  priority = true,
  className,
  teamColor,
  teamColorDark,
}: HeroMediaProps) {
  const hasVideo = Boolean(videoUrl)
  const hasImage = Boolean(imageUrl)
  const primary = teamColor || '#7C3AED'
  const dark = teamColorDark || '#312E81'

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm',
        className,
      )}
    >
      {hasVideo ? (
        <video
          src={videoUrl ?? undefined}
          poster={posterUrl ?? imageUrl ?? undefined}
          controls
          preload="metadata"
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={alt || 'Campaign video'}
        />
      ) : hasImage ? (
        <Image
          src={imageUrl!}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 720px, 100vw"
          className="object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundImage: `linear-gradient(135deg, ${primary} 0%, ${dark} 100%)`,
          }}
          aria-label={alt || 'Campaign hero placeholder'}
        >
          <div className="flex flex-col items-center gap-3 text-white/90">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm shadow-lg">
              <Swords className="h-8 w-8" aria-hidden />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
              Battle Arena Team
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
