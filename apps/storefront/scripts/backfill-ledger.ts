/**
 * Backfill the bookkeeping ledger from everything already in the database.
 *
 *   tsx scripts/backfill-ledger.ts
 *
 * Safe to re-run: every derived row is upserted by its dedupe key, so a second run updates rather
 * than duplicates. Reads settled orders (+ their refunds) and the historical archived show sales.
 * Rollups that merely re-summarise those sales are intentionally skipped — see the LedgerEntry
 * model comment for why.
 */
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import {
  SETTLED_PAYMENT,
  recordArchivedShowInLedger,
  recordOrderInLedger,
  recordOrderRefundsInLedger,
} from '@/lib/financials/ledger-writer'

const PAGE = 500

async function backfillOrders(): Promise<{ orders: number; rows: number }> {
  let skip = 0
  let orders = 0
  let rows = 0

  for (;;) {
    const batch = await prisma.order.findMany({
      // Same recordable-status rule as the live writer (shared constant so the two cannot drift):
      // refunded orders still count — their sale and fee stand, and their refunds are contra rows.
      where: { paymentStatus: { in: [...SETTLED_PAYMENT] } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      skip,
      take: PAGE,
    })
    if (batch.length === 0) break

    for (const { id } of batch) {
      rows += await recordOrderInLedger(id)
      rows += await recordOrderRefundsInLedger(id)
      orders += 1
    }

    console.log(`  …${orders} settled orders processed`)
    skip += PAGE
  }

  return { orders, rows }
}

async function backfillArchivedShows(): Promise<{ shows: number; rows: number }> {
  const shows = await prisma.archivedShowSale.findMany({
    select: { id: true, showName: true, showDate: true, year: true, sales: true, expenses: true, salesPerson: true },
  })

  let rows = 0
  for (const show of shows) rows += await recordArchivedShowInLedger(show)
  return { shows: shows.length, rows }
}

async function main(): Promise<void> {
  console.log('Backfilling the bookkeeping ledger…\n')

  console.log('Orders + refunds:')
  const orders = await backfillOrders()
  console.log(`  ${orders.orders} orders → ${orders.rows} ledger rows\n`)

  console.log('Archived show sales:')
  const shows = await backfillArchivedShows()
  console.log(`  ${shows.shows} shows → ${shows.rows} ledger rows\n`)

  const total = await prisma.ledgerEntry.count()
  console.log(`Done. The ledger now holds ${total} entries.`)
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
