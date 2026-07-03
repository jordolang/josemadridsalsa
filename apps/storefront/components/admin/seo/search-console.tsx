'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, CheckCircle, Send, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Status {
  configured: boolean
  connected?: boolean
  serviceAccountEmail?: string
  property?: string | null
  sites?: Array<{ siteUrl: string; permissionLevel: string }>
  error?: string
}

interface AnalyticsRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface Analytics {
  range: { startDate: string; endDate: string }
  totals: { clicks: number; impressions: number; ctr: number; position: number }
  topQueries: AnalyticsRow[]
  topPages: AnalyticsRow[]
}

export function SearchConsolePanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [verification, setVerification] = useState('')
  const [property, setProperty] = useState('')
  const [serviceAccountJson, setServiceAccountJson] = useState('')
  const [hasCredentials, setHasCredentials] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [submittingSitemap, setSubmittingSitemap] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, configRes] = await Promise.all([
        fetch('/api/admin/seo/search-console'),
        fetch('/api/admin/seo/configuration'),
      ])
      if (statusRes.ok) {
        setStatus(await statusRes.json())
      }
      if (configRes.ok) {
        const config = await configRes.json()
        setVerification(config.googleSiteVerification || '')
        setProperty(config.gscProperty || '')
        setHasCredentials(Boolean(config.hasGscCredentials))
      }
    } catch (err) {
      console.error('Failed to fetch Search Console status:', err)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function saveSettings(clearCredentials = false) {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        googleSiteVerification: verification,
        gscProperty: property,
      }
      if (clearCredentials) {
        payload.gscServiceAccountJson = null
      } else if (serviceAccountJson.trim()) {
        payload.gscServiceAccountJson = serviceAccountJson.trim()
      }

      const response = await fetch('/api/admin/seo/configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to save settings')
        return
      }
      setServiceAccountJson('')
      setMessage('Search Console settings saved.')
      await fetchStatus()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function loadAnalytics() {
    setLoadingAnalytics(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/seo/search-console/analytics?days=28')
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to load analytics')
        return
      }
      setAnalytics(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoadingAnalytics(false)
    }
  }

  async function submitSitemap() {
    setSubmittingSitemap(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/admin/seo/search-console/sitemaps', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to submit sitemap')
        return
      }
      setMessage(`Submitted ${data.sitemapUrl} to Search Console.`)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmittingSitemap(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold">Google Search Console</h2>
          {status?.configured &&
            (status.connected ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                <CheckCircle className="mr-1 h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                <XCircle className="mr-1 h-3 w-3" /> Connection failed
              </Badge>
            ))}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Connect with a Google Cloud service account: enable the Search Console API, create a
          service account key (JSON), and add the service account email as a user on your property
          in Search Console.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gsc-verification">HTML Tag Verification Token</Label>
            <Input
              id="gsc-verification"
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
              placeholder="Content of the google-site-verification meta tag"
            />
            <p className="text-xs text-muted-foreground">
              Rendered as a &lt;meta name=&quot;google-site-verification&quot;&gt; tag on the home page.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gsc-property">Property</Label>
            <Input
              id="gsc-property"
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              placeholder="sc-domain:josemadridsalsa.com or https://www.josemadridsalsa.com/"
            />
            {status?.sites && status.sites.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Accessible properties:{' '}
                {status.sites.map((site) => (
                  <button
                    key={site.siteUrl}
                    type="button"
                    className="mr-2 text-primary hover:underline"
                    onClick={() => setProperty(site.siteUrl)}
                  >
                    {site.siteUrl}
                  </button>
                ))}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="gsc-sa">Service Account JSON</Label>
            <Textarea
              id="gsc-sa"
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              placeholder={
                hasCredentials
                  ? 'Credentials stored (encrypted). Paste new JSON to replace.'
                  : '{"type": "service_account", "client_email": "...", "private_key": "..."}'
              }
              rows={5}
              className="font-mono text-xs"
            />
            {status?.serviceAccountEmail && (
              <p className="text-xs text-muted-foreground">
                Current service account: {status.serviceAccountEmail}
              </p>
            )}
            {status?.error && <p className="text-xs text-destructive">{status.error}</p>}
          </div>
          {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => saveSettings()} disabled={saving}>
              {saving ? 'Saving…' : 'Save Search Console Settings'}
            </Button>
            {hasCredentials && (
              <Button variant="outline" onClick={() => saveSettings(true)} disabled={saving}>
                Remove Credentials
              </Button>
            )}
          </div>
        </div>
      </Card>

      {status?.connected && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Search Performance (last 28 days)
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={submitSitemap} disabled={submittingSitemap}>
                <Send className="mr-1 h-4 w-4" />
                {submittingSitemap ? 'Submitting…' : 'Submit Sitemap'}
              </Button>
              <Button onClick={loadAnalytics} disabled={loadingAnalytics}>
                {loadingAnalytics ? 'Loading…' : analytics ? 'Refresh' : 'Load Performance'}
              </Button>
            </div>
          </div>

          {analytics && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-2xl font-bold">{analytics.totals.clicks.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Clicks</p>
                </div>
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-2xl font-bold">{analytics.totals.impressions.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Impressions</p>
                </div>
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-2xl font-bold">{(analytics.totals.ctr * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">CTR</p>
                </div>
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-2xl font-bold">{analytics.totals.position.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Avg position</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {(
                  [
                    ['Top Queries', analytics.topQueries],
                    ['Top Pages', analytics.topPages],
                  ] as const
                ).map(([title, rows]) => (
                  <div key={title}>
                    <h4 className="mb-2 font-medium">{title}</h4>
                    {rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No data for this period.</p>
                    ) : (
                      <div className="divide-y divide-border rounded-lg border border-border text-sm">
                        {rows.slice(0, 10).map((row) => (
                          <div key={row.keys[0]} className="flex items-center justify-between gap-2 p-2">
                            <span className="truncate" title={row.keys[0]}>
                              {row.keys[0]}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {row.clicks} clicks · {row.impressions} impr.
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
