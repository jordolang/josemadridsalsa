'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, Image as ImageIcon, Film, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/errors'
import { planUpload, readUploadResponse, recompressImage } from '@/lib/images/browser-upload'

interface UploadResult {
  url: string
  isVideo: boolean
  filename: string
  mimeType: string
}

interface MediaUploaderProps {
  onUploaded: (result: UploadResult) => void
  label?: string
  accept?: string
  variant?: 'button' | 'inline'
  className?: string
}

export function MediaUploader({
  onUploaded,
  label = 'Upload',
  accept = 'image/*,video/*',
  variant = 'button',
  className = '',
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    let uploaded = 0
    try {
      for (const picked of Array.from(files)) {
        // Vercel refuses an oversized request body before the route runs, so the size and the
        // type are settled here. A file the browser can shrink is shrunk rather than refused.
        const plan = planUpload(picked)
        if (plan.action === 'reject') {
          toast.error(plan.reason)
          continue
        }

        const file = plan.action === 'recompress' ? await recompressImage(picked) : picked

        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/admin/blog/upload', {
          method: 'POST',
          body: fd,
        })
        const data = await readUploadResponse(res)
        onUploaded({
          url: data.url,
          isVideo: data.isVideo,
          filename: data.media.filename,
          mimeType: data.media.mimeType,
        })
        uploaded += 1
      }
      if (uploaded > 0) {
        toast.success(uploaded === 1 ? 'Uploaded' : `Uploaded ${uploaded} files`)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const button =
    variant === 'inline' ? (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`inline-flex items-center gap-1.5 text-sm text-salsa-700 hover:text-salsa-900 dark:text-salsa-300 dark:hover:text-salsa-100 disabled:opacity-50 ${className}`}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        {label}
      </button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={className}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-1.5" />
        )}
        {label}
      </Button>
    )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
      />
      {button}
    </>
  )
}

interface MediaPreviewProps {
  url: string
  alt?: string
  onRemove?: () => void
  isVideo?: boolean
}

export function MediaPreview({ url, alt, onRemove, isVideo }: MediaPreviewProps) {
  const looksVideo =
    isVideo ?? /\.(mp4|webm|mov)(\?|$)/i.test(url)
  return (
    <div className="relative group rounded-md overflow-hidden border border-border bg-muted aspect-video">
      {looksVideo ? (
        <video src={url} className="w-full h-full object-cover" muted />
      ) : (
        <img src={url} alt={alt ?? ''} className="w-full h-full object-cover" />
      )}
      <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
        {looksVideo ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
        {looksVideo ? 'Video' : 'Image'}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
          aria-label="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
