/**
 * The one definition of "which ledger rows am I looking at".
 *
 * Shared by the list endpoint and the export endpoint so that exporting a filtered view returns
 * exactly the rows on screen. The orders export learned this the hard way: it understood only
 * `status` and a date range, so every filter added afterwards silently exported everything.
 */
import type { Prisma } from '@prisma/client'

import { LEDGER_CATEGORY_VALUES, LEDGER_SOURCE_VALUES } from './ledger'

/** Build the Prisma filter from a query string. Every filter is optional. */
export function buildLedgerWhere(params: URLSearchParams): Prisma.LedgerEntryWhereInput {
  const where: Prisma.LedgerEntryWhereInput = {}

  const from = params.get('from')
  const to = params.get('to')
  if (from || to) {
    where.date = {}
    if (from && !Number.isNaN(Date.parse(from))) where.date.gte = new Date(from)
    // Inclusive of the end day.
    if (to && !Number.isNaN(Date.parse(to))) where.date.lte = new Date(`${to}T23:59:59.999Z`)
  }

  const direction = params.get('direction')
  if (direction === 'INCOME' || direction === 'EXPENSE') where.direction = direction

  const category = params.get('category')
  if (category && (LEDGER_CATEGORY_VALUES as readonly string[]).includes(category)) {
    where.category = category as Prisma.LedgerEntryWhereInput['category']
  }

  const source = params.get('source')
  if (source && (LEDGER_SOURCE_VALUES as readonly string[]).includes(source)) {
    where.source = source as Prisma.LedgerEntryWhereInput['source']
  }

  // "Only what I have not sent to QuickBooks yet" — the whole point of tracking `exportedAt`.
  if (params.get('onlyUnexported') === 'true') where.exportedAt = null

  const q = params.get('q')?.trim()
  if (q) {
    where.OR = [
      { description: { contains: q, mode: 'insensitive' } },
      { counterparty: { contains: q, mode: 'insensitive' } },
      { memo: { contains: q, mode: 'insensitive' } },
    ]
  }

  return where
}
