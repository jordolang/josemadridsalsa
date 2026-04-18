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
 * Sidebar action card at the top of a fundraiser page: primary Donate
 * button that opens the DonationForm in a shadcn Dialog, plus a Share
 * button that falls back to clipboard copy if the Web Share API is
 * unavailable.
 *
 * The form's Continue action POSTs to
 * `/api/fundraiser/donate/create-session` and redirects the browser to the
 * returned Stripe Checkout URL. The Stripe webhook's
 * `checkout.session.completed` handler then calls `applyPurchaseDamage`
 * with the donor metadata we set on the session.
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
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="h-12 w-full text-base font-semibold">
            <Heart className="mr-2 h-4 w-4" />
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
        className="h-12 w-full text-base font-semibold"
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
