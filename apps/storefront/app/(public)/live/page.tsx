import type { Metadata } from 'next'
import Link from 'next/link'
import { Facebook, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLiveStatus } from '@/lib/live/facebook-live'

export const metadata: Metadata = {
  title: 'Live | Jose Madrid Salsa',
  description: 'Watch Jose Madrid Salsa live from events, markets, and the kitchen.',
}

export default async function LivePage() {
  const status = await getLiveStatus()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      {status.isLive && status.embedUrl ? (
        <>
          <div className="mb-6 flex items-center gap-3">
            <span aria-hidden className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.22em] text-green-600">
              Live now
            </span>
          </div>

          <h1 className="mb-6 font-serif text-3xl font-bold text-foreground sm:text-4xl">
            {status.title || 'Jose Madrid Salsa — Live'}
          </h1>

          <div
            className="relative w-full overflow-hidden rounded-xl border border-border bg-black shadow-lg"
            style={{ aspectRatio: '16 / 9' }}
          >
            <iframe
              src={status.embedUrl}
              title={status.title || 'Jose Madrid Salsa live stream'}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>

          {status.permalinkUrl && (
            <div className="mt-6">
              <Button asChild variant="outline">
                <a href={status.permalinkUrl} target="_blank" rel="noopener noreferrer">
                  <Facebook className="mr-2 h-4 w-4" />
                  Watch on Facebook
                </a>
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
          <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Radio className="h-7 w-7" />
          </span>
          <h1 className="mb-3 font-serif text-3xl font-bold text-foreground sm:text-4xl">
            We&apos;re not live right now
          </h1>
          <p className="mb-8 text-muted-foreground">
            Catch us live from events and markets on Facebook. Follow our page to get notified
            the moment we go live.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="bg-salsa-500 hover:bg-salsa-600">
              <a href={status.facebookPageUrl} target="_blank" rel="noopener noreferrer">
                <Facebook className="mr-2 h-4 w-4" />
                Visit our Facebook page
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/where-is-jose">See where we&apos;ll be next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
