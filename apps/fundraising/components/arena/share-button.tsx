'use client'

import { useState } from 'react'
import { Facebook, Instagram, Loader2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/button'

type SharePlatform = 'facebook' | 'x' | 'instagram'

interface ShareButtonProps {
  teamId: string
  teamSlug: string
  teamName: string
  shareText?: string
  className?: string
}

interface IntentResponse {
  nonce: string
  shareUrl: string
  teamSlug: string
  expiresAt: string
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M18.244 2H21l-6.51 7.44L22 22h-6.828l-4.74-6.19L4.8 22H2.04l6.957-7.952L2 2h6.914l4.286 5.67L18.244 2Zm-1.196 18h1.895L7.06 4H5.08l11.968 16Z" />
    </svg>
  )
}

function openShareWindow(url: string): Window | null {
  if (typeof window === 'undefined') return null
  const width = 600
  const height = 520
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2
  return window.open(
    url,
    'arena-share',
    `noopener,noreferrer,width=${width},height=${height},left=${left},top=${top}`,
  )
}

function buildIntentUrl(
  platform: SharePlatform,
  shareUrl: string,
  shareText: string,
): string | null {
  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(shareText)
  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
    case 'instagram':
      return null
  }
}

async function requestShareIntent(
  teamId: string,
  platform: SharePlatform,
): Promise<
  | { ok: true; data: IntentResponse }
  | { ok: false; status: number; error: string }
> {
  try {
    const res = await fetch('/api/fundraiser/arena/share/intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId, platform }),
    })
    const data = (await res.json().catch(() => ({}))) as
      | (IntentResponse & { error?: string })
      | { error?: string }

    if (!res.ok || !('shareUrl' in data) || !data.shareUrl) {
      const error =
        typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : `HTTP ${res.status}`
      return { ok: false, status: res.status, error }
    }
    return { ok: true, data: data as IntentResponse }
  } catch {
    return { ok: false, status: 0, error: 'Network error' }
  }
}

export function ShareButton({
  teamId,
  teamSlug,
  teamName,
  shareText,
  className,
}: ShareButtonProps) {
  const [pending, setPending] = useState<SharePlatform | null>(null)
  const text =
    shareText ?? `Help ${teamName} win the JMS Fundraiser Battle Arena!`

  async function handleShare(platform: SharePlatform): Promise<void> {
    if (pending) return
    setPending(platform)

    try {
      const intent = await requestShareIntent(teamId, platform)
      if (!intent.ok) {
        if (intent.status === 401) {
          toast.error('Sign in to activate your team\u2019s shield.')
          return
        }
        if (intent.status === 429) {
          toast.warning(
            intent.error.toLowerCase().includes('day')
              ? 'Daily share limit hit. Try again tomorrow.'
              : 'You\u2019re sharing too fast. Wait an hour and try again.',
          )
          return
        }
        if (intent.status === 403) {
          toast.warning('Accounts must be 24+ hours old to activate a shield.')
          return
        }
        toast.error(intent.error || 'Could not start share. Try again.')
        return
      }

      const { shareUrl } = intent.data

      if (platform === 'instagram') {
        try {
          await navigator.clipboard.writeText(shareUrl)
          toast.info(
            'Link copied \u2014 paste into your Instagram story or bio to activate the shield.',
          )
        } catch {
          toast.info('Copy this link and paste into Instagram:', {
            description: shareUrl,
          })
        }
        return
      }

      const intentUrl = buildIntentUrl(platform, shareUrl, text)
      if (intentUrl) {
        const opened = openShareWindow(intentUrl)
        if (!opened) {
          toast.warning(
            'Pop-up blocked. Allow pop-ups and try again, or copy the link.',
          )
        }
      }
    } catch {
      toast.error('Something went wrong. Try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      className={clsx('flex flex-col gap-2', className)}
      role="group"
      aria-label="Share to activate shield"
      data-team-slug={teamSlug}
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
        <Share2 className="h-3 w-3" />
        Share to activate shield
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-[#1877F2]/50 bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 hover:text-[#1877F2]"
          disabled={pending !== null}
          onClick={() => handleShare('facebook')}
          aria-label={`Share ${teamName} on Facebook`}
        >
          {pending === 'facebook' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Facebook className="h-4 w-4" />
          )}
          <span className="ml-1.5 text-xs">Facebook</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-900/80 hover:text-white"
          disabled={pending !== null}
          onClick={() => handleShare('x')}
          aria-label={`Share ${teamName} on X`}
        >
          {pending === 'x' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XIcon className="h-4 w-4" />
          )}
          <span className="ml-1.5 text-xs">X</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-pink-500/50 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 hover:text-pink-300"
          disabled={pending !== null}
          onClick={() => handleShare('instagram')}
          aria-label={`Copy ${teamName} link for Instagram`}
        >
          {pending === 'instagram' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Instagram className="h-4 w-4" />
          )}
          <span className="ml-1.5 text-xs">Instagram</span>
        </Button>
      </div>
    </div>
  )
}
