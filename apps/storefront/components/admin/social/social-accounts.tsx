'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Facebook,
  Instagram,
  Twitter,
  Music2,
  Store,
  Trash2,
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Settings2,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  Zap,
} from 'lucide-react'
import type { SocialMediaPlatform } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type {
  SocialAccountInfo,
  PlatformConfigStatus,
  SocialCredentialProvider,
  AyrshareStatusInfo,
} from '@/types/social'

// Friendly labels for the platform ids Ayrshare reports as linked.
const AYRSHARE_PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  gmb: 'Google Business',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  threads: 'Threads',
  reddit: 'Reddit',
  telegram: 'Telegram',
}

const PLATFORM_ICONS: Record<SocialMediaPlatform, React.ElementType> = {
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  TWITTER: Twitter,
  TIKTOK: Music2,
  GOOGLE_MY_BUSINESS: Store,
}

const PLATFORM_META: Record<SocialMediaPlatform, { label: string; color: string; bgColor: string; description: string }> = {
  FACEBOOK: {
    label: 'Facebook',
    color: 'text-[#1877F2]',
    bgColor: 'bg-[#1877F2]',
    description: 'Connect your Facebook Business Page to publish posts, photos, and links directly from the dashboard.',
  },
  INSTAGRAM: {
    label: 'Instagram',
    color: 'text-[#E4405F]',
    bgColor: 'bg-[#E4405F]',
    description: 'Connect Instagram via Facebook Business Suite for photo posts, carousels, and stories.',
  },
  TWITTER: {
    label: 'X (Twitter)',
    color: 'text-black',
    bgColor: 'bg-black',
    description: 'Connect your X account to post tweets, threads, and media directly from here.',
  },
  TIKTOK: {
    label: 'TikTok',
    color: 'text-black',
    bgColor: 'bg-black',
    description: 'Connect TikTok to upload videos and manage your short-form content strategy.',
  },
  GOOGLE_MY_BUSINESS: {
    label: 'Google Business',
    color: 'text-[#4285F4]',
    bgColor: 'bg-[#4285F4]',
    description: 'Connect your Google Business Profile to post updates and keep your listing fresh.',
  },
}

// Field labels differ per provider so the form matches what each console calls them.
const CREDENTIAL_LABELS: Record<SocialCredentialProvider, { id: string; secret: string }> = {
  facebook: { id: 'App ID', secret: 'App Secret' },
  twitter: { id: 'Client ID', secret: 'Client Secret' },
  tiktok: { id: 'Client Key', secret: 'Client Secret' },
  google: { id: 'Client ID', secret: 'Client Secret' },
}

const ALL_PLATFORMS: SocialMediaPlatform[] = ['FACEBOOK', 'TWITTER', 'TIKTOK', 'INSTAGRAM', 'GOOGLE_MY_BUSINESS']

type Props = {
  accounts: SocialAccountInfo[]
  platformConfig: PlatformConfigStatus[]
  ayrshare: AyrshareStatusInfo
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 shrink-0 gap-1 px-2 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

// In-panel credential entry — the owner pastes keys here instead of editing
// env files. Saves encrypted server-side, then refreshes to flip the card to
// "Configured" with no redeploy.
function CredentialForm({
  provider,
  configured,
  onSaved,
}: {
  provider: SocialCredentialProvider
  configured: boolean
  onSaved: () => void
}) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labels = CREDENTIAL_LABELS[provider]

  const handleSave = async () => {
    setError(null)
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Enter both values.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/social/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save.')
        setSaving(false)
        return
      }
      setClientId('')
      setClientSecret('')
      setSaving(false)
      onSaved()
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <KeyRound className="h-3.5 w-3.5" />
        {configured ? 'Update keys' : 'Enter your keys here — no code or env files'}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">{labels.id}</Label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={`Paste ${labels.id}`}
            className="h-8 text-sm"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{labels.secret}</Label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={`Paste ${labels.secret}`}
            className="h-8 text-sm"
            autoComplete="off"
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="button" size="sm" className="h-8" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-2 h-3 w-3" />}
        {configured ? 'Update keys' : 'Save & enable'}
      </Button>
    </div>
  )
}

// Easy mode: connect every platform through one free Ayrshare login — no
// developer apps, no per-platform keys. This is the path that matches "one
// click, no developer settings" without a paid plan.
function AyrshareEasyMode({
  status,
  onChanged,
}: {
  status: AyrshareStatusInfo
  onChanged: () => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

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
        setBusy(false)
        return
      }
      setApiKey('')
      setBusy(false)
      onChanged()
    } catch {
      setError('Failed to save key.')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('Remove the Ayrshare key? Easy-mode posting will stop until you add it again.')) return
    setBusy(true)
    try {
      await fetch('/api/social/ayrshare', { method: 'DELETE' })
      onChanged()
    } catch {
      setError('Failed to remove key.')
    }
    setBusy(false)
  }

  return (
    <Card className="border-primary/30 bg-primary/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Easy mode — one free login, no developer apps</p>
            <p className="text-xs text-muted-foreground">
              Connect Facebook, Instagram, X, TikTok &amp; Google Business through a single free
              Ayrshare account. No API keys per platform, no developer consoles.
            </p>
          </div>
        </div>
        {status.configured ? (
          <Badge variant="outline" className="gap-1 border-primary/40 text-[10px] text-primary">
            <CheckCircle2 className="h-3 w-3" /> Active
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 border-amber-400 text-[10px] text-amber-600">
            Optional
          </Badge>
        )}
      </div>

      {status.configured ? (
        <div className="mt-4 space-y-3">
          {status.error ? (
            <p className="text-sm text-destructive">{status.error}</p>
          ) : status.linkedAccounts.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Linked &amp; ready to post:</p>
              <div className="flex flex-wrap gap-1.5">
                {status.linkedAccounts.map((p) => (
                  <Badge key={p} className="gap-1 bg-primary/10 text-xs text-primary">
                    <CheckCircle2 className="h-3 w-3" />
                    {AYRSHARE_PLATFORM_LABELS[p] ?? p}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Posts and scheduled posts now publish through Ayrshare automatically.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Key saved. Now link your social accounts on Ayrshare (one click each), then they&apos;ll
              appear here.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="https://app.ayrshare.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3 w-3" /> Link / manage accounts on Ayrshare
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={remove} disabled={busy} className="text-destructive">
              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
              Remove key
            </Button>
          </div>
        </div>
      ) : open ? (
        <div className="mt-4 space-y-3">
          <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
            <li>
              Create a free account at{' '}
              <a href="https://www.ayrshare.com" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
                ayrshare.com
              </a>{' '}
              and link your social accounts (click-connect, no developer setup).
            </li>
            <li>In the Ayrshare dashboard, copy your API key.</li>
            <li>Paste it below and save — that&apos;s the only key you&apos;ll ever enter.</li>
          </ol>
          <div className="space-y-1">
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
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Zap className="mr-2 h-4 w-4" /> Set up easy mode
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="https://www.ayrshare.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-3 w-3" /> Create free Ayrshare account
            </a>
          </Button>
        </div>
      )}
    </Card>
  )
}

function SetupGuide({ config, onSaved }: { config: PlatformConfigStatus; onSaved: () => void }) {
  // Instagram has no keys of its own — it rides on the Facebook app.
  const sharesCreds = Boolean(config.sharesCredentialsWith)

  return (
    <div className="mt-3 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
      <p className="font-medium text-amber-900 dark:text-amber-200">One-time setup</p>

      <ol className="ml-4 list-decimal space-y-1 text-amber-900/90 dark:text-amber-200/90">
        {config.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {!sharesCreds && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            Redirect URI to paste into the platform&apos;s console:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              {config.redirectUri}
            </code>
            <CopyButton value={config.redirectUri} />
          </div>
        </div>
      )}

      {config.note && (
        <p className="text-xs text-amber-800/80 dark:text-amber-200/70">Note: {config.note}</p>
      )}

      {sharesCreds ? (
        <p className="text-xs text-amber-900 dark:text-amber-200">
          Instagram uses your Facebook keys — set up Facebook above, then connect Instagram here.
        </p>
      ) : (
        <CredentialForm provider={config.provider} configured={config.configured} onSaved={onSaved} />
      )}

      <a
        href={config.devConsoleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline dark:text-amber-200"
      >
        Open developer console <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}

export function SocialAccounts({ accounts, platformConfig, ayrshare }: Props) {
  const router = useRouter()
  const [connecting, setConnecting] = useState<SocialMediaPlatform | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openGuide, setOpenGuide] = useState<SocialMediaPlatform | null>(null)
  const [localAccounts, setLocalAccounts] = useState(accounts)

  const configByPlatform = new Map(platformConfig.map((c) => [c.platform, c]))
  const configuredCount = platformConfig.filter((c) => c.configured).length

  const handleConnect = async (platform: SocialMediaPlatform) => {
    setConnecting(platform)
    setError(null)
    try {
      const res = await fetch(`/api/social/oauth/connect?platform=${platform}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setConnecting(null)
        return
      }
      // Redirect to OAuth provider
      window.location.href = data.url
    } catch {
      setError('Failed to initiate connection. Check your configuration.')
      setConnecting(null)
    }
  }

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Disconnect this account? You can reconnect anytime.')) return
    setDisconnecting(accountId)
    try {
      const res = await fetch(`/api/social/accounts?id=${accountId}`, { method: 'DELETE' })
      if (!res.ok) {
        setError('Failed to disconnect account.')
      } else {
        setLocalAccounts((prev) => prev.filter((a) => a.id !== accountId))
      }
    } catch {
      setError('Failed to disconnect account.')
    }
    setDisconnecting(null)
  }

  const connectedPlatforms = new Set(localAccounts.map((a) => a.platform))

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Easy mode (Ayrshare) — recommended free path with no developer apps */}
      <AyrshareEasyMode status={ayrshare} onChanged={() => router.refresh()} />

      {/* Honest configuration summary */}
      <Card className="border-border p-4">
        <div className="flex items-center gap-2">
          {configuredCount === platformConfig.length ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          )}
          <p className="text-sm font-medium text-foreground">
            {configuredCount} of {platformConfig.length} platforms configured
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Set each platform up once below — paste your keys right here in the panel, no code or
          server files. A platform must be configured before its &quot;Connect&quot; button works.
          Anything not set up is shown honestly as &quot;Setup required.&quot;
        </p>
      </Card>

      {/* Connected accounts */}
      {localAccounts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Connected Accounts</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {localAccounts.map((account) => {
              const Icon = PLATFORM_ICONS[account.platform]
              const meta = PLATFORM_META[account.platform]
              const isExpired = account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()

              return (
                <Card key={account.id} className="relative overflow-hidden">
                  {/* Color bar */}
                  <div className={cn('h-1.5', meta.bgColor)} />
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {account.profileImageUrl ? (
                          <img
                            src={account.profileImageUrl}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-muted', meta.color)}>
                            <Icon className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{account.accountName}</p>
                          {account.accountHandle && (
                            <p className="text-sm text-muted-foreground">{account.accountHandle}</p>
                          )}
                        </div>
                      </div>
                      <Badge className={cn('text-xs', meta.color)}>{meta.label}</Badge>
                    </div>

                    {/* Status */}
                    <div className="mt-4 space-y-2">
                      {account.connectionError ? (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          {account.connectionError}
                        </div>
                      ) : isExpired ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <AlertTriangle className="h-4 w-4" />
                          Token expired. Reconnect to continue posting.
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                          Connected and active
                        </div>
                      )}

                      {/* Scopes */}
                      <div className="flex flex-wrap gap-1">
                        {account.scopes.slice(0, 3).map((scope) => (
                          <Badge
                            key={scope}
                            variant="outline"
                            className="border-border text-[10px] text-muted-foreground"
                          >
                            <Shield className="mr-1 h-2.5 w-2.5" />
                            {scope.split('.').pop() || scope}
                          </Badge>
                        ))}
                        {account.scopes.length > 3 && (
                          <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                            +{account.scopes.length - 3} more
                          </Badge>
                        )}
                      </div>

                      {account.lastVerifiedAt && (
                        <p className="text-xs text-muted-foreground">
                          Verified {new Date(account.lastVerifiedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex gap-2 border-t border-border pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleConnect(account.platform)}
                        disabled={connecting === account.platform}
                      >
                        {connecting === account.platform ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-3 w-3" />
                        )}
                        Reconnect
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(account.id)}
                        disabled={disconnecting === account.id}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {disconnecting === account.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Available platforms to connect */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          {localAccounts.length > 0 ? 'Connect More Platforms' : 'Connect Your Social Accounts'}
        </h3>
        <p className="text-sm text-muted-foreground">
          Link your social media accounts to publish content directly from this dashboard.
          Your credentials are encrypted and stored securely.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_PLATFORMS.filter((p) => !connectedPlatforms.has(p)).map((platform) => {
            const Icon = PLATFORM_ICONS[platform]
            const meta = PLATFORM_META[platform]
            const config = configByPlatform.get(platform)
            const configured = config?.configured ?? false
            const guideOpen = openGuide === platform

            return (
              <Card
                key={platform}
                className={cn(
                  'group flex flex-col border-dashed border-input p-5 transition',
                  configured && 'hover:border-solid hover:border-muted-foreground hover:shadow-md',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('rounded-xl p-2.5', meta.color, 'bg-muted')}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {configured
                          ? config?.source === 'admin'
                            ? 'Ready to connect · keys saved'
                            : 'Ready to connect'
                          : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {configured ? (
                    <Badge variant="outline" className="gap-1 border-primary/40 text-[10px] text-primary">
                      <CheckCircle2 className="h-3 w-3" /> Configured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-amber-400 text-[10px] text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> Setup required
                    </Badge>
                  )}
                </div>

                <p className="mt-3 flex-1 text-sm text-muted-foreground">{meta.description}</p>

                {configured ? (
                  <div className="mt-4 space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => handleConnect(platform)}
                      disabled={connecting === platform}
                    >
                      {connecting === platform ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      {connecting === platform ? 'Connecting...' : `Connect ${meta.label}`}
                    </Button>
                    {!config?.sharesCredentialsWith && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                        onClick={() => setOpenGuide(guideOpen ? null : platform)}
                      >
                        {guideOpen ? 'Hide keys' : 'Update keys'}
                      </button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setOpenGuide(guideOpen ? null : platform)}
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    {guideOpen ? 'Hide setup steps' : 'Show setup steps'}
                  </Button>
                )}

                {guideOpen && config && (
                  <SetupGuide
                    config={config}
                    onSaved={() => {
                      setOpenGuide(null)
                      router.refresh()
                    }}
                  />
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
