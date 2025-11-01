'use client'

import { useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MediaUploadDialogProps {
  children?: ReactNode
}

export default function MediaUploadDialog({ children }: MediaUploadDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [filename, setFilename] = useState('')
  const [alt, setAlt] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUploading(true)

    try {
      const response = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          filename: filename || url.split('/').pop() || 'untitled',
          alt,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add media')
      }

      setOpen(false)
      setUrl('')
      setFilename('')
      setAlt('')
      router.refresh()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Media
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Media</DialogTitle>
            <DialogDescription>
              Add media by URL. File upload coming soon!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">
                Image URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filename">Filename</Label>
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Will use URL filename if empty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alt">Alt Text</Label>
              <Input
                id="alt"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Describe the image"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading || !url}>
              {isUploading ? 'Adding...' : 'Add Media'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
