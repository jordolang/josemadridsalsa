'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function FetchPhotosButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [force, setForce] = useState(false)

  const run = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/locations/fetch-photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setResult(`Updated ${data.updated} of ${data.processed}. Missing: ${data.missingCount}.`)
    } catch (e: any) {
      setResult(e?.message || 'Error running fetch photos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        Force re-fetch
      </label>
      <Button onClick={run} disabled={loading}>{loading ? 'Fetching Photos...' : 'Fetch Photos'}</Button>
      {result && <span className="text-sm text-muted-foreground">{result}</span>}
    </div>
  )
}


