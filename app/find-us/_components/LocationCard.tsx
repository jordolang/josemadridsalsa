'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, ExternalLink, Navigation2, Clock, Star } from 'lucide-react'
import type { RetailLocationRecord } from '@/lib/locations/shared'
import type { LocationDetails } from '@/lib/locations/details'
import { cn } from '@/lib/utils'

type LocationCardProps = {
  location: RetailLocationRecord
  isSelected?: boolean
  onSelect?: () => void
}

type DetailsState = {
  details: LocationDetails | null
  isLoading: boolean
  error: string | null
}

const temporaryDetailsCache = new Map<string, LocationDetails>()

const sanitizePhone = (value?: string | null) => value?.replace(/[^0-9+]/g, '') ?? ''

const formatWebsiteLabel = (url?: string | null) => {
  if (!url) return ''
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function LocationCard({ location, isSelected = false, onSelect }: LocationCardProps) {
  const {
    id,
    businessName,
    address,
    city,
    state,
    zipCode,
    phone,
    website,
    distanceMiles,
    photoUrl,
    reviewRating,
    reviewCount,
    reviewSummary,
    hoursSummary,
    directionsUrl,
  } = location

  const cardRef = useRef<HTMLAnchorElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [{ details, isLoading, error }, setDetailsState] = useState<DetailsState>({
    details: temporaryDetailsCache.get(id) ?? null,
    isLoading: false,
    error: null,
  })

  useEffect(() => {
    if (!cardRef.current || isVisible) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.2 },
    )
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [isVisible])

  useEffect(() => {
    if (!isVisible || !location.googlePlaceId || temporaryDetailsCache.has(id)) {
      return
    }

    let cancelled = false

    const fetchDetails = async () => {
      setDetailsState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        const response = await fetch(`/api/locations/${id}/details`, { cache: 'force-cache' })
        if (!response.ok) {
          throw new Error('Unable to load store details')
        }
        const payload = await response.json()
        const nextDetails: LocationDetails | null = payload.data ?? null
        if (!cancelled && nextDetails) {
          temporaryDetailsCache.set(id, nextDetails)
          setDetailsState({ details: nextDetails, isLoading: false, error: null })
        } else if (!cancelled) {
          setDetailsState({ details: null, isLoading: false, error: null })
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load store details'
          setDetailsState((prev) => ({ ...prev, isLoading: false, error: message }))
        }
      }
    }

    fetchDetails()

    return () => {
      cancelled = true
    }
  }, [id, isVisible, location.googlePlaceId])

  const primaryImage = useMemo(() => {
    const gallery = details?.photos?.length ? details.photos : location.photoGallery ?? []
    const hero = gallery[0] ?? photoUrl ?? '/images/store-placeholder.png'
    if (hero.startsWith('https://places.googleapis.com/')) {
      return `/api/image-proxy?url=${encodeURIComponent(hero)}`
    }
    return hero
  }, [details?.photos, location.photoGallery, photoUrl])

  const finalPhone = details?.phone ?? phone
  const finalWebsite = details?.website ?? website
  const finalReviewRating = details?.rating ?? reviewRating
  const finalReviewCount = details?.reviewCount ?? reviewCount
  const finalReviewSummary =
    details?.rating && details?.reviewCount
      ? `${details.rating.toFixed(1)} out of 5 stars · ${details.reviewCount.toLocaleString()} Google reviews`
      : reviewSummary
  const finalHours = details?.hours?.length ? details.hours : location.hours ?? []
  const finalHoursSummary = finalHours.length > 0 ? finalHours[0] : hoursSummary ?? 'Call store for the latest hours'

  const fullAddress = `${address}, ${city}, ${state}${zipCode ? ` ${zipCode}` : ''}`

  return (
    <Link
      ref={cardRef}
      href={`/find-us/${id}`}
      className={cn(
        'card group block overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-salsa-200 transition',
        isSelected ? 'ring-2 ring-salsa-500 shadow-lg' : 'ring-1 ring-transparent',
      )}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      <div className="relative aspect-[4/3] w-full bg-gray-100 dark:bg-gray-800">
        <Image
          src={primaryImage}
          alt={`${businessName} storefront`}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.02]"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
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

        {finalReviewSummary ? (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Star className="h-4 w-4 text-amber-500" />
            <p className="font-medium">
              {finalReviewRating?.toFixed(1) ?? '4.3'} • {finalReviewCount?.toLocaleString() ?? '149'} reviews
            </p>
          </div>
        ) : null}

        <div className="flex items-start gap-2 text-sm text-slate-600">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
          <div>
            <p className="font-medium text-slate-800">Hours</p>
            <p className="text-xs text-slate-500">{isLoading ? 'Checking hours…' : finalHoursSummary}</p>
          </div>
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="mt-2 space-y-2 text-xs text-slate-600">
          {finalPhone ? (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-verde-600" />
              <span>{finalPhone}</span>
            </div>
          ) : null}
          {finalWebsite ? (
            <div className="flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5 text-salsa-600" />
              <span className="truncate">{formatWebsiteLabel(finalWebsite)}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {finalPhone ? (
            <a
              href={`tel:${sanitizePhone(finalPhone)}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-verde-600 to-verde-700 px-3 py-2 text-center text-xs font-semibold text-white shadow hover:from-verde-700 hover:to-verde-800"
              onClick={(event) => event.stopPropagation()}
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
          ) : (
            <span className="rounded-md bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-400">No phone</span>
          )}

          {finalWebsite ? (
            <a
              href={finalWebsite}
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
