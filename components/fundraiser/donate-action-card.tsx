'use client'

import { useState } from 'react'
import { Share2, Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  )

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
            onSubmit={({
              amount,
              frequency,
              fundId,
              donorName,
              donorEmail,
              comment,
              isAnonymous,
            }) => {
              const params = new URLSearchParams({
                ref: teamSlug,
                team: teamId,
                amount: String(amount),
                frequency,
              })
              if (fundId) params.set('fund', fundId)
              if (isAnonymous) {
                params.set('anon', '1')
              } else if (donorName) {
                params.set('donor_name', donorName)
              }
              if (donorEmail) params.set('donor_email', donorEmail)
              if (comment) params.set('comment', comment)
              setOpen(false)
              router.push(`/shop?${params.toString()}`)
            }}
          />
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
