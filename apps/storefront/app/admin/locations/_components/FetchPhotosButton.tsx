'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
        <div className="flex items-center gap-2">
          <Checkbox
            id="force-refetch"
            checked={force}
            onCheckedChange={(checked) => setForce(checked === true)}
          />
          <Label htmlFor="force-refetch" className="font-normal text-muted-foreground">
            Force re-fetch all
          </Label>
        </div>
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
        <p className={`text-sm ${result.startsWith('✓') ? 'text-primary' : 'text-destructive'}`}>
          {result}
        </p>
      )}
    </div>
  )
}


