'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Share control for a poll.
 *
 * Uses the device's own share sheet where there is one — that is what people
 * expect on a phone — and falls back to copying the link. The URL is built on
 * the client so an invite-only poll's `?key=` travels with it.
 */
export function PollShare({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // Share sheet dismissed — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={share}
      className="h-11 rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
    >
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" aria-hidden />
          Link copied
        </>
      ) : (
        <>
          <Share2 className="mr-2 h-4 w-4" aria-hidden />
          Share this poll
        </>
      )}
    </Button>
  )
}
