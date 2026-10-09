/**
 * Merge every mailing list into one recipient list for a store-wide campaign.
 * A campaign row targets at most one list, so an "all lists" send is built as
 * an explicit recipient snapshot instead. Someone on several lists appears once.
 */

export interface ListSubscriberRow {
  email: string
  firstName: string | null
  lastName: string | null
}

export interface MergedRecipient {
  email: string
  name?: string
}

export function mergeListSubscribers(rows: ListSubscriberRow[]): MergedRecipient[] {
  const byEmail = new Map<string, MergedRecipient>()
  for (const row of rows) {
    const email = row.email.trim().toLowerCase()
    if (!email.includes('@')) continue
    const name = [row.firstName, row.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ')
    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, name ? { email, name } : { email })
    } else if (!existing.name && name) {
      existing.name = name
    }
  }
  return Array.from(byEmail.values())
}
