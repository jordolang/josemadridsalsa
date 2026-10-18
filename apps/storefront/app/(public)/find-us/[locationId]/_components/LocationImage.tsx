'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getFallbackImage } from '@/lib/utils/image'

type LocationImageProps = {
  src: string
  alt: string
  /** Alt text used when the placeholder is shown instead of a store photo */
  fallbackAlt?: string
  fill?: boolean
  className?: string
  priority?: boolean
  sizes?: string
}

/**
 * Image component with error handling for location images.
 * Falls back to the placeholder if the image fails to load.
 */
export function LocationImage({ src, alt, fallbackAlt = 'Store photo not available', fill, className, priority, sizes }: LocationImageProps) {
  const [srcFailed, setSrcFailed] = useState(false)
  const shownSrc = srcFailed ? getFallbackImage() : src

  return (
    <Image
      src={shownSrc}
      alt={shownSrc === getFallbackImage() ? fallbackAlt : alt}
      fill={fill}
      className={className}
      priority={priority}
      sizes={sizes}
      onError={() => setSrcFailed(true)}
    />
  )
}
