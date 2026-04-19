'use client'

import { useState } from 'react'
import { Share2, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DonationForm } from '@/components/fundraiser/donation-form'

export interface DonateActionCardProps {
  teamId: string
  teamSlug: string
  teamName: string
  pricePerUnit: number
  shareTitle?: string
  shareText?: string
  /** Pre-fill the donation form from the NextAuth session. */
  viewer?: { name?: string | null; email?: string | null }
}

/**
 * Sidebar action card — oversized indigo Donate CTA plus a secondary Share
 * button. Opens the DonationForm in a shadcn Dialog; share falls back to
 * clipboard copy when Web Share API is unavailable.
 */
export function DonateActionCard({
  teamId,
  teamSlug,
  teamName,
  pricePerUnit,
  shareTitle,
  shareText,
  viewer,
}: DonateActionCardProps) {
  const [open, setOpen] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  )
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  async function handleShare() {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/fundraise/${teamSlug}`
        : `/fundraise/${teamSlug}`
    const payload = {
      title: shareTitle ?? `Support ${teamName}`,
      text:
        shareText ??
        `Help power ${teamName} in the Jose Madrid Salsa Fundraiser.`,
      url,
    }
    try {
      if (typeof navigator === 'undefined') return
      const nav: Navigator = navigator
      if (typeof nav.share === 'function') {
        await nav.share(payload)
        return
      }
      if (nav.clipboard) {
        await nav.clipboard.writeText(url)
        setShareStatus('copied')
        setTimeout(() => setShareStatus('idle'), 2000)
      }
    } catch {
      setShareStatus('error')
      setTimeout(() => setShareStatus('idle'), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl bg-indigo-600 text-base font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 hover:shadow-lg"
          >
            <Heart className="mr-2 h-5 w-5" />
            Donate
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Support {teamName}</DialogTitle>
          </DialogHeader>
          <DonationForm
            tiers={[
              { amount: 100, label: `~${Math.max(1, Math.round(100 / pricePerUnit))} jars of salsa` },
              { amount: 50, label: `~${Math.max(1, Math.round(50 / pricePerUnit))} jars of salsa` },
              { amount: 25, label: `~${Math.max(1, Math.round(25 / pricePerUnit))} jars of salsa` },
              { amount: 10, label: 'Every bit helps' },
            ]}
            className="border-0 p-0 shadow-none"
            viewer={viewer}
            onSubmit={async ({
              amount,
              frequency,
              fundId,
              donorName,
              donorEmail,
              comment,
              isAnonymous,
            }) => {
              setCheckoutError(null)
              try {
                const res = await fetch(
                  '/api/fundraiser/donate/create-session',
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      teamId,
                      amount,
                      frequency,
                      fundId: fundId ?? undefined,
                      donor: {
                        name: donorName,
                        email: donorEmail,
                        comment,
                        isAnonymous,
                      },
                    }),
                  },
                )
                const data = await res.json()
                if (!res.ok || !data?.success || !data.url) {
                  setCheckoutError(
                    typeof data?.error === 'string'
                      ? data.error
                      : 'Unable to start checkout',
                  )
                  return
                }
                setOpen(false)
                window.location.assign(data.url)
              } catch {
                setCheckoutError('Network error. Please try again.')
              }
            }}
          />
          {checkoutError && (
            <p
              role="alert"
              className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive"
            >
              {checkoutError}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Button
        variant="outline"
        size="lg"
        className="h-12 w-full rounded-2xl border-slate-200 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50"
        onClick={handleShare}
      >
        <Share2 className="mr-2 h-4 w-4" />
        {shareStatus === 'copied'
          ? 'Link copied!'
          : shareStatus === 'error'
            ? 'Share failed'
            : 'Share'}
      </Button>
    </div>
  )
}
