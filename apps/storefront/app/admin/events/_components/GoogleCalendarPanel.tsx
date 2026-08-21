'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowDownUp,
  CalendarCheck,
  Link2Off,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ConflictPolicy = 'LOCAL_WINS' | 'GOOGLE_WINS' | 'ASK'

interface GoogleStatus {
  oauthConfigured: boolean
  defaultCalendarId: string | null
  connected: boolean
  calendarId: string | null
  googleEmail: string | null
  conflictPolicy: ConflictPolicy
  lastPullAt: string | null
  lastPushAt: string | null
  lastPullCount: number
  lastPushCount: number
  connectionError: string | null
  conflicts: number
}

export interface ConflictedEvent {
  id: string
  title: string
  googleSyncState?: string | null
  googleSyncError?: string | null
}

const POLICY_LABELS: Record<ConflictPolicy, string> = {
  ASK: 'Ask me each time',
  LOCAL_WINS: 'The website wins',
  GOOGLE_WINS: 'Google Calendar wins',
}

const stamp = (value: string | null) =>
  value ? format(new Date(value), 'MMM d, h:mm a') : 'never'

export default function GoogleCalendarPanel({
  events,
  onRefresh,
}: {
  events: ConflictedEvent[]
  onRefresh: () => void
}) {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | 'policy' | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/events/google/status')
      if (response.ok) {
        const body = await response.json()
        setStatus(body.data ?? body)
      }
    } catch (error) {
      console.error('Failed to read Google Calendar status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // The OAuth callback is a browser redirect, so its outcome arrives in the URL.
  // Read from `window` rather than `useSearchParams`: this is a client-only
  // concern, and the hook forces a prerender bailout on the whole page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const outcome = params.get('googleCalendar')
    if (!outcome) return

    if (outcome === 'connected') toast.success('Google Calendar connected')
    else toast.error(params.get('message') || 'Could not connect Google Calendar')

    window.history.replaceState(null, '', '/admin/events')
  }, [])

  async function handleConnect() {
    setBusy('connect')
    try {
      const response = await fetch('/api/admin/events/google/connect')
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.url) {
        toast.error(body?.error || 'Could not start the connection')
        return
      }
      window.location.href = body.url
    } catch (error) {
      console.error('Failed to start Google connection:', error)
      toast.error('Could not start the connection')
    } finally {
      setBusy(null)
    }
  }

  async function handleSync() {
    setBusy('sync')
    try {
      const response = await fetch('/api/admin/events/google/sync', { method: 'POST' })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(body?.error || 'Sync failed')
        return
      }

      const r = body.data ?? body
      toast.success(
        `Synced: ${r.pushed} up, ${r.pulled} down` +
          (r.deleted ? `, ${r.deleted} removed` : '') +
          (r.conflicts ? `, ${r.conflicts} need a decision` : '')
      )
      if (r.failed > 0) toast.error(`${r.failed} event(s) failed: ${r.errors?.[0] ?? ''}`)

      await Promise.all([loadStatus(), onRefresh()])
    } catch (error) {
      console.error('Sync failed:', error)
      toast.error('Sync failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        'Disconnect Google Calendar? Events already on the calendar stay there, and reconnecting the same calendar picks up where this left off.'
      )
    ) {
      return
    }

    setBusy('disconnect')
    try {
      const response = await fetch('/api/admin/events/google/disconnect', { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        toast.error(body?.error || 'Could not disconnect')
        return
      }
      toast.success('Google Calendar disconnected')
      await loadStatus()
    } catch (error) {
      console.error('Failed to disconnect:', error)
      toast.error('Could not disconnect')
    } finally {
      setBusy(null)
    }
  }

  async function handlePolicyChange(conflictPolicy: ConflictPolicy) {
    setBusy('policy')
    try {
      const response = await fetch('/api/admin/events/google/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflictPolicy }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        toast.error(body?.error || 'Could not save the setting')
        return
      }
      setStatus((s) => (s ? { ...s, conflictPolicy } : s))
      toast.success(`Conflicts: ${POLICY_LABELS[conflictPolicy].toLowerCase()}`)
    } catch (error) {
      console.error('Failed to save policy:', error)
      toast.error('Could not save the setting')
    } finally {
      setBusy(null)
    }
  }

  async function resolveConflict(eventId: string, keep: 'local' | 'google') {
    setResolvingId(eventId)
    try {
      const response = await fetch('/api/admin/events/google/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, keep }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(body?.error || 'Could not resolve the conflict')
        return
      }
      toast.success(keep === 'local' ? 'Kept the website copy' : 'Kept the Google copy')
      await Promise.all([loadStatus(), onRefresh()])
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      toast.error('Could not resolve the conflict')
    } finally {
      setResolvingId(null)
    }
  }

  const conflicted = events.filter((e) => e.googleSyncState === 'CONFLICT')
  const failed = events.filter((e) => e.googleSyncState === 'PUSH_FAILED')

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Checking Google Calendar…</p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="mb-1 text-xl font-semibold">Google Calendar</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Two-way sync for &ldquo;Where is Jose?&rdquo; events. Shows flagged here are
            published to the calendar the storefront reads; shows added on the calendar come
            back here.
          </p>

          {status?.connected ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">
                <CalendarCheck className="mr-1 h-3 w-3" />
                Connected{status.googleEmail ? ` as ${status.googleEmail}` : ''}
              </Badge>
              <span className="text-xs text-muted-foreground">{status.calendarId}</span>
            </div>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
              Not connected
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {status?.connected ? (
            <>
              <Button variant="outline" onClick={handleSync} disabled={busy !== null}>
                {busy === 'sync' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync now
              </Button>
              <Button variant="ghost" onClick={handleDisconnect} disabled={busy !== null}>
                <Link2Off className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={busy !== null || !status?.oauthConfigured || !status?.defaultCalendarId}
            >
              {busy === 'connect' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownUp className="mr-2 h-4 w-4" />
              )}
              Connect
            </Button>
          )}
        </div>
      </div>

      {!status?.oauthConfigured && (
        <p className="mt-4 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          No Google OAuth client is configured. Set{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_CLIENT_ID</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_CLIENT_SECRET</code>, and
          enable the Google Calendar API for that project.
        </p>
      )}

      {status?.oauthConfigured && !status?.defaultCalendarId && !status?.connected && (
        <p className="mt-4 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          Set <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_CALENDAR_ID</code> to
          the calendar that should be synced.
        </p>
      )}

      {status?.connectionError && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {status.connectionError}
        </p>
      )}

      {status?.connected && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">
            Last run {stamp(status.lastPullAt)} · {status.lastPushCount} up,{' '}
            {status.lastPullCount} down
          </span>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">When both sides changed:</span>
            <Select
              value={status.conflictPolicy}
              disabled={busy !== null}
              onValueChange={(v: ConflictPolicy) => handlePolicyChange(v)}
            >
              <SelectTrigger className="w-[13rem]" aria-label="Conflict policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(POLICY_LABELS) as ConflictPolicy[]).map((policy) => (
                  <SelectItem key={policy} value={policy}>
                    {POLICY_LABELS[policy]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      )}

      {conflicted.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-400/60 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/40">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            {conflicted.length} event{conflicted.length === 1 ? '' : 's'} changed in both places
          </p>
          <ul className="space-y-2">
            {conflicted.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background p-2"
              >
                <span className="text-sm font-medium">{event.title}</span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolvingId !== null}
                    onClick={() => resolveConflict(event.id, 'local')}
                  >
                    Keep this site&rsquo;s
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolvingId !== null}
                    onClick={() => resolveConflict(event.id, 'google')}
                  >
                    Keep Google&rsquo;s
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="mb-2 text-sm font-medium text-destructive">
            {failed.length} event{failed.length === 1 ? '' : 's'} could not be written to Google
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {failed.map((event) => (
              <li key={event.id}>
                <span className="font-medium text-foreground">{event.title}</span>
                {event.googleSyncError ? ` — ${event.googleSyncError}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
