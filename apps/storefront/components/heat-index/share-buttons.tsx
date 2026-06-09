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
        asChild
        variant="ghost"
        size="icon"
        aria-label="Share on X"
        className="text-muted-foreground hover:text-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/30"
      >
        <a href={twitter} target="_blank" rel="noopener noreferrer">
          <Twitter className="w-4 h-4" />
        </a>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="Share on Facebook"
        className="text-muted-foreground hover:text-salsa-600 hover:bg-salsa-50 dark:hover:bg-salsa-900/30"
      >
        <a href={facebook} target="_blank" rel="noopener noreferrer">
          <Facebook className="w-4 h-4" />
        </a>
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
