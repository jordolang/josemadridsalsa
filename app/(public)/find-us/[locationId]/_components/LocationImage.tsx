'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getFallbackImage, getLocationImageUrl } from '@/lib/utils/image'

type LocationImageProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
  priority?: boolean
  sizes?: string
  /** Optional Place ID to try fetching fresh photos when the primary src fails */
  fallbackPlaceId?: string | null
}

/**
 * Image component with error handling for location images.
 * Falls back to Place ID fresh photo on error, then to placeholder.
 * Disables Next.js optimization for proxied images.
 */
export function LocationImage({ src, alt, fill, className, priority, sizes, fallbackPlaceId }: LocationImageProps) {
  const [srcFailed, setSrcFailed] = useState(false)
  const [placeIdFailed, setPlaceIdFailed] = useState(false)

  let imageSrc: string
  if (!srcFailed) {
    imageSrc = src
  } else if (fallbackPlaceId && !placeIdFailed && !src.includes('placeId=')) {
    // Primary src failed — try Place ID for a fresh photo
    imageSrc = getLocationImageUrl(null, fallbackPlaceId)
  } else {
    imageSrc = getFallbackImage()
  }

  const isProxied = imageSrc.startsWith('/api/image-proxy')

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill={fill}
      className={className}
      priority={priority}
      sizes={sizes}
      onError={() => {
        if (!srcFailed) {
          setSrcFailed(true)
        } else {
          setPlaceIdFailed(true)
        }
      }}
      unoptimized={isProxied}
    />
  )
}
