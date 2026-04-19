'use client'

import { useState } from 'react'
import { Facebook, Instagram, Loader2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/button'

type SharePlatform = 'facebook' | 'x' | 'instagram'

type ApiPlatform = 'facebook' | 'x' | 'instagram' | 'tiktok' | 'other'

interface ShareButtonProps {
  teamId: string
  teamSlug: string
  teamName: string
  /** Fully-qualified URL — defaults to `/fundraise/[slug]`. */
  shareUrl?: string
  shareText?: string
  className?: string
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
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`
    case 'instagram':
      return null
  }
}

export function ShareButton({
  teamId,
  teamSlug,
  teamName,
  shareUrl,
  shareText,
  className,
}: ShareButtonProps) {
  const [pending, setPending] = useState<SharePlatform | null>(null)

  const url =
    shareUrl ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/fundraise/${teamSlug}`
      : `/fundraise/${teamSlug}`)
  const text =
    shareText ?? `Help ${teamName} win the JMS Fundraiser Battle Arena!`

  async function notifyShare(platform: ApiPlatform): Promise<void> {
    const res = await fetch('/api/fundraiser/arena/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamId, platform }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      activated?: boolean
      extended?: boolean
      reason?: string
      expiresAt?: string
      remainingHP?: number
      error?: string
    }

    if (res.status === 401) {
      toast.error('Sign in to activate your team\u2019s shield.')
      return
    }
    if (res.status === 429) {
      toast.warning(
        data.error ??
          'Another supporter needs to share before you can activate again.',
      )
      return
    }
    if (!res.ok || !data.success) {
      toast.error(data.error ?? 'Could not record your share. Try again.')
      return
    }
    if (data.activated) {
      toast.success('Shield activated for 30 minutes!', {
        description: `${teamName} is now protected.`,
      })
    } else if (data.extended) {
      toast.success('Share recorded \u2014 shield already active.', {
        description: 'Your share counts toward future protection.',
      })
    }
  }

  async function handleShare(platform: SharePlatform) {
    if (pending) return
    setPending(platform)

    try {
      if (platform === 'instagram') {
        try {
          await navigator.clipboard.writeText(`${text} ${url}`)
          toast.info('Link copied \u2014 paste into your Instagram story.')
        } catch {
          toast.info('Copy this link and paste into Instagram:', {
            description: url,
          })
        }
      } else {
        const intent = buildIntentUrl(platform, url, text)
        if (intent) openShareWindow(intent)
      }
      await notifyShare(platform)
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
