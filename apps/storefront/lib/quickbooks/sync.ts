import type { QuickBooksEntityType, QuickBooksSettings } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { quickBooksFetch, QuickBooksApiError } from './client'
import { getValidAccessToken, markSynced } from './connection'
import {
  buildCustomerPayload,
  buildItemPayload,
  buildSalesReceipt,
  type OrderForSync,
} from './mappers'

/**
 * Pushes paid website orders into QuickBooks Online as SalesReceipts.
 *
 * Checkout never calls this. Orders are discovered by a sweeper and drained from
 * `QuickBooksSyncRecord` by a cron, so a QBO outage can never affect a customer
 * placing an order.
 */

/** Retries per record before it is parked as FAILED for a human to look at. */
const MAX_ATTEMPTS = 5

/** Exponential backoff, capped so a stuck row still retries a few times a day. */
const BASE_BACKOFF_MS = 5 * 60 * 1000
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000

export function backoffFor(attempts: number): Date {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS)
  return new Date(Date.now() + delay)
}

/**
 * QBO's query language is SQL-like and takes single-quoted literals, so an
 * apostrophe in a product name ("Jose's Original") would otherwise break the
 * query — or worse, alter it.
 */
export function escapeQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function getSettings(realmId: string): Promise<QuickBooksSettings | null> {
  return prisma.quickBooksSettings.findUnique({ where: { realmId } })
}

async function lookupMapping(
  realmId: string,
  entityType: QuickBooksEntityType,
  localId: string
): Promise<string | null> {
  const row = await prisma.quickBooksEntityMap.findUnique({
    where: { realmId_entityType_localId: { realmId, entityType, localId } },
  })
  return row?.quickbooksId ?? null
}

async function saveMapping(params: {
  realmId: string
  entityType: QuickBooksEntityType
  localId: string
  quickbooksId: string
  syncToken?: string | null
}) {
  const { realmId, entityType, localId, quickbooksId, syncToken } = params
  await prisma.quickBooksEntityMap.upsert({
    where: { realmId_entityType_localId: { realmId, entityType, localId } },
    create: { realmId, entityType, localId, quickbooksId, syncToken: syncToken ?? null },
    update: { quickbooksId, syncToken: syncToken ?? null },
  })
}

interface QboQueryResponse<T> {
  QueryResponse: Record<string, T[] | number | undefined>
}

/** Run a QBO SELECT and return the first row of the named entity, if any. */
async function queryFirst<T>(entity: string, where: string): Promise<T | null> {
  const data = await quickBooksFetch<QboQueryResponse<T>>('query', {
    query: { query: `select * from ${entity} where ${where} maxresults 1` },
  })
  const rows = data?.QueryResponse?.[entity]
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

/**
 * The identity we file a customer under. Registered buyers key on their user id;
 * guests key on email, so repeat guest orders reuse one QBO customer instead of
 * creating a new one per order.
 */
export function customerLocalId(order: { userId: string | null; customerEmail: string | null }) {
  if (order.userId) return order.userId
  const email = order.customerEmail?.trim().toLowerCase()
  return email ? `guest:${email}` : null
}

/**
 * Resolve (or create) the QBO Customer for an order. Adopts an existing customer
 * matched by email before creating one — the books may already know this person
 * from a manual entry, and a duplicate would split their history.
 */
export async function ensureCustomer(
  realmId: string,
  order: OrderForSync & { userId: string | null }
): Promise<string> {
  const localId = customerLocalId(order)
  if (!localId) throw new Error('Order has no user and no email to identify a customer')

  const mapped = await lookupMapping(realmId, 'CUSTOMER', localId)
  if (mapped) return mapped

  const email = order.customerEmail?.trim()
  if (email) {
    const existing = await queryFirst<{ Id: string; SyncToken?: string }>(
      'Customer',
      `PrimaryEmailAddr = '${escapeQueryLiteral(email)}'`
    )
    if (existing?.Id) {
      await saveMapping({
        realmId,
        entityType: 'CUSTOMER',
        localId,
        quickbooksId: existing.Id,
        syncToken: existing.SyncToken,
      })
      return existing.Id
    }
  }

  const created = await quickBooksFetch<{ Customer: { Id: string; SyncToken?: string } }>(
    'customer',
    { method: 'POST', body: buildCustomerPayload(order) }
  )

  await saveMapping({
    realmId,
    entityType: 'CUSTOMER',
    localId,
    quickbooksId: created.Customer.Id,
    syncToken: created.Customer.SyncToken,
  })
  return created.Customer.Id
}

/**
 * Resolve (or create) the QBO Item for a product, matching on SKU first so we
 * adopt items the bookkeeper already set up by hand.
 */
export async function ensureItem(
  realmId: string,
  product: { id: string; name: string; sku: string },
  incomeAccountId: string
): Promise<string> {
  const mapped = await lookupMapping(realmId, 'ITEM', product.id)
  if (mapped) return mapped

  const existing =
    (await queryFirst<{ Id: string; SyncToken?: string }>(
      'Item',
      `Sku = '${escapeQueryLiteral(product.sku)}'`
    )) ??
    (await queryFirst<{ Id: string; SyncToken?: string }>(
      'Item',
      `Name = '${escapeQueryLiteral(product.name)}'`
    ))

  if (existing?.Id) {
    await saveMapping({
      realmId,
      entityType: 'ITEM',
      localId: product.id,
      quickbooksId: existing.Id,
      syncToken: existing.SyncToken,
    })
    return existing.Id
  }

  const created = await quickBooksFetch<{ Item: { Id: string; SyncToken?: string } }>('item', {
    method: 'POST',
    body: buildItemPayload(product, incomeAccountId),
  })

  await saveMapping({
    realmId,
    entityType: 'ITEM',
    localId: product.id,
    quickbooksId: created.Item.Id,
    syncToken: created.Item.SyncToken,
  })
  return created.Item.Id
}

/**
 * Has this order already been posted? Guards the one failure mode that actually
 * damages the books: creating the receipt in QBO, then crashing before the
 * ledger row is written, and double-posting the revenue on retry.
 */
export async function findExistingReceipt(docNumber: string): Promise<string | null> {
  const existing = await queryFirst<{ Id: string }>(
    'SalesReceipt',
    `DocNumber = '${escapeQueryLiteral(docNumber)}'`
  )
  return existing?.Id ?? null
}

/** Load an order and flatten its money fields into plain numbers for mapping. */
export async function loadOrderForSync(
  orderId: string
): Promise<(OrderForSync & { userId: string | null }) | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user: { select: { email: true, name: true } },
    },
  })
  if (!order) return null

  const email = order.user?.email ?? order.guestEmail ?? null
  const [firstName, ...rest] = (order.user?.name ?? '').trim().split(/\s+/).filter(Boolean)

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    tax: Number(order.tax),
    discountAmount: Number(order.discountAmount),
    giftCertificateAmount: Number(order.giftCertificateAmount),
    total: Number(order.total),
    customerEmail: email,
    customerFirstName: firstName ?? null,
    customerLastName: rest.length > 0 ? rest.join(' ') : null,
    userId: order.userId,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
  }
}

export type SyncOutcome =
  /**
   * `payload` is what we actually sent QBO, carried back so the ledger can keep
   * it. Without it, diagnosing a receipt that posted the wrong figure means
   * reconstructing the request from an order that may have changed since.
   */
  | { status: 'SYNCED'; quickbooksId: string; payload?: unknown }
  | { status: 'BLOCKED'; reason: string }
  | { status: 'FAILED'; reason: string }

/**
 * Post one order. Returns BLOCKED for anything a retry cannot fix (missing
 * account mapping, numbers that don't reconcile) and FAILED for transient
 * trouble worth retrying.
 */
export async function syncOrder(orderId: string): Promise<SyncOutcome> {
  const { realmId } = await getValidAccessToken()

  const settings = await getSettings(realmId)
  if (!settings?.incomeAccountId) {
    return { status: 'BLOCKED', reason: 'No income account mapped in QuickBooks settings' }
  }

  const order = await loadOrderForSync(orderId)
  if (!order) return { status: 'BLOCKED', reason: 'Order no longer exists' }

  if (settings.syncStartDate && order.createdAt < settings.syncStartDate) {
    return { status: 'BLOCKED', reason: 'Order predates the configured sync start date' }
  }

  // Adopting an already-posted receipt is what keeps a mid-flight crash from
  // billing the books twice.
  const alreadyPosted = await findExistingReceipt(order.orderNumber)
  if (alreadyPosted) {
    return { status: 'SYNCED', quickbooksId: alreadyPosted }
  }

  const customerId = await ensureCustomer(realmId, order)

  const itemIds: Record<string, string> = {}
  for (const line of order.items) {
    itemIds[line.productId] = await ensureItem(
      realmId,
      { id: line.productId, name: line.productName, sku: line.productSku },
      settings.incomeAccountId
    )
  }

  const mapped = buildSalesReceipt({ order, customerId, itemIds, settings })
  if (!mapped.ok) {
    return { status: 'BLOCKED', reason: mapped.reason }
  }

  const created = await quickBooksFetch<{ SalesReceipt: { Id: string } }>('salesreceipt', {
    method: 'POST',
    body: mapped.payload,
  })

  await saveMapping({
    realmId,
    entityType: 'SALES_RECEIPT',
    localId: order.id,
    quickbooksId: created.SalesReceipt.Id,
  })
  await markSynced(realmId)

  return {
    status: 'SYNCED',
    quickbooksId: created.SalesReceipt.Id,
    payload: mapped.payload,
  }
}

/**
 * Find paid orders that have never been queued and enqueue them.
 *
 * A sweeper rather than a hook on the payment paths: orders reach PAID through
 * Stripe, Square, PayPal and the POS terminal, and this way none of them can be
 * forgotten, none of them can be slowed down by QBO, and a webhook that never
 * arrived still gets picked up on the next run.
 */
export async function enqueuePaidOrders(limit = 100): Promise<number> {
  const { realmId } = await getValidAccessToken()
  const settings = await getSettings(realmId)
  if (!settings?.autoSyncEnabled) return 0

  const candidates = await prisma.order.findMany({
    where: {
      paymentStatus: 'PAID',
      ...(settings.syncStartDate && { createdAt: { gte: settings.syncStartDate } }),
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  if (candidates.length === 0) return 0

  const ids = candidates.map((o) => o.id)
  const known = await prisma.quickBooksSyncRecord.findMany({
    where: { entityType: 'SALES_RECEIPT', entityId: { in: ids } },
    select: { entityId: true },
  })
  const seen = new Set(known.map((r) => r.entityId))
  const fresh = ids.filter((id) => !seen.has(id))
  if (fresh.length === 0) return 0

  const result = await prisma.quickBooksSyncRecord.createMany({
    data: fresh.map((entityId) => ({ entityType: 'SALES_RECEIPT' as const, entityId })),
    skipDuplicates: true,
  })
  return result.count
}

/** Process due rows from the ledger. Returns a per-status tally. */
export async function drainQueue(limit = 25) {
  const now = new Date()
  const due = await prisma.quickBooksSyncRecord.findMany({
    where: {
      entityType: 'SALES_RECEIPT',
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  const tally = { processed: 0, synced: 0, blocked: 0, failed: 0 }

  for (const record of due) {
    tally.processed++
    const attempts = record.attempts + 1

    let outcome: SyncOutcome
    try {
      await prisma.quickBooksSyncRecord.update({
        where: { id: record.id },
        data: { status: 'PROCESSING', attempts },
      })
      outcome = await syncOrder(record.entityId)
    } catch (error) {
      // Intuit's trace id goes into the stored error: it is the first thing
      // their support asks for, and it only exists on the failed response.
      const message =
        error instanceof QuickBooksApiError
          ? `QBO ${error.status}${error.intuitTid ? ` [tid ${error.intuitTid}]` : ''}: ${error.message}`
          : error instanceof Error
            ? error.message
            : 'Unknown error'
      outcome = { status: 'FAILED', reason: message }
    }

    if (outcome.status === 'SYNCED') {
      tally.synced++
      await prisma.quickBooksSyncRecord.update({
        where: { id: record.id },
        data: {
          status: 'SYNCED',
          quickbooksId: outcome.quickbooksId,
          payload: (outcome.payload ?? undefined) as never,
          lastError: null,
          nextAttemptAt: null,
          processedAt: new Date(),
        },
      })
      continue
    }

    if (outcome.status === 'BLOCKED') {
      tally.blocked++
      await prisma.quickBooksSyncRecord.update({
        where: { id: record.id },
        data: { status: 'BLOCKED', lastError: outcome.reason, nextAttemptAt: null },
      })
      continue
    }

    tally.failed++
    await prisma.quickBooksSyncRecord.update({
      where: { id: record.id },
      data: {
        status: 'FAILED',
        lastError: outcome.reason,
        // Out of retries: stop rescheduling so it surfaces in the admin panel
        // instead of churning forever.
        nextAttemptAt: attempts >= MAX_ATTEMPTS ? null : backoffFor(attempts),
      },
    })
  }

  return tally
}
