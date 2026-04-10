'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Image, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function FetchPhotosButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [force, setForce] = useState(false)

  const run = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/locations/fetch-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')

      setResult(
        `✓ Updated ${data.updated} locations with photos. ${data.missingCount} locations still need photos.`
      )

      // Refresh the page to show updated data
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (e: any) {
      setResult(`✗ Error: ${e?.message || 'Failed to fetch photos'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="rounded"
          />
          Force re-fetch all
        </label>
        <Button onClick={run} disabled={loading} variant="outline" size="sm">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching Photos...
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              Fetch Photos from Google
            </>
          )}
        </Button>
      </div>
      {result && (
        <p className={`text-sm ${result.startsWith('✓') ? 'text-green-600' : 'text-destructive'}`}>
          {result}
        </p>
      )}
    </div>
  )
}


