import Image from 'next/image'
import { cn } from '@/lib/utils'
import { VerifiedBadge } from '@/components/fundraiser/verified-badge'

interface CampaignHeaderProps {
  title: string
  tagline?: string | null
  organizerName: string
  logoUrl?: string | null
  logoAlt?: string
  verified?: boolean
  eyebrow?: string
  className?: string
}

const FALLBACK_LOGO = '/images/logo-image.png'

export function CampaignHeader({
  title,
  tagline,
  organizerName,
  logoUrl,
  logoAlt,
  verified = true,
  eyebrow = 'Jose Madrid Salsa Fundraiser',
  className,
}: CampaignHeaderProps) {
  const logo = logoUrl ?? FALLBACK_LOGO
  const alt = logoAlt ?? `${organizerName} logo`

  return (
    <header className={cn('space-y-5', className)}>
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
          <Image src={logo} alt={alt} fill sizes="48px" className="object-cover" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </span>
      </div>

      <div className="space-y-3">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          {title}
        </h1>
        {tagline && (
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {tagline}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Organized by{' '}
          <span className="font-semibold text-foreground">{organizerName}</span>
        </span>
        {verified && <VerifiedBadge />}
      </div>
    </header>
  )
}
