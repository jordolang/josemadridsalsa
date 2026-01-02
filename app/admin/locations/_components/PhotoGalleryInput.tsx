'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Plus, X, Image as ImageIcon } from 'lucide-react'

interface Photo {
  url: string
  caption?: string | null
}

interface PhotoGalleryInputProps {
  photos: Photo[]
  onChange: (photos: Photo[]) => void
}

export function PhotoGalleryInput({ photos, onChange }: PhotoGalleryInputProps) {
  const [newPhotoUrl, setNewPhotoUrl] = useState('')
  const [newPhotoCaption, setNewPhotoCaption] = useState('')

  const handleAddPhoto = () => {
    if (!newPhotoUrl) return

    const newPhoto: Photo = {
      url: newPhotoUrl,
      caption: newPhotoCaption || null,
    }

    onChange([...photos, newPhoto])
    setNewPhotoUrl('')
    setNewPhotoCaption('')
  }

  const handleRemovePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index)
    onChange(updated)
  }

  const handleUpdateCaption = (index: number, caption: string) => {
    const updated = photos.map((photo, i) =>
      i === index ? { ...photo, caption: caption || null } : photo
    )
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      {/* Add New Photo */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="newPhotoUrl">Photo URL</Label>
            <Input
              id="newPhotoUrl"
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPhotoCaption">Caption (optional)</Label>
            <Input
              id="newPhotoCaption"
              value={newPhotoCaption}
              onChange={(e) => setNewPhotoCaption(e.target.value)}
              placeholder="Store front view"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddPhoto}
            disabled={!newPhotoUrl}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Photo
          </Button>
        </div>
      </Card>

      {/* Photo Gallery List */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Gallery Photos ({photos.length})
          </p>
          <div className="grid gap-3">
            {photos.map((photo, index) => (
              <Card key={index} className="p-4">
                <div className="flex gap-4">
                  {/* Photo Preview */}
                  <div className="flex-shrink-0">
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={photo.caption || `Photo ${index + 1}`}
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

                  {/* Photo Details */}
                  <div className="flex-1 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">URL</Label>
                      <p className="text-sm truncate">{photo.url}</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`caption-${index}`} className="text-xs text-slate-500">
                        Caption
                      </Label>
                      <Input
                        id={`caption-${index}`}
                        value={photo.caption || ''}
                        onChange={(e) => handleUpdateCaption(index, e.target.value)}
                        placeholder="Add a caption..."
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
                      onClick={() => handleRemovePhoto(index)}
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

      {photos.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">
            No photos added yet
          </p>
          <p className="text-xs text-slate-400">
            Add photo URLs above to build the gallery
          </p>
        </div>
      )}
    </div>
  )
}
