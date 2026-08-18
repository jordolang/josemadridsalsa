'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for the storefront.
 *
 * It sits below `app/global-error.tsx`, so without the `captureException` here
 * a failed storefront render would be caught, shown to the customer, and never
 * reported to anyone.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-salsa-600">
        Kitchen error
      </p>

      <h1 className="mt-5 font-serif text-5xl leading-[1.05] text-foreground sm:text-7xl">
        Something scorched.
      </h1>

      <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
        This page didn&rsquo;t finish loading, and that one is on us. Try it again &mdash;
        if it keeps happening, tell us and we&rsquo;ll go clean the burner.
      </p>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button onClick={reset} className="bg-salsa-500 hover:bg-salsa-600">
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to the shop</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/contact">Tell us what broke</Link>
        </Button>
      </div>

      {error.digest && (
        <p className="mt-10 font-mono text-xs text-muted-foreground">
          Reference {error.digest}
        </p>
      )}
    </main>
  )
}
