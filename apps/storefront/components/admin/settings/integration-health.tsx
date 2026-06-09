'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  RefreshCw,
  Loader2,
  Zap,
  ExternalLink,
  Trash2,
  Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type HealthStatus = 'healthy' | 'failing' | 'unchecked' | 'unconfigured'

type ServiceHealth = {
  key: string
  label: string
  category: string
  configured: boolean
  status: HealthStatus
  detail: string
  checkedAt: string
}

type AyrshareStatus = {
  configured: boolean
  linkedAccounts: string[]
  error?: string
}

const STATUS_UI: Record<
  HealthStatus,
  { label: string; className: string; Icon: React.ElementType }
> = {
  healthy: {
    label: 'Working',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  failing: {
    label: 'Not working',
    className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
    Icon: XCircle,
  },
  unchecked: {
    label: 'Configured · not verified',
    className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  unconfigured: {
    label: 'Not configured',
    className: 'border-border bg-muted text-muted-foreground',
    Icon: MinusCircle,
  },
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const ui = STATUS_UI[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ui.className}`}
    >
      <ui.Icon className="h-3 w-3" />
      {ui.label}
    </span>
  )
}

// Compact Ayrshare key entry so social media can be configured to the new
// service from the Integrations panel too (mirrors Admin → Social → Easy mode).
function AyrshareConfig({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<AyrshareStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/social/ayrshare')
      if (res.ok) {
        setStatus(await res.json())
      } else {
        setStatus({ configured: false, linkedAccounts: [], error: 'You lack permission to manage social keys.' })
      }
    } catch {
      setStatus({ configured: false, linkedAccounts: [] })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setError(null)
    if (!apiKey.trim()) {
      setError('Paste your Ayrshare API key.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/social/ayrshare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save key.')
      } else {
        setApiKey('')
        setStatus(data)
        onChanged()
      }
    } catch {
      setError('Failed to save key.')
    }
    setBusy(false)
  }

  const remove = async () => {
    if (!confirm('Remove the Ayrshare key? Easy-mode posting will stop until you add it again.')) return
    setBusy(true)
    try {
      await fetch('/api/social/ayrshare', { method: 'DELETE' })
      await load()
      onChanged()
    } catch {
      setError('Failed to remove key.')
    }
    setBusy(false)
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Social media — Ayrshare (easy mode)</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        One free key connects Facebook, Instagram, X, TikTok &amp; Google Business — no per-platform
        developer apps. The same key also powers Admin → Social.
      </p>

      {status?.configured ? (
        <div className="mt-3 space-y-2">
          {status.error ? (
            <p className="text-sm text-destructive">{status.error}</p>
          ) : status.linkedAccounts.length > 0 ? (
            <p className="text-sm text-foreground">
              Linked &amp; ready: <span className="font-medium">{status.linkedAccounts.join(', ')}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Key saved — now link your accounts on Ayrshare (one click each).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="https://app.ayrshare.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3 w-3" /> Manage accounts
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={remove} disabled={busy} className="text-destructive">
              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
              Remove key
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Label className="text-xs">Ayrshare API key</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste API key"
              className="h-9 text-sm"
              autoComplete="off"
            />
            <Button size="sm" className="h-9" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-2 h-3 w-3" />}
              Save
            </Button>
          </div>
          {status?.error && <p className="text-xs text-muted-foreground">{status.error}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <a
            href="https://www.ayrshare.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline"
          >
            Create a free Ayrshare account <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  )
}

export function IntegrationHealth() {
  const [services, setServices] = useState<ServiceHealth[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/integrations/health')
      if (!res.ok) {
        setError(res.status === 401 ? 'You do not have permission to view integration health.' : 'Failed to load status.')
        setServices(null)
      } else {
        const data = await res.json()
        setServices(data.services)
        setCheckedAt(new Date().toLocaleTimeString())
      }
    } catch {
      setError('Failed to load status.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = services
    ? {
        working: services.filter((s) => s.status === 'healthy').length,
        failing: services.filter((s) => s.status === 'failing').length,
        total: services.length,
      }
    : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Service health</CardTitle>
          <CardDescription>
            Live checks — each service is actually probed, so you see what truly works, not just what
            has a key saved.
            {checkedAt && <span className="ml-1">Last checked {checkedAt}.</span>}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Re-check
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <AyrshareConfig onChanged={load} />

        {error ? (
          <p className="py-4 text-sm text-destructive">{error}</p>
        ) : loading && !services ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Running live checks…
          </p>
        ) : services && services.length > 0 ? (
          <>
            {summary && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{summary.working} working</span>
                {summary.failing > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-red-600 dark:text-red-400">{summary.failing} need attention</span>
                  </>
                )}
                {' · '}
                {summary.total} total
              </p>
            )}
            <ul className="divide-y divide-border rounded-lg border border-border">
              {services.map((s) => (
                <li key={s.key} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{s.label}</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {s.category}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">No services to check yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
