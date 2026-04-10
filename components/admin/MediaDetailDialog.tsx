'use client'

import type { Media } from '@prisma/client'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, ExternalLink } from 'lucide-react'

interface MediaDetailDialogProps {
  media: Media
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function MediaDetailDialog({
  media,
  open,
  onOpenChange,
}: MediaDetailDialogProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(media.url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{media.filename}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Image Preview */}
          <div className="rounded-lg bg-muted p-4">
            {media.mimeType.startsWith('image/') ? (
              <div className="relative w-full" style={{ aspectRatio: media.width && media.height ? `${media.width}/${media.height}` : '1' }}>
                <Image
                  src={media.url}
                  alt={media.alt || media.filename}
                  fill
                  className="rounded object-contain"
                  sizes="(max-width: 768px) 100vw, 600px"
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <span className="text-6xl">📄</span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Filename</h3>
              <p className="mt-1">{media.filename}</p>
            </div>

            {media.alt && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Alt Text</h3>
                <p className="mt-1">{media.alt}</p>
              </div>
            )}

            {media.caption && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Caption</h3>
                <p className="mt-1">{media.caption}</p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground">File Type</h3>
              <p className="mt-1">{media.mimeType}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground">File Size</h3>
              <p className="mt-1">{formatFileSize(media.fileSize)}</p>
            </div>

            {media.width && media.height && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Dimensions</h3>
                <p className="mt-1">
                  {media.width} × {media.height} px
                </p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground">URL</h3>
              <div className="mt-1 flex gap-2">
                <Input
                  type="text"
                  value={media.url}
                  readOnly
                  className="flex-1 text-sm"
                />
                <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={media.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Uploaded</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(media.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
