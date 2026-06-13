'use client'

import { Facebook, Twitter, Instagram } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { nativeShareOr } from './native-share'

interface SocialShareBarProps {
  title: string
  url: string
  excerpt: string
}

// Jose Madrid Salsa brand profiles (handle pattern matches the footer / nav).
const INSTAGRAM_PROFILE = 'https://instagram.com/josemadridsalsa'
const TIKTOK_PROFILE = 'https://www.tiktok.com/@josemadridsalsa'

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

/**
 * Bottom-of-post share bar. The attractive preview (image, title, excerpt)
 * comes from the page's Open Graph / Twitter Card meta tags, so each button
 * only needs to hand the platform the post URL.
 *
 * On mobile the Facebook/X apps intercept their web share URLs as universal
 * links and drop the user on their home feed instead of a share composer, so
 * nothing actually gets shared. To avoid that, every button prefers the
 * device's native share sheet when available (which hands the post to the
 * chosen app correctly) and falls back to the platform's web intent — or, for
 * Instagram/TikTok which have no web link-share endpoint, the brand profile.
 */
export function SocialShareBar({ title, url, excerpt }: SocialShareBarProps) {
  const encodedTitle = encodeURIComponent(title)
  const encodedUrl = encodeURIComponent(url)

  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  const x = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`

  const share = (fallbackUrl: string) =>
    nativeShareOr(fallbackUrl, { title, url, text: excerpt })

  return (
    <div className="mt-10 pt-6 border-t border-border">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Share this post
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Share on Facebook"
            onClick={() => share(facebook)}
            className="text-muted-foreground hover:text-white hover:bg-[#1877F2] hover:border-[#1877F2]"
          >
            <Facebook className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Share on X"
            onClick={() => share(x)}
            className="text-muted-foreground hover:text-white hover:bg-black hover:border-black"
          >
            <Twitter className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Share to Instagram"
            onClick={() => share(INSTAGRAM_PROFILE)}
            className="text-muted-foreground hover:text-white hover:bg-[#E1306C] hover:border-[#E1306C]"
          >
            <Instagram className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Share to TikTok"
            onClick={() => share(TIKTOK_PROFILE)}
            className="text-muted-foreground hover:text-white hover:bg-black hover:border-black"
          >
            <TikTokIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
