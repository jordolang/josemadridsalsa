'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Swords, Shield } from 'lucide-react'
import { clsx } from 'clsx'

export interface AttackFeedItem {
  id: string
  actorName: string
  actorAvatarUrl?: string | null
  amount: number
  createdAt: string | Date
  direction: 'incoming' | 'outgoing'
  absorbedByShield?: boolean
}

interface AttackFeedProps {
  items: AttackFeedItem[]
  emptyLabel?: string
  maxHeightClass?: string
  className?: string
}

function formatRelative(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const diffMs = Date.now() - date.getTime()
  const secs = Math.max(0, Math.floor(diffMs / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function AttackFeed({
  items,
  emptyLabel = 'No activity yet — be the first to attack!',
  maxHeightClass = 'max-h-80',
  className,
}: AttackFeedProps) {
  return (
    <div className={clsx('w-full', className)}>
      <div
        className={clsx(
          'overflow-y-auto rounded-lg border border-neutral-800 bg-black/40',
          maxHeightClass,
        )}
      >
        {items.length === 0 ? (
          <p className="p-4 text-center text-xs uppercase tracking-widest text-neutral-500">
            {emptyLabel}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800/70">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const outgoing = item.direction === 'outgoing'
                return (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: outgoing ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-3 p-3"
                  >
                    <div
                      className={clsx(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                        item.absorbedByShield
                          ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                          : outgoing
                            ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                            : 'border-red-500/60 bg-red-500/10 text-red-300',
                      )}
                      aria-hidden
                    >
                      {item.absorbedByShield ? (
                        <Shield className="h-3.5 w-3.5" />
                      ) : (
                        <Swords className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-200">
                          {item.actorName}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-slate-400">
                          {formatRelative(item.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest">
                        <span
                          className={clsx(
                            'font-bold',
                            outgoing ? 'text-amber-400' : 'text-red-400',
                          )}
                        >
                          {outgoing ? 'Attacked for' : 'Hit us for'}
                        </span>
                        <span className="font-mono tabular-nums text-slate-200">
                          {formatAmount(item.amount)}
                        </span>
                        {item.absorbedByShield && (
                          <span className="text-cyan-400">· blocked</span>
                        )}
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  )
}
