'use client'

import Link from 'next/link'
import { Star } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { pointsForAmount } from '@/lib/loyalty-progress'

interface LoyaltyPointsHintProps {
  /** Merchandise amount in dollars, before tax, shipping and any discount code. */
  amount: number
  /** Where a signed-out shopper returns to after signing in. */
  callbackUrl: string
  /** Wording for the amount, e.g. "this jar" or "this order". */
  subject: string
  className?: string
}

/**
 * Tells a shopper how many loyalty points a purchase earns. Signed-in customers see the
 * points; guests, who earn nothing, are invited to sign in so the order counts. The figure
 * is an upper bound: a discount code applied at checkout lowers the points earned.
 */
export function LoyaltyPointsHint({ amount, callbackUrl, subject, className }: LoyaltyPointsHintProps) {
  const { status } = useSession()
  const points = pointsForAmount(amount)
  if (points <= 0) return null

  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-salsa-200 bg-salsa-50 p-3 text-sm text-salsa-900 dark:border-salsa-800 dark:bg-salsa-900/30 dark:text-salsa-100',
        className,
      )}
    >
      <Star className="mt-0.5 h-4 w-4 shrink-0 text-salsa-600" aria-hidden="true" />
      <p>
        {status === 'authenticated' ? (
          <>
            Earn up to <strong className="tabular-nums">{points.toLocaleString()} points</strong> with {subject}.{' '}
          </>
        ) : (
          <>
            <Link href={signInHref} className="font-medium underline underline-offset-2">
              Sign in
            </Link>{' '}
            to earn up to <strong className="tabular-nums">{points.toLocaleString()} points</strong> with {subject}.{' '}
          </>
        )}
        <Link href="/rewards" className="underline underline-offset-2">
          How rewards work
        </Link>
      </p>
    </div>
  )
}
