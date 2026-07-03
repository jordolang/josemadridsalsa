'use client'

import { ExternalLink, Facebook, Music2, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useLiveStatus } from '@/hooks/use-live-status'
import { cn } from '@/lib/utils'

/**
 * Live streaming feed status. Facebook state comes from the existing
 * /api/live/status poller (lib/live/facebook-live.ts); TikTok has no public
 * live-status API, so that card links out to the broadcast tooling instead.
 */
export function FeedsLive() {
  const status = useLiveStatus()

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#1877F2]/10 p-2.5 text-[#1877F2]">
              <Facebook className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Facebook Live</p>
              <p className="text-xs text-muted-foreground">
                {status.isLive
                  ? status.title || 'Broadcasting now'
                  : 'Not currently broadcasting'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                'gap-1.5',
                status.isLive
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Radio className={cn('h-3 w-3', status.isLive && 'animate-pulse')} />
              {status.isLive ? 'LIVE' : 'Offline'}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <a
                href={status.permalinkUrl ?? status.facebookPageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {status.isLive ? 'Watch on Facebook' : 'Facebook Page'}
              </a>
            </Button>
          </div>
        </div>

        {status.isLive && status.embedUrl ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={status.embedUrl}
              title={status.title ?? 'Facebook Live broadcast'}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            <p>
              When the Facebook Page goes live, the broadcast appears here and the
              storefront&apos;s <span className="font-medium text-foreground">Live</span> nav
              tab lights up automatically (checked every 60 seconds).
            </p>
            <p className="mt-2 text-xs">
              Live detection requires the <code className="rounded bg-muted px-1">FACEBOOK_LIVE_PAGE_ID</code> and{' '}
              <code className="rounded bg-muted px-1">FACEBOOK_LIVE_PAGE_ACCESS_TOKEN</code> environment
              variables. Without them this card always shows Offline.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-muted p-2.5 text-foreground">
            <Music2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">TikTok Live</p>
            <p className="text-xs text-muted-foreground">
              TikTok does not expose a public live-status API for embedding.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.tiktok.com/live" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              TikTok Live
            </a>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Go live from the TikTok app or TikTok Live Studio. Products synced to TikTok
          Shop (see the Shops tab) can be pinned to the broadcast for live shopping.
        </p>
      </Card>
    </div>
  )
}
