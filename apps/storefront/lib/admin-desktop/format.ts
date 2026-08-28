/**
 * Presentation helpers for the desktop admin shell.
 *
 * Everything the shell shows is formatted on the server so a number never
 * renders differently in the macOS window than it does in the Windows one, and
 * so the client never has to know that money arrives as a Prisma `Decimal`.
 */

import type { Decimal } from '@prisma/client/runtime/library'
import type { Tone } from './types'

/** The shop runs on Eastern time; a UTC day boundary would mis-bucket evening orders. */
export const STORE_TIME_ZONE = 'America/New_York'

type Money = Decimal | number | null | undefined

export function toNumber(value: Money): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value)
}

export function money(value: Money): string {
  return toNumber(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Whole dollars, for stat tiles where cents are noise. */
export function moneyShort(value: Money): string {
  return toNumber(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function centsToMoney(cents: number): string {
  return money(cents / 100)
}

export function count(value: number): string {
  return value.toLocaleString('en-US')
}

export function percent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** `1.4 MB`. Base 1024, which is what a file manager shows next to the same file. */
export function bytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), BYTE_UNITS.length - 1)
  const scaled = value / 1024 ** exponent
  // Whole bytes never want a decimal point; anything larger reads better with one.
  return `${scaled.toFixed(exponent === 0 ? 0 : 1)} ${BYTE_UNITS[exponent]}`
}

/** `★★★★☆` — a rating out of five, drawn rather than spelled out. */
export function stars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

/** First line of a free-text body, clipped for a table cell. */
export function excerpt(value: string | null | undefined, limit = 90): string {
  const line = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!line) return '—'
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: STORE_TIME_ZONE,
})

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: STORE_TIME_ZONE,
})

const timeFormat = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: STORE_TIME_ZONE,
})

export function shortDate(value: Date | null | undefined): string {
  return value ? dateFormat.format(value) : '—'
}

/** `Sep 14 · 8:12 AM` — the design's order timestamp. */
export function stamp(value: Date | null | undefined): string {
  if (!value) return '—'
  return dateTimeFormat.format(value).replace(', ', ' · ')
}

export function shortTime(value: Date | null | undefined): string {
  return value ? timeFormat.format(value) : '—'
}

/** Turn `EXTRA_HOT` into `Extra hot` for display without losing the enum upstream. */
export function humanise(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const HEAT_TONE: Record<string, Tone> = {
  MILD: 'good',
  MEDIUM: 'warn',
  HOT: 'bad',
  EXTRA_HOT: 'bad',
  FRUIT: 'accent',
}

export function heatTone(heat: string): Tone {
  return HEAT_TONE[heat] ?? 'muted'
}

const ORDER_STATUS_TONE: Record<string, Tone> = {
  PENDING: 'warn',
  CONFIRMED: 'warn',
  PROCESSING: 'warn',
  SHIPPED: 'good',
  DELIVERED: 'good',
  CANCELLED: 'muted',
  REFUNDED: 'bad',
}

export function orderStatusTone(status: string): Tone {
  return ORDER_STATUS_TONE[status] ?? 'muted'
}

const CHANNEL_LABEL: Record<string, string> = {
  WEBSITE: 'Online',
  POS: 'POS',
  FUNDRAISER: 'Fundraiser',
  WHOLESALE: 'Wholesale',
  EVENT: 'Show',
  MANUAL: 'Manual',
  MARKETPLACE: 'Marketplace',
  PHONE: 'Phone',
  IMPORT: 'Import',
}

export function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? humanise(channel)
}

const CHANNEL_TONE: Record<string, Tone> = {
  WHOLESALE: 'warn',
  FUNDRAISER: 'good',
  EVENT: 'accent',
}

export function channelTone(channel: string): Tone {
  return CHANNEL_TONE[channel] ?? 'muted'
}

/** A person's display name from whatever the order actually carries. */
export function personName(parts: {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}): string {
  if (parts.name?.trim()) return parts.name.trim()
  const full = [parts.firstName, parts.lastName].filter(Boolean).join(' ').trim()
  if (full) return full
  return parts.email?.trim() || 'Guest'
}

export function place(parts: { city?: string | null; state?: string | null }): string {
  return [parts.city, parts.state].filter(Boolean).join(', ') || '—'
}
