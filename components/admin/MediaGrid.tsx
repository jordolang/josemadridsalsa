'use client'

import { useState } from 'react'
import type { Media } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import MediaItemActions from './MediaItemActions'
import MediaDetailDialog from './MediaDetailDialog'

interface MediaGridProps {
  media: (Media & {
    _count: {
      mediaTags: number
    }
  })[]
}

export default function MediaGrid({ media }: MediaGridProps) {
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getMediaType = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'Image'
    if (mimeType.startsWith('video/')) return 'Video'
    if (mimeType.startsWith('audio/')) return 'Audio'
    return 'File'
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {media.map((item) => (
          <Card
            key={item.id}
            className="group relative overflow-hidden transition-shadow hover:shadow-lg"
          >
            {/* Image/Thumbnail */}
            <div
              className="aspect-square cursor-pointer bg-slate-100"
              onClick={() => setSelectedMedia(item)}
            >
              {item.mimeType.startsWith('image/') ? (
                <img
                  src={item.url}
                  alt={item.alt || item.filename}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-4xl text-slate-300">📄</span>
                </div>
              )}
            </div>

            {/* Info Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <p className="truncate text-sm font-medium">{item.filename}</p>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span>{formatFileSize(item.fileSize)}</span>
                {item.width && item.height && (
                  <span>
                    {item.width} × {item.height}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="absolute right-2 top-2">
              <MediaItemActions media={item} />
            </div>

            {/* Tags Badge */}
            {item._count.mediaTags > 0 && (
              <div className="absolute left-2 top-2">
                <Badge variant="secondary" className="text-xs">
                  {item._count.mediaTags} {item._count.mediaTags === 1 ? 'tag' : 'tags'}
                </Badge>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Detail Dialog */}
      {selectedMedia && (
        <MediaDetailDialog
          media={selectedMedia}
          open={!!selectedMedia}
          onOpenChange={(open) => !open && setSelectedMedia(null)}
        />
      )}
    </>
  )
}
