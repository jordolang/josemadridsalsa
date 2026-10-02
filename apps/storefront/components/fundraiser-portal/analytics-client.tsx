'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function AnalyticsClient({ fundraiserId }: { fundraiserId: string }) {
  const [analytics, setAnalytics] = useState({
    googleMeasurementId: '',
    googleMyBusinessId: '',
    seoKeywords: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/fundraisers/${fundraiserId}/analytics`)
        if (res.ok) {
          const data = await res.json()
          setAnalytics({
            googleMeasurementId: data.googleMeasurementId || '',
            googleMyBusinessId: data.googleMyBusinessId || '',
            seoKeywords: data.seoKeywords ? data.seoKeywords.join(', ') : '',
          })
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAnalytics()
  }, [fundraiserId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)
    
    // Convert comma separated string to array for API
    const payload = {
      googleMeasurementId: analytics.googleMeasurementId,
      googleMyBusinessId: analytics.googleMyBusinessId,
      seoKeywords: analytics.seoKeywords.split(',').map(k => k.trim()).filter(Boolean),
    }

    try {
      const res = await fetch(`/api/fundraisers/${fundraiserId}/analytics`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Analytics settings saved successfully.' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save analytics settings.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving. Please try again.' })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setAnalytics((prev) => ({ ...prev, [name]: value }))
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading analytics settings...</div>
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-2 font-serif text-2xl font-bold text-gray-900">
        Analytics & SEO
      </h1>
      <p className="mb-6 text-gray-600">
        Integrate Google Analytics to track page views, interactions, and business stats.
      </p>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
        
        {/* Google Integrations */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Google Integrations</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="googleMeasurementId">Google Analytics Measurement ID (GA4)</Label>
              <Input
                id="googleMeasurementId"
                name="googleMeasurementId"
                value={analytics.googleMeasurementId}
                onChange={handleChange}
                placeholder="G-XXXXXXXXXX"
                className="font-mono text-sm max-w-sm"
              />
              <p className="text-xs text-gray-500">Loads Google Analytics on your public fundraiser page only.</p>
            </div>
            
            <div className="space-y-2 mt-4">
              <Label htmlFor="googleMyBusinessId">Google Business Place ID</Label>
              <Input
                id="googleMyBusinessId"
                name="googleMyBusinessId"
                value={analytics.googleMyBusinessId}
                onChange={handleChange}
                placeholder="ChIJ..."
                className="font-mono text-sm max-w-sm"
              />
              <p className="text-xs text-gray-500">Your Google Business Profile&apos;s Place ID (starts with ChIJ). Adds a &quot;Find us on Google&quot; link to your page.</p>
            </div>
          </div>
        </div>

        {/* SEO */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Search Engine Optimization</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seoKeywords">SEO Keywords</Label>
              <Textarea
                id="seoKeywords"
                name="seoKeywords"
                value={analytics.seoKeywords}
                onChange={handleChange}
                rows={3}
                placeholder="fundraising, salsa, charity, local community..."
              />
              <p className="text-xs text-gray-500">Comma-separated, up to 20. Added to your public page&apos;s keywords tag, which some search engines read (Google ignores it; your page title and mission statement matter more).</p>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-salsa-500 hover:bg-salsa-600 font-semibold"
          >
            {isSaving ? 'Saving...' : 'Save Analytics'}
          </Button>
          {message && (
            <span className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
