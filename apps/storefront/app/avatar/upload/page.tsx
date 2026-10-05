'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AvatarUploadPage() {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = inputFileRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const response = await fetch('/api/avatar/upload', { method: 'POST', body: file })
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
      if (response.status === 401) {
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent('/avatar/upload')}`
        return
      }
      if (!response.ok || !data.url) {
        setError(data.error ?? 'Upload failed')
        return
      }
      setUrl(data.url)
    } catch {
      setError('Upload failed. Check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Upload your avatar</h1>
      <p className="text-sm text-muted-foreground">JPEG, PNG or WebP, up to 4 MB.</p>

      <form onSubmit={upload} className="space-y-4">
        <input
          name="file"
          ref={inputFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="block w-full text-sm"
        />
        <Button type="submit" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {url && (
        <div className="space-y-2">
          <Image src={url} alt="Your new avatar" width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover" />
          <p className="text-sm">
            Uploaded. <Link href="/account" className="text-primary hover:underline">Back to your account</Link>
          </p>
        </div>
      )}
    </main>
  )
}
