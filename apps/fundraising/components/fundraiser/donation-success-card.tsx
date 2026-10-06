'use client'

import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface DonationSuccessCardProps {
  amount: number
  currency?: string
  donorEmail?: string | null
  /** Controls the confetti animation — defaults to true. */
  confetti?: boolean
  onDismiss?: () => void
  dismissLabel?: string
  className?: string
}

const CONFETTI_COLORS = [
  '#F59E0B',
  '#EC4899',
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#F43F5E',
]

/**
 * Post-checkout "Successful payment" card — shadcn Card with a lightweight
 * CSS confetti burst over a green check icon, the contributed amount, and
 * a dismiss button.
 */
export function DonationSuccessCard({
  amount,
  currency = 'USD',
  donorEmail,
  confetti = true,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
}: DonationSuccessCardProps) {
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)

  return (
    <Card
      className={cn(
        'relative mx-auto w-full max-w-md overflow-hidden text-center shadow-xl',
        className,
      )}
    >
      {confetti && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 motion-reduce:hidden"
        >
          {Array.from({ length: 24 }).map((_, i) => {
            const left = (i / 24) * 100
            const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
            const delay = (i % 6) * 0.1
            return (
              <span
                key={i}
                className="absolute top-0 block h-2 w-1 animate-[fall_2.2s_ease-in_forwards] rounded-sm"
                style={{
                  left: `${left}%`,
                  backgroundColor: color,
                  animationDelay: `${delay}s`,
                  transform: `rotate(${(i * 37) % 360}deg)`,
                }}
              />
            )
          })}
          <style>{`
            @keyframes fall {
              0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(180px) rotate(540deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      <CardHeader className="pt-10">
        <CardTitle className="text-lg font-bold">
          Successful payment
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 pb-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_0_6px_rgba(16,185,129,0.15)]">
          <CheckCircle2 className="h-10 w-10" strokeWidth={2.5} />
        </div>

        <div>
          <div className="text-xl font-semibold">Thanks for your support!</div>
          {donorEmail && (
            <div className="mt-1 text-xs text-muted-foreground">
              Your receipt will be sent to {donorEmail}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-muted/40 py-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            You contributed
          </div>
          <div className="mt-0.5 text-3xl font-bold tabular-nums">{fmt}</div>
        </div>

        {onDismiss && (
          <Button size="lg" className="w-full" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
