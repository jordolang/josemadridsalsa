"use client"

import { useState } from 'react'
import { UploadButton } from "@uploadthing/react"
import type { OurFileRouter } from '@/app/api/uploadthing/core'
import { Button } from '@/components/ui/button'

export function AdminImageUploader({ onChange }: { onChange: (urls: string[]) => void }) {
  const [urls, setUrls] = useState<string[]>([])

  return (
    <div className="space-y-2">
      <UploadButton<OurFileRouter>
        endpoint="productImage"
        onClientUploadComplete={(res) => {
          const newUrls = [...urls, ...res.map((r) => r.url)]
          setUrls(newUrls)
          onChange(newUrls)
        }}
        onUploadError={(error) => {
          alert(`Upload failed: ${error.message}`)
        }}
      />

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((u) => (
            <div key={u} className="border rounded p-1 text-xs break-all">
              {u}
            </div>
          ))}
        </div>
      )}
      <div>
        <Button type="button" variant="outline" onClick={() => { setUrls([]); onChange([]) }}>
          Clear Images
        </Button>
      </div>
    </div>
  )
}
