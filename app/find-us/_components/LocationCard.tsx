'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, ExternalLink, Navigation2 } from 'lucide-react'
import type { RetailLocationRecord } from '@/lib/locations/shared'
import { cn } from '@/lib/utils'

type LocationCardProps = {
  location: RetailLocationRecord
  isSelected?: boolean
  onSelect?: () => void
}

const sanitizePhone = (value?: string | null) => value?.replace(/[^0-9+]/g, '') ?? ''

const formatWebsiteLabel = (url?: string | null) => {
  if (!url) return ''
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function LocationCard({ location, isSelected = false, onSelect }: LocationCardProps) {
  const { businessName, address, city, state, zipCode, phone, website, distanceMiles, photoUrl, directionsUrl } = location
  const [imageError, setImageError] = useState(false)

  const primaryImage = useMemo(() => {
    const gallery = location.photoGallery ?? []
    const hero = gallery[0] ?? photoUrl

    // If no image or error occurred, use placeholder
    if (!hero || imageError) {
      return '/images/Hero-Image-5.png'
    }

    // Proxy Google Places images through our API to add authentication
    if (hero.startsWith('https://places.googleapis.com/')) {
      return `/api/image-proxy?url=${encodeURIComponent(hero)}`
    }

    return hero
  }, [location.photoGallery, photoUrl, imageError])

  const fullAddress = `${address}, ${city}, ${state}${zipCode ? ` ${zipCode}` : ''}`

  return (
    <Link
      href={`/find-us/${location.id}`}
      className={cn(
        'card group interactive-card block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-salsa-200 transition',
        isSelected ? 'ring-2 ring-salsa-500 shadow-lg' : 'ring-1 ring-transparent',
      )}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      <div className="relative aspect-[4/3] w-full bg-gray-100 dark:bg-gray-800 overflow-hidden rounded-t-xl">
        <Image
          src={primaryImage}
          alt={`${businessName} storefront`}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onError={() => setImageError(true)}
          unoptimized={primaryImage.startsWith('/api/image-proxy')}
        />
      </div>

      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">Retail partner</p>
          <h3 className="text-base font-semibold text-salsa-700 dark:text-salsa-300 line-clamp-2 min-h-[2.5rem]">
            {businessName}
          </h3>
          {typeof distanceMiles === 'number' ? (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              <Navigation2 className="h-3.5 w-3.5 text-chile-600" />
              {distanceMiles.toFixed(1)} miles away
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-verde-600" />
          <div>
            <p className="font-medium text-slate-800">{fullAddress}</p>
            {directionsUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="text-xs text-salsa-600 underline underline-offset-2"
              >
                View directions
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-2 space-y-2 text-xs text-slate-600">
          {phone ? (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-verde-600" />
              <span>{phone}</span>
            </div>
          ) : null}
          {website ? (
            <div className="flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5 text-salsa-600" />
              <span className="truncate">{formatWebsiteLabel(website)}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {phone ? (
            <a
              href={`tel:${sanitizePhone(phone)}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-verde-600 to-verde-700 px-3 py-2 text-center text-xs font-semibold text-white shadow hover:from-verde-700 hover:to-verde-800"
              onClick={(event) => event.stopPropagation()}
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
          ) : (
            <span className="rounded-md bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-400">No phone</span>
          )}

          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-center text-xs font-semibold text-white shadow hover:bg-sky-700"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Website
            </a>
          ) : (
            <span className="rounded-md bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-400">No website</span>
          )}

          {directionsUrl ? (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              onClick={(event) => event.stopPropagation()}
            >
              <Navigation2 className="h-3.5 w-3.5" />
              Directions
            </a>
          ) : (
            <span className="rounded-md bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-400">Directions</span>
          )}
        </div>
      </div>
    </Link>
  )
}
