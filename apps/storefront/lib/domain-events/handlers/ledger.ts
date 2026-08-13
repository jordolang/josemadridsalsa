/**
 * Domain events → the bookkeeping ledger.
 *
 * Keeps the ledger current without a nightly job: the moment an order's payment settles or a
 * refund goes through, the matching ledger rows are written (idempotently, keyed by dedupe key,
 * so a replay is harmless). Both facts carry the *order* id — `payment.refunded` included — so the
 * refund handler records every settled refund on that order.
 */
import {
  recordOrderInLedger,
  recordOrderRefundsInLedger,
} from '@/lib/financials/ledger-writer'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'

export async function handleLedgerOrderSettled(event: DomainEventRecord): Promise<void> {
  await recordOrderInLedger(event.entityId)
}

export async function handleLedgerOrderRefunded(event: DomainEventRecord): Promise<void> {
  await recordOrderRefundsInLedger(event.entityId)
}

/** Subscribe the ledger to the two money-moving facts. */
export function registerLedgerHandlers(): void {
  registerDomainEventHandler('payment.completed', 'ledger', handleLedgerOrderSettled)
  registerDomainEventHandler('payment.refunded', 'ledger', handleLedgerOrderRefunded)
}
