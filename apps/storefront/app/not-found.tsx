import type { Metadata } from 'next'
import Link from 'next/link'
import { NotFoundContent } from '@/components/store/not-found-content'

// The root layout templates this as "%s | Jose Madrid Salsa", so the suffix is
// already handled — repeating it here renders it twice.
export const metadata: Metadata = {
  title: 'Page not found',
  description: 'That page is not on the chart. Browse our salsas, recipes, and stockists.',
}

/**
 * Root 404, for paths that match no route at all and so never reach the public
 * layout. It carries its own wordmark because there is no nav above it.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto w-full max-w-3xl px-6 py-6">
          <Link
            href="/"
            className="font-serif text-lg text-foreground transition-colors hover:text-salsa-600"
          >
            Jose Madrid Salsa
          </Link>
        </div>
      </header>
      <NotFoundContent />
    </div>
  )
}
