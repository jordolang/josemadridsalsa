'use client'

import { useState, useEffect } from 'react'
import { useUploadThing } from '@/lib/uploadthing-client'
import { Button } from '@/components/ui/button'

export default function FundraiserAssetsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null)
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Load current assets
  useEffect(() => {
    async function loadAssets() {
      try {
        const res = await fetch('/api/fundraiser-portal/assets')
        if (res.ok) {
          const data = await res.json()
          setLogoUrl(data.logoUrl || null)
          setCoverPhotoUrl(data.coverPhotoUrl || null)
          setGalleryUrls(data.galleryUrls || [])
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false)
      }
    }
    loadAssets()
  }, [])

  const { startUpload: uploadLogo, isUploading: isUploadingLogo } = useUploadThing('fundraiserLogo', {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        setLogoUrl(res[0].url)
        saveAssets({ logoUrl: res[0].url })
      }
    },
  })

  const { startUpload: uploadCover, isUploading: isUploadingCover } = useUploadThing('fundraiserCoverPhoto', {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        setCoverPhotoUrl(res[0].url)
        saveAssets({ coverPhotoUrl: res[0].url })
      }
    },
  })

  const { startUpload: uploadGallery, isUploading: isUploadingGallery } = useUploadThing('fundraiserGallery', {
    onClientUploadComplete: (res) => {
      if (res) {
        const newUrls = res.map((r) => r.url)
        const updated = [...galleryUrls, ...newUrls]
        setGalleryUrls(updated)
        saveAssets({ galleryUrls: updated })
      }
    },
  })

  async function saveAssets(updates: Record<string, unknown>) {
    setSaveMessage(null)
    try {
      const res = await fetch('/api/fundraiser-portal/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        setSaveMessage('Saved!')
        setTimeout(() => setSaveMessage(null), 2000)
      }
    } catch {
      setSaveMessage('Error saving.')
    }
  }

  function removeGalleryImage(index: number) {
    const updated = galleryUrls.filter((_, i) => i !== index)
    setGalleryUrls(updated)
    saveAssets({ galleryUrls: updated })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-gray-900">
          Media & Uploads
        </h1>
        {saveMessage && (
          <span className="text-sm text-verde-600">{saveMessage}</span>
        )}
      </div>

      {/* Logo */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Organization Logo</h2>
        <div className="flex items-center gap-6">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-24 w-24 rounded-full border-2 border-gray-200 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400">
              No logo
            </div>
          )}
          <div>
            <label className="cursor-pointer">
              <Button
                variant="outline"
                disabled={isUploadingLogo}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) uploadLogo([file])
                  }
                  input.click()
                }}
              >
                {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
              </Button>
            </label>
            <p className="mt-1 text-xs text-gray-500">Max 4MB. Recommended: square image.</p>
          </div>
        </div>
      </section>

      {/* Cover Photo */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Cover Photo</h2>
        {coverPhotoUrl ? (
          <div className="mb-4 aspect-[3/1] overflow-hidden rounded-lg">
            <img
              src={coverPhotoUrl}
              alt="Cover"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="mb-4 flex aspect-[3/1] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400">
            No cover photo
          </div>
        )}
        <Button
          variant="outline"
          disabled={isUploadingCover}
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) uploadCover([file])
            }
            input.click()
          }}
        >
          {isUploadingCover ? 'Uploading...' : 'Upload Cover Photo'}
        </Button>
        <p className="mt-1 text-xs text-gray-500">Max 8MB. Recommended: 1200x400px or wider.</p>
      </section>

      {/* Gallery */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Photo Gallery</h2>
        {galleryUrls.length > 0 ? (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {galleryUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg">
                <img
                  src={url}
                  alt={`Gallery ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => removeGalleryImage(index)}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100"
                  title="Remove"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-gray-500">No gallery images yet.</p>
        )}
        <Button
          variant="outline"
          disabled={isUploadingGallery}
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.multiple = true
            input.onchange = (e) => {
              const files = Array.from((e.target as HTMLInputElement).files || [])
              if (files.length > 0) uploadGallery(files)
            }
            input.click()
          }}
        >
          {isUploadingGallery ? 'Uploading...' : 'Add Photos'}
        </Button>
        <p className="mt-1 text-xs text-gray-500">Max 8MB per image. Up to 10 at a time.</p>
      </section>
    </div>
  )
}
