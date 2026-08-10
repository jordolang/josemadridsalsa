/**
 * The consumer side of the domain event bus.
 *
 * Producers record business facts with `emitDomainEvent`; this is where anything acts on
 * them. Before this existed the bus had thirteen producers and no consumers, so every
 * automation was hand-wired into the individual route that caused it — which is why the same
 * automation ended up implemented three times on three payment paths and missing on the
 * fourth. A handler registered here runs for the fact regardless of which route produced it.
 *
 * **Handlers are drained by a poller, not invoked at emit time.** Emitters pass their
 * transaction client (`app/api/webhooks/stripe` marks a payment failed and emits inside one
 * `$transaction`), so running a handler at emit time would act on work that can still roll
 * back, and would hold a database transaction open across email sends and other network I/O.
 * A poller only ever sees committed rows, so the hand-off is correct by construction.
 *
 * **Delivery is at-least-once, so handlers must be idempotent.** An event is marked consumed
 * only after its handlers finish; a crash mid-batch replays it on the next tick. That bias is
 * deliberate — re-running an idempotent handler costs nothing, whereas marking first would
 * silently drop enrollments on any transient failure.
 */
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { isMissingColumnError } from '@/lib/prisma-errors'

import type { DomainEventType } from './types'

/** A persisted event row, as a handler receives it. */
export interface DomainEventRecord {
  id: string
  type: string
  entityType: string
  entityId: string
  payload: Prisma.JsonValue | null
  actorUserId: string | null
  createdAt: Date
}

export type DomainEventHandler = (event: DomainEventRecord) => Promise<void>

interface RegisteredHandler {
  /** Used only for logging, so a failure names the handler rather than "anonymous". */
  name: string
  handle: DomainEventHandler
}

const handlers = new Map<DomainEventType, RegisteredHandler[]>()

/**
 * Subscribe to a domain event type.
 *
 * Registration is additive and order-preserving: several handlers may claim the same event
 * and each runs, in the order it was registered.
 */
export function registerDomainEventHandler(
  type: DomainEventType,
  name: string,
  handle: DomainEventHandler
): void {
  const existing = handlers.get(type)
  if (existing) {
    existing.push({ name, handle })
    return
  }
  handlers.set(type, [{ name, handle }])
}

/** Drop every registration. Exists for tests, which need a clean registry per case. */
export function clearDomainEventHandlers(): void {
  handlers.clear()
}

/** The event types anything is currently listening for. */
export function subscribedEventTypes(): DomainEventType[] {
  return [...handlers.keys()]
}

/**
 * Run every handler registered for one event.
 *
 * A throwing handler is contained and reported rather than allowed to abort its siblings —
 * one broken consumer must not stop the others from seeing the fact. The boolean says
 * whether the event can be marked consumed: false leaves it pending for the next tick.
 */
export async function dispatchDomainEvent(event: DomainEventRecord): Promise<boolean> {
  const registered = handlers.get(event.type as DomainEventType)
  if (!registered || registered.length === 0) return true

  let allSucceeded = true

  for (const { name, handle } of registered) {
    try {
      await handle(event)
    } catch (error) {
      allSucceeded = false
      console.error('[events] Handler failed', {
        handler: name,
        eventId: event.id,
        type: event.type,
        error,
      })
    }
  }

  return allSucceeded
}

export interface DrainResult {
  /** Events read from the outbox. */
  claimed: number
  /** Events whose handlers all completed, now marked consumed. */
  consumed: number
  /** Events left pending because a handler failed; retried on the next tick. */
  failed: number
}

/**
 * Drain pending events from the outbox, oldest first.
 *
 * Only types something is actually subscribed to are read. Without that filter the query
 * returns every unconsumed row — overwhelmingly events nobody listens for — and the batch
 * limit gets spent marking those consumed instead of doing work.
 */
export async function dispatchPendingDomainEvents(limit = 200): Promise<DrainResult> {
  // Registration has to have happened before this runs, or the filter below is empty and the
  // drain silently does nothing. Callers register first; `lib/domain-events/handlers`
  // guarantees that is cheap to repeat.
  const types = subscribedEventTypes()
  if (types.length === 0) {
    console.warn('[events] Drain ran with no handlers registered; nothing will be consumed.')
    return { claimed: 0, consumed: 0, failed: 0 }
  }

  let pending: DomainEventRecord[]
  try {
    pending = await prisma.domainEvent.findMany({
      where: { consumedAt: null, type: { in: types } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
  } catch (error) {
    // `consumedAt` arrives with a migration, and a deploy can land this code before the
    // migration runs — the build wraps `migrate deploy` in a warning, not a failure. Degrade
    // to doing nothing rather than throwing, so an unapplied migration cannot take down the
    // rest of the cron (the step processor runs immediately after this).
    if (isMissingColumnError(error)) {
      console.warn(
        '[events] domain_events.consumedAt does not exist. Run `prisma migrate deploy`.'
      )
      return { claimed: 0, consumed: 0, failed: 0 }
    }
    throw error
  }

  if (pending.length === 0) return { claimed: 0, consumed: 0, failed: 0 }

  const consumedIds: string[] = []
  let failed = 0

  for (const event of pending) {
    const ok = await dispatchDomainEvent(event)
    if (ok) {
      consumedIds.push(event.id)
    } else {
      failed++
    }
  }

  if (consumedIds.length > 0) {
    await prisma.domainEvent.updateMany({
      where: { id: { in: consumedIds } },
      data: { consumedAt: new Date() },
    })
  }

  return { claimed: pending.length, consumed: consumedIds.length, failed }
}
