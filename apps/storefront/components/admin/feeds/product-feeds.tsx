'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Download, ExternalLink, Globe, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FEED_PLATFORMS, type FeedPlatformInfo } from '@/lib/feeds/platforms'

function FeedCard({ platform, origin }: { platform: FeedPlatformInfo; origin: string }) {
  const [copied, setCopied] = useState(false)
  const feedUrl = `${origin}${platform.path}`

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the URL stays selectable.
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-foreground">{platform.label}</h3>
        <Badge variant="outline" className="uppercase">{platform.format}</Badge>
        <Badge variant="secondary" className="gap-1">
          {platform.delivery === 'scheduled-url' ? (
            <>
              <Globe className="h-3 w-3" />
              Scheduled URL
            </>
          ) : (
            <>
              <Upload className="h-3 w-3" />
              File upload
            </>
          )}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{platform.description}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={feedUrl}
          onFocus={(e) => e.target.select()}
          className="font-mono text-xs"
        />
        <div className="flex gap-2">
          {platform.delivery === 'scheduled-url' && (
            <Button variant="outline" size="sm" onClick={copyUrl}>
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy URL'}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={`${platform.path}?download=1`}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={platform.path} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="sr-only">Open feed</span>
            </a>
          </Button>
        </div>
      </div>

      <ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-muted-foreground">
        {platform.setup.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </Card>
  )
}

export function ProductFeeds() {
  // The absolute origin is only known in the browser; render relative paths
  // until it resolves so server and client markup stay consistent.
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  return (
    <div className="space-y-4">
      <Card className="border-border bg-muted/50 p-5">
        <h3 className="font-semibold text-foreground">Export your catalog everywhere</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Every feed below is generated live from your active products — prices, images,
          and inventory always match the storefront. Platforms with a scheduled URL
          re-fetch the feed automatically; Amazon takes a downloaded flat file uploaded
          in Seller Central. Microsoft and Pinterest reuse the Google Shopping format, so
          one catalog reaches every destination.
        </p>
      </Card>

      {FEED_PLATFORMS.map((platform) => (
        <FeedCard key={platform.id} platform={platform} origin={origin} />
      ))}
    </div>
  )
}
