'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination, Thumbs, A11y } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import { cn } from '@/lib/utils'

// Import Swiper styles
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/thumbs'

interface ImageGalleryProps {
  images: string[]
  productName: string
  featuredImage?: string | null
}

export function ImageGallery({ images, productName, featuredImage }: ImageGalleryProps) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null)
  const [imageError, setImageError] = useState(false)

  // Build the gallery images array
  const galleryImages = images.length > 0 ? images : featuredImage ? [featuredImage] : []

  // Use placeholder if no images available or if there's an error
  const finalImages = imageError || galleryImages.length === 0
    ? ['/images/placeholder-salsa.jpg']
    : galleryImages

  return (
    <div className="space-y-4">
      {/* Main Image Swiper */}
      <div className="relative">
        <Swiper
          modules={[Pagination, Thumbs, A11y]}
          spaceBetween={10}
          slidesPerView={1}
          pagination={{ clickable: true }}
          thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
          className="rounded-lg aspect-square"
          loop={finalImages.length > 1}
        >
          {finalImages.map((image, index) => (
            <SwiperSlide key={index}>
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
                <Image
                  src={image}
                  alt={`${productName} - Image ${index + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority={index === 0}
                  onError={() => setImageError(true)}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {/* Thumbnail Navigation */}
      {galleryImages.length > 1 && (
        <Swiper
          modules={[Thumbs]}
          onSwiper={setThumbsSwiper}
          spaceBetween={16}
          slidesPerView={4}
          watchSlidesProgress
          className="thumbs-swiper"
        >
          {galleryImages.map((image, index) => (
            <SwiperSlide key={index}>
              <div
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md bg-muted cursor-pointer transition-all duration-200",
                  "hover:ring-2 hover:ring-salsa-500 hover:ring-offset-2"
                )}
              >
                <Image
                  src={image}
                  alt={`${productName} - Thumbnail ${index + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 25vw, 100px"
                  onError={() => setImageError(true)}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  )
}
