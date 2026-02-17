'use client'

import { useState } from 'react'
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

export default function ImageUploaderWrapper({
  productId,
  initialImages,
}: ImageUploaderWrapperProps) {
  const router = useRouter()
  const [images, setImages] = useState<ImageFile[]>(
    initialImages.map((url) => ({ url, alt: null }))
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleImagesChange = async (newImages: ImageFile[]) => {
    setImages(newImages)

    // Auto-save images to database
    setIsSaving(true)
    try {
      const imageUrls = newImages.map((img) => img.url)

      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imageUrls }),
      })

      if (!response.ok) {
        throw new Error('Failed to update images')
      }

      router.refresh()
    } catch (error) {
      console.error('Error saving images:', error)
      // TODO: Show error toast
    } finally {
      setIsSaving(false)
    }
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
