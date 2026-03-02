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

      {/* Thumbnail Navigation */}
      {galleryImages.length > 1 && (
        <div className="grid grid-cols-4 gap-4">
          {galleryImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImageIndex(index)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md bg-muted transition-all duration-200",
                "hover:ring-2 hover:ring-salsa-500 hover:ring-offset-2",
                "focus:outline-none focus:ring-2 focus:ring-salsa-500 focus:ring-offset-2",
                selectedImageIndex === index
                  ? "ring-2 ring-salsa-500 ring-offset-2 opacity-100"
                  : "opacity-60 hover:opacity-100"
              )}
              aria-label={`View image ${index + 1} of ${galleryImages.length}`}
              aria-pressed={selectedImageIndex === index}
            >
              <Image
                src={image}
                alt={`${productName} - Image ${index + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 25vw, 100px"
                onError={() => setImageError(true)}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
