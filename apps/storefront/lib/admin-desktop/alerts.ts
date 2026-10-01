/**
 * What the desktop windows tell the operator when the counts move.
 *
 * The shell polls the sidebar badges. When work arrives — an order to fulfil,
 * a message to answer — the native app shows a notification and keeps its dock
 * or taskbar badge at the total still waiting. Only counts that rose produce a
 * notification: a count that fell is work being done, and the first read after
 * the window opens is the baseline, not news.
 */

import type { DesktopBadges } from './types'
import type { DesktopSectionId } from './sections'

export interface DesktopAlert {
  title: string
  body: string
  /** Where clicking the notification takes the window. */
  path: string
}

/** The badge counts worth interrupting someone for, and how to say so. */
const WATCHED: {
  key: 'orders' | 'messages'
  section: DesktopSectionId
  title: (added: number) => string
  body: (total: number) => string
}[] = [
  {
    key: 'orders',
    section: 'orders',
    title: (added) => (added === 1 ? 'New order to fulfil' : `${added} new orders to fulfil`),
    body: (total) => `${total} waiting to ship`,
  },
  {
    key: 'messages',
    section: 'messages',
    title: (added) => (added === 1 ? 'New customer message' : `${added} new customer messages`),
    body: (total) => `${total} open in Messages`,
  },
]

/**
 * The notifications to show for a move from `before` to `after`, limited to the
 * sections this account can open — a count it cannot act on is not its news.
 */
export function badgeAlerts(
  before: DesktopBadges,
  after: DesktopBadges,
  canSee: (section: DesktopSectionId) => boolean,
): DesktopAlert[] {
  return WATCHED.filter(({ section }) => canSee(section)).flatMap(({ key, section, title, body }) => {
    const added = (after[key] ?? 0) - (before[key] ?? 0)
    if (added <= 0) return []
    return [{ title: title(added), body: body(after[key] ?? 0), path: `/admin-desktop?section=${section}` }]
  })
}

/** The number on the dock or taskbar: everything watched that is still waiting. */
export function attentionCount(
  badges: DesktopBadges,
  canSee: (section: DesktopSectionId) => boolean,
): number {
  return WATCHED.filter(({ section }) => canSee(section)).reduce(
    (sum, { key }) => sum + (badges[key] ?? 0),
    0,
  )
}
