'use client'

import { useEffect, useRef, useState } from 'react'
import { Facebook, Twitter, Building2, Loader2, Share2, ExternalLink, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Platform = 'FACEBOOK' | 'TWITTER' | 'GOOGLE_MY_BUSINESS'

interface SocialAccount {
  id: string
  platform: Platform
  accountName: string
  accountHandle: string | null
  profileImageUrl: string | null
}

interface PublishStatus {
  accountId: string
  accountName: string
  platform: Platform
  status: string
  externalUrl: string | null
  error: string | null
}

const PLATFORM_META: Record<Platform, { label: string; Icon: typeof Facebook }> = {
  FACEBOOK: { label: 'Facebook', Icon: Facebook },
  TWITTER: { label: 'X (Twitter)', Icon: Twitter },
  GOOGLE_MY_BUSINESS: { label: 'Google Business', Icon: Building2 },
}

interface SocialCrosspostPanelProps {
  selected: string[]
  onChange: (ids: string[]) => void
  mode: 'create' | 'edit'
  postSlug?: string
  postStatus: string
  dirty?: boolean
  refreshKey?: number
}

export function SocialCrosspostPanel({
  selected,
  onChange,
  mode,
  postSlug,
  postStatus,
  dirty = false,
  refreshKey = 0,
}: SocialCrosspostPanelProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [posting, setPosting] = useState(false)
  const [status, setStatus] = useState<PublishStatus[]>([])
  const defaultsApplied = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/heat-index/social-accounts')
        if (!res.ok) throw new Error('Failed to load accounts')
        const data = await res.json()
        if (cancelled) return
        const list: SocialAccount[] = data.accounts ?? []
        setAccounts(list)
        setLoadError(false)
        // Pre-select the connected Facebook page(s) once, as the default channel.
        if (!defaultsApplied.current && selected.length === 0) {
          defaultsApplied.current = true
          const fb = list.filter((a) => a.platform === 'FACEBOOK').map((a) => a.id)
          if (fb.length > 0) onChange(fb)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !postSlug) return
    let cancelled = false
    fetch(`/api/heat-index/posts/${postSlug}/crosspost`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setStatus(data.publishes ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mode, postSlug, refreshKey])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  async function crosspostNow() {
    if (!postSlug || selected.length === 0) return
    setPosting(true)
    try {
      const res = await fetch(`/api/heat-index/posts/${postSlug}/crosspost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Cross-post failed')
      if (data.allSucceeded === false) {
        toast.warning(data.message ?? 'Cross-posted with issues')
      } else {
        toast.success(data.message ?? 'Cross-posted')
      }
      // Refresh status.
      const s = await fetch(`/api/heat-index/posts/${postSlug}/crosspost`)
      if (s.ok) {
        const sd = await s.json()
        setStatus(sd.publishes ?? [])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cross-post failed')
    } finally {
      setPosting(false)
    }
  }

  const statusByAccount = new Map(status.map((s) => [s.accountId, s]))

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" />
          Cross-post to social
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Publishes the full article to the channels you check when the post goes live.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading channels…
        </div>
      ) : loadError ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load connected channels. Reload the page to try again.
        </p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No connected channels.{' '}
          <a href="/admin/social" className="text-salsa-600 hover:underline" target="_blank" rel="noreferrer">
            Connect an account
          </a>{' '}
          to enable cross-posting.
        </p>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const meta = PLATFORM_META[account.platform]
            const Icon = meta.Icon
            const posted = statusByAccount.get(account.id)
            return (
              <label
                key={account.id}
                className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2 cursor-pointer hover:border-foreground/30 transition"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-salsa-600"
                  checked={selected.includes(account.id)}
                  onChange={() => toggle(account.id)}
                />
                <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{account.accountName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {meta.label}
                    {account.accountHandle ? ` · ${account.accountHandle}` : ''}
                  </span>
                  {posted && (
                    <span
                      className={`mt-1 inline-flex items-center gap-1 text-xs ${
                        posted.status === 'PUBLISHED'
                          ? 'text-green-600 dark:text-green-500'
                          : posted.status === 'FAILED'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {posted.status === 'PUBLISHED' ? (
                        <>
                          <Check className="w-3 h-3" /> Posted
                          {posted.externalUrl && (
                            <a
                              href={posted.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 hover:underline"
                            >
                              view <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </>
                      ) : posted.status === 'FAILED' ? (
                        <>
                          <X className="w-3 h-3" /> Failed{posted.error ? `: ${posted.error}` : ''}
                        </>
                      ) : (
                        <>{posted.status}</>
                      )}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {mode === 'edit' && accounts.length > 0 && (
        <div className="pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={crosspostNow}
            disabled={posting || selected.length === 0 || dirty}
          >
            {posting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Cross-post now
          </Button>
          {dirty ? (
            <p className="text-xs text-muted-foreground mt-1.5">
              Save your changes first — cross-posting uses the saved article, so unsaved edits
              wouldn&apos;t be included.
            </p>
          ) : (
            postStatus !== 'PUBLISHED' && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Tip: posting works before publishing, but the article link won&apos;t be live until the
                post is published.
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}
