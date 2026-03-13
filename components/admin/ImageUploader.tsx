'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Plus, X, Image as ImageIcon } from 'lucide-react'

interface ImageFile {
  url: string
  alt?: string | null
}

interface ImageUploaderProps {
  images: ImageFile[]
  onChange: (images: ImageFile[]) => void
  maxImages?: number
  label?: string
}

export function ImageUploader({
  images,
  onChange,
  maxImages,
  label = 'Images'
}: ImageUploaderProps) {
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newImageAlt, setNewImageAlt] = useState('')

  const handleAddImage = () => {
    if (!newImageUrl) return
    if (maxImages && images.length >= maxImages) return

    const newImage: ImageFile = {
      url: newImageUrl,
      alt: newImageAlt || null,
    }

    onChange([...images, newImage])
    setNewImageUrl('')
    setNewImageAlt('')
  }

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index)
    onChange(updated)
  }

  const handleUpdateAlt = (index: number, alt: string) => {
    const updated = images.map((image, i) =>
      i === index ? { ...image, alt: alt || null } : image
    )
    onChange(updated)
  }

  const isMaxReached = maxImages ? images.length >= maxImages : false

  return (
    <div className="space-y-4">
      {/* Add New Image */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="newImageUrl">Image URL</Label>
            <Input
              id="newImageUrl"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              disabled={isMaxReached}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newImageAlt">Alt Text (optional)</Label>
            <Input
              id="newImageAlt"
              value={newImageAlt}
              onChange={(e) => setNewImageAlt(e.target.value)}
              placeholder="Description of the image"
              disabled={isMaxReached}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddImage}
            disabled={!newImageUrl || isMaxReached}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Image
          </Button>
          {isMaxReached && (
            <p className="text-xs text-slate-500">
              Maximum of {maxImages} images reached
            </p>
          )}
        </div>
      </Card>

      {/* Image List */}
      {images.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {label} ({images.length}{maxImages ? `/${maxImages}` : ''})
          </p>
          <div className="grid gap-3">
            {images.map((image, index) => (
              <Card key={index} className="p-4">
                <div className="flex gap-4">
                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    {image.url ? (
                      <img
                        src={image.url}
                        alt={image.alt || `Image ${index + 1}`}
                        className="h-20 w-20 rounded-md object-cover"
                        onError={(e) => {
                          // Fallback if image fails to load
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <div className="hidden h-20 w-20 flex items-center justify-center rounded-md bg-slate-100">
                      <ImageIcon className="h-8 w-8 text-slate-400" />
                    </div>
                  </div>

                  {/* Image Details */}
                  <div className="flex-1 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">URL</Label>
                      <p className="text-sm truncate">{image.url}</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`alt-${index}`} className="text-xs text-slate-500">
                        Alt Text
                      </Label>
                      <Input
                        id={`alt-${index}`}
                        value={image.alt || ''}
                        onChange={(e) => handleUpdateAlt(index, e.target.value)}
                        placeholder="Add alt text..."
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <div className="flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveImage(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">
            No images added yet
          </p>
          <p className="text-xs text-slate-400">
            Add image URLs above to upload
          </p>
        </div>
      )}
    </div>
  )
}
