'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import type { SocialMediaPlatform } from '@prisma/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { SocialAccountInfo, PlatformConfigStatus } from '@/types/social'

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

const ALL_PLATFORMS: SocialMediaPlatform[] = ['FACEBOOK', 'TWITTER', 'TIKTOK', 'INSTAGRAM', 'GOOGLE_MY_BUSINESS']

type Props = {
  accounts: SocialAccountInfo[]
  platformConfig: PlatformConfigStatus[]
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

function SetupGuide({ config }: { config: PlatformConfigStatus }) {
  return (
    <div className="mt-3 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
      <p className="font-medium text-amber-900 dark:text-amber-200">
        One-time setup ({config.missingEnv.length} setting{config.missingEnv.length === 1 ? '' : 's'} missing)
      </p>

      <ol className="ml-4 list-decimal space-y-1 text-amber-900/90 dark:text-amber-200/90">
        {config.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

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

      <div className="space-y-1">
        <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
          Then set on the server (still missing):
        </p>
        <div className="flex flex-wrap gap-1">
          {config.missingEnv.map((name) => (
            <code
              key={name}
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
            >
              {name}
            </code>
          ))}
        </div>
      </div>

      {config.note && (
        <p className="text-xs text-amber-800/80 dark:text-amber-200/70">Note: {config.note}</p>
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

export function SocialAccounts({ accounts, platformConfig }: Props) {
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
      await fetch(`/api/social/accounts?id=${accountId}`, { method: 'DELETE' })
      setLocalAccounts((prev) => prev.filter((a) => a.id !== accountId))
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

      {/* Honest configuration summary */}
      <Card className="border-border p-4">
        <div className="flex items-center gap-2">
          {configuredCount === platformConfig.length ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          )}
          <p className="text-sm font-medium text-foreground">
            {configuredCount} of {platformConfig.length} platforms configured on this server
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          A platform must be configured once (below) before its &quot;Connect&quot; button works.
          Platforms that aren&apos;t set up are shown honestly as &quot;Setup required&quot; — they
          will never pretend to be connected.
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
                        {configured ? 'Ready to connect' : 'Not connected'}
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
                  <Button
                    className="mt-4 w-full"
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

                {!configured && guideOpen && config && <SetupGuide config={config} />}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
