'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ImageIcon, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface MediaItem {
  id: string
  url: string
  filename: string
  alt: string | null
  mimeType: string
}

interface MediaPickerProps {
  value: string
  onChange: (url: string) => void
  label?: string
}

/**
 * Image field backed by the existing Media Library. Editors either pick an
 * uploaded asset or paste a URL, so the CMS never needs its own asset store.
 */
export function MediaPicker({ value, onChange, label }: MediaPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (term: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '48' })
      if (term) params.set('search', term)
      const response = await fetch(`/api/admin/media?${params}`)
      if (!response.ok) throw new Error('Could not load the media library')
      const data = await response.json()
      setItems(
        (data.media ?? []).filter((item: MediaItem) => item.mimeType?.startsWith('image/'))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the media library')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => load(search), 250)
    return () => clearTimeout(timer)
  }, [open, search, load])

  return (
    <div className="space-y-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
          {value ? (
            <Image src={value} alt="" fill sizes="80px" className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Choose from the library or paste an image URL"
          />
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Browse library
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Media library</DialogTitle>
                </DialogHeader>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by filename, alt text or caption"
                    className="pl-9"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="grid max-h-[26rem] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
                  {loading && <p className="col-span-full text-sm text-muted-foreground">Loading…</p>}
                  {!loading && items.length === 0 && (
                    <p className="col-span-full text-sm text-muted-foreground">
                      No images found. Upload some in the Media Library first.
                    </p>
                  )}
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onChange(item.url)
                        setOpen(false)
                      }}
                      className="group relative aspect-square overflow-hidden rounded-md border transition hover:ring-2 hover:ring-primary"
                    >
                      <Image
                        src={item.url}
                        alt={item.alt ?? item.filename}
                        fill
                        sizes="150px"
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
