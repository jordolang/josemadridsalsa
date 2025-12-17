'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getFallbackImage } from '@/lib/utils/image'

type LocationImageProps = {
  src: string
  alt: string
  fill?: boolean
  className?: string
  priority?: boolean
  sizes?: string
}

/**
 * Image component with error handling for location images.
 * Automatically falls back to placeholder on error and disables optimization for proxied images.
 */
export function LocationImage({ src, alt, fill, className, priority, sizes }: LocationImageProps) {
  const [imageError, setImageError] = useState(false)
  const imageSrc = imageError ? getFallbackImage() : src
  const isProxied = imageSrc.startsWith('/api/image-proxy')

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill={fill}
      className={className}
      priority={priority}
      sizes={sizes}
      onError={() => setImageError(true)}
      unoptimized={isProxied}
    />
  )
}
