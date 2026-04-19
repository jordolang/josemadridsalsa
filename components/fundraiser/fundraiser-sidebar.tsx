'use client'

import { useState } from 'react'
import { Share2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SupporterFeed, type SupporterFeedItem } from '@/components/fundraiser/supporter-feed'

export interface FundraiserSidebarProps {
  shareTitle: string
  shareText?: string
  supporters: SupporterFeedItem[]
  /** Anchor id of the product grid to scroll to on primary CTA click. */
  shopAnchor?: string
  /** Primary CTA label. */
  shopLabel?: string
}

export function FundraiserSidebar({
  shareTitle,
  shareText,
  supporters,
  shopAnchor = 'shop',
  shopLabel = 'Shop & Support',
}: FundraiserSidebarProps) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  )

  const scrollToShop = () => {
    const el = document.getElementById(shopAnchor)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    try {
      const nav = window.navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>
      }
      if (typeof nav.share === 'function') {
        await nav.share({ title: shareTitle, text: shareText, url })
        setShareStatus('idle')
        return
      }
      await window.navigator.clipboard.writeText(url)
      setShareStatus('copied')
      setTimeout(() => setShareStatus('idle'), 2000)
    } catch {
      setShareStatus('error')
      setTimeout(() => setShareStatus('idle'), 2000)
    }
  }

  return (
    <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
      <Card className="card surface-shadow">
        <CardContent className="space-y-3 p-4">
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-salsa-600 to-chile-600 text-white hover:from-salsa-700 hover:to-chile-700"
            onClick={scrollToShop}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            {shopLabel}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleShare}
          >
            <Share2 className="mr-2 h-4 w-4" />
            {shareStatus === 'copied'
              ? 'Link copied'
              : shareStatus === 'error'
                ? 'Share failed'
                : 'Share'}
          </Button>
        </CardContent>
      </Card>

      {supporters.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Supporters
          </h2>
          <SupporterFeed items={supporters} />
        </div>
      )}
    </aside>
  )
}
