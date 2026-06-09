import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Small "Verified" pill used next to the organizer line on fundraiser
 * pages. Visual-only — authority comes from the server query that decides
 * whether to render this.
 */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
        className,
      )}
    >
      <BadgeCheck className="h-3 w-3 fill-amber-400 text-amber-900 dark:text-amber-500" />
      Verified
    </span>
  )
}
