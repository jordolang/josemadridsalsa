'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface ImageGalleryProps {
  images: string[]
  productName: string
  featuredImage?: string | null
}

export function ImageGallery({ images, productName, featuredImage }: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imageError, setImageError] = useState(false)

  // Build the gallery images array
  const galleryImages = images.length > 0 ? images : featuredImage ? [featuredImage] : []

  // Use placeholder if no images available or if there's an error
  const currentImage = imageError || galleryImages.length === 0
    ? '/images/placeholder-salsa.jpg'
    : galleryImages[selectedImageIndex]

  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
        <Image
          src={currentImage}
          alt={productName}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
          onError={() => setImageError(true)}
        />
      </div>

      {/* Image count indicator (only show if multiple images) */}
      {galleryImages.length > 1 && (
        <div className="text-center text-sm text-muted-foreground">
          Image {selectedImageIndex + 1} of {galleryImages.length}
        </div>
      )}
    </div>
  )
}
