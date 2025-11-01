"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AdminImageUploader({ onChange }: { onChange: (urls: string[]) => void }) {
  const [urls, setUrls] = useState<string[]>([])
  const [currentUrl, setCurrentUrl] = useState('')

  const handleAddUrl = () => {
    if (currentUrl) {
      const newUrls = [...urls, currentUrl]
      setUrls(newUrls)
      onChange(newUrls)
      setCurrentUrl('')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Enter image URL"
          value={currentUrl}
          onChange={(e) => setCurrentUrl(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddUrl()
            }
          }}
        />
        <Button type="button" onClick={handleAddUrl}>
          Add
        </Button>
      </div>

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((u, index) => (
            <div key={u} className="border rounded p-1 text-xs break-all flex justify-between items-start">
              <span>{u}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newUrls = urls.filter((_, i) => i !== index)
                  setUrls(newUrls)
                  onChange(newUrls)
                }}
              >
                ×
              </Button>
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
