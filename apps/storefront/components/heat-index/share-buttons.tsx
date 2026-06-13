'use client'

import { useState } from 'react'
import { Twitter, Facebook, Mail, Link as LinkIcon, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ShareButtonsProps {
  title: string
  url: string
}

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const encodedTitle = encodeURIComponent(title)
  const encodedUrl = encodeURIComponent(url)

  const twitter = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  const email = `mailto:?subject=${encodedTitle}&body=${encodedUrl}`

  // On mobile the Facebook/X apps intercept their web share URLs as universal
  // links and open their home feed instead of a share composer, so nothing
  // gets shared. Prefer the device's native share sheet when available and
  // fall back to the web intent (e.g. on desktop).
  function nativeShareOr(fallbackUrl: string) {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, url }).catch(() => {})
    } else {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable (insecure context, permissions); silently no-op
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
        Share
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Share on X"
        onClick={() => nativeShareOr(twitter)}
        className="text-muted-foreground hover:text-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/30"
      >
        <Twitter className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Share on Facebook"
        onClick={() => nativeShareOr(facebook)}
        className="text-muted-foreground hover:text-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/30"
      >
        <Facebook className="w-4 h-4" />
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="Share by email"
        className="text-muted-foreground hover:text-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/30"
      >
        <a href={email}>
          <Mail className="w-4 h-4" />
        </a>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={copyLink}
        aria-label="Copy link"
        className="text-muted-foreground hover:text-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/30"
      >
        {copied ? <Check className="w-4 h-4 text-verde-600" /> : <LinkIcon className="w-4 h-4" />}
      </Button>
    </div>
  )
}
