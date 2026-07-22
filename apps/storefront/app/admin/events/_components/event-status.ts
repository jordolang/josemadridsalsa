/**
 * Booking-status presentation, shared by the events list and the calendar so a
 * status never looks different depending on which view you're standing in.
 *
 * Colours double as text labels everywhere they appear — colour alone never
 * carries the meaning.
 */

export interface StatusStyle {
  label: string
  dot: string
  badge: string
}

/** Declared in pipeline order; filter menus render them in this order. */
export const STATUS_STYLES: Record<string, StatusStyle> = {
  INTERESTED: {
    label: 'Interested',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  APPLIED: {
    label: 'Applied',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  },
  WAITLISTED: {
    label: 'Waitlisted',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  ACCEPTED: {
    label: 'Accepted',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  },
  CONFIRMED: {
    label: 'Confirmed',
    dot: 'bg-green-600',
    badge: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-300',
  },
  DECLINED: {
    label: 'Declined',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
}

export const BOOKING_STATUSES = Object.keys(STATUS_STYLES)

export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? STATUS_STYLES.INTERESTED
}

/** A show that fell through shouldn't compete visually with one we're working. */
export function isDeadStatus(status: string): boolean {
  return status === 'DECLINED' || status === 'CANCELLED'
}
