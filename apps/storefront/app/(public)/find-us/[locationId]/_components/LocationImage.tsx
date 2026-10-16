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
 * Falls back to the placeholder if the image fails to load.
 */
export function LocationImage({ src, alt, fill, className, priority, sizes }: LocationImageProps) {
  const [srcFailed, setSrcFailed] = useState(false)

  return (
    <Image
      src={srcFailed ? getFallbackImage() : src}
      alt={alt}
      fill={fill}
      className={className}
      priority={priority}
      sizes={sizes}
      onError={() => setSrcFailed(true)}
    />
  )
}
