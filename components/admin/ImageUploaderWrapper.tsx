'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from './ImageUploader'
import { Card } from '@/components/ui/card'

interface ImageFile {
  url: string
  alt?: string | null
}

interface ImageUploaderWrapperProps {
  productId: string
  initialImages: string[]
}

export function ImageUploaderWrapper({
  productId,
  initialImages,
}: ImageUploaderWrapperProps) {
  const router = useRouter()
  const [images, setImages] = useState<ImageFile[]>(
    initialImages.map((url) => ({ url, alt: null }))
  )
  const [isSaving, setIsSaving] = useState(false)
  const prevImagesRef = useRef<ImageFile[]>(images)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleImagesChange = (newImages: ImageFile[]) => {
    const prevImages = images
    setImages(newImages)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        const imagesPayload = newImages.map((img) => ({ url: img.url, alt: img.alt }))

        const response = await fetch(`/api/admin/products/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: imagesPayload }),
        })

        if (!response.ok) {
          throw new Error('Failed to update images')
        }

        prevImagesRef.current = newImages
        router.refresh()
      } catch (error) {
        console.error('Error saving images:', error)
        setImages(prevImages)
        // TODO: Show error toast
      } finally {
        setIsSaving(false)
      }
    }, 500)
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Product Images</h2>
        <p className="text-sm text-slate-600">
          Manage product images for display in the storefront
          {isSaving && <span className="ml-2 text-blue-600">Saving...</span>}
        </p>
      </div>
      <ImageUploader
        images={images}
        onChange={handleImagesChange}
        maxImages={10}
        label="Product Images"
      />
    </Card>
  )
}

export default ImageUploaderWrapper
