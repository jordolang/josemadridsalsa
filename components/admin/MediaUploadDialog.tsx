'use client'

import { useState, ReactNode, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Link, ImageIcon, X } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUploadThing } from '@/lib/uploadthing-client'

interface MediaUploadDialogProps {
  children?: ReactNode
}

export default function MediaUploadDialog({ children }: MediaUploadDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // URL tab state
  const [url, setUrl] = useState('')
  const [urlFilename, setUrlFilename] = useState('')
  const [urlAlt, setUrlAlt] = useState('')
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false)

  // File tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileAlt, setFileAlt] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { startUpload, isUploading } = useUploadThing('emailTemplateImage', {
    onClientUploadComplete: async (res) => {
      if (!res?.[0]) return
      const uploadedUrl = res[0].url
      const filename = selectedFile?.name ?? uploadedUrl.split('/').pop() ?? 'untitled'
      await saveMediaRecord(uploadedUrl, filename, fileAlt)
    },
    onUploadError: (error) => {
      alert(`Upload failed: ${error.message}`)
    },
  })

  const saveMediaRecord = async (mediaUrl: string, filename: string, alt: string) => {
    const response = await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mediaUrl, filename, alt }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Failed to save media record')
    closeAndReset()
    router.refresh()
  }

  const closeAndReset = () => {
    setOpen(false)
    setUrl('')
    setUrlFilename('')
    setUrlAlt('')
    setSelectedFile(null)
    setFileAlt('')
  }

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingUrl(true)
    try {
      await saveMediaRecord(url, urlFilename || url.split('/').pop() || 'untitled', urlAlt)
    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsSubmittingUrl(false)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return
    await startUpload([selectedFile])
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) setSelectedFile(file)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Media</DialogTitle>
          <DialogDescription>Upload an image file or add one by URL.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="file">
          <TabsList className="w-full">
            <TabsTrigger value="file" className="flex-1">
              <ImageIcon className="mr-2 h-4 w-4" />
              File Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1">
              <Link className="mr-2 h-4 w-4" />
              By URL
            </TabsTrigger>
          </TabsList>

          {/* File upload tab */}
          <TabsContent value="file" className="space-y-4 pt-2">
            <div
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop an image here or click to browse</p>
                  <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WebP up to 8MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f) }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-alt">Alt Text</Label>
              <Input
                id="file-alt"
                value={fileAlt}
                onChange={(e) => setFileAlt(e.target.value)}
                placeholder="Describe the image"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAndReset}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!selectedFile || isUploading}
                onClick={handleFileUpload}
              >
                {isUploading ? 'Uploading…' : 'Upload'}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* URL tab */}
          <TabsContent value="url">
            <form onSubmit={handleUrlSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="url">
                  Image URL <span className="text-destructive">*</span>
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
                <Label htmlFor="url-filename">Filename</Label>
                <Input
                  id="url-filename"
                  value={urlFilename}
                  onChange={(e) => setUrlFilename(e.target.value)}
                  placeholder="Will use URL filename if empty"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url-alt">Alt Text</Label>
                <Input
                  id="url-alt"
                  value={urlAlt}
                  onChange={(e) => setUrlAlt(e.target.value)}
                  placeholder="Describe the image"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeAndReset}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingUrl || !url}>
                  {isSubmittingUrl ? 'Adding…' : 'Add Media'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
