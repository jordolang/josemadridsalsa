import Image from 'next/image'
import { cn } from '@/lib/utils'

interface HeroMediaProps {
  imageUrl?: string | null
  videoUrl?: string | null
  posterUrl?: string | null
  alt?: string
  priority?: boolean
  className?: string
}

const FALLBACK_IMAGE = '/images/jose-madrid-profile-1024.png'

export function HeroMedia({
  imageUrl,
  videoUrl,
  posterUrl,
  alt = '',
  priority = true,
  className,
}: HeroMediaProps) {
  const hasVideo = Boolean(videoUrl)
  const poster = posterUrl ?? imageUrl ?? FALLBACK_IMAGE
  const image = imageUrl ?? FALLBACK_IMAGE

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
          poster={poster}
          controls
          preload="metadata"
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={alt || 'Campaign video'}
        />
      ) : (
        <Image
          src={image}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 720px, 100vw"
          className="object-cover"
        />
      )}
    </div>
  )
}
