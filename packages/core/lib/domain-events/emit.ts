import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import type { DomainEventInput } from './types'

/**
 * Anything that can run a `domainEvent.create` — the singleton client, or the
 * transaction client handed to a `prisma.$transaction` callback.
 */
export type DomainEventClient = Pick<Prisma.TransactionClient, 'domainEvent'>

/**
 * Record a business fact.
 *
 * Never throws. Emitting is observability, not the operation itself — a failed event
 * write must not roll back a captured payment or a purchased shipping label. This
 * mirrors how `logAudit` swallows its own errors, and it is the reason callers inside
 * `prisma.$transaction` should pass the transaction client explicitly: the write then
 * participates in the transaction, but a failure is still contained here.
 */
export async function emitDomainEvent(
  event: DomainEventInput,
  client?: DomainEventClient
): Promise<void> {
  try {
    // Resolved inside the try rather than as a default parameter: default parameters are
    // evaluated before the try block, so touching the prisma singleton there could throw
    // past this catch and break the very operation the event only describes.
    const db = client ?? prisma
    await db.domainEvent.create({
      data: {
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: event.payload
          ? (JSON.parse(JSON.stringify(event.payload)) as Prisma.InputJsonValue)
          : undefined,
        actorUserId: event.actorUserId ?? null,
      },
    })
  } catch (error) {
    console.warn('[events] Failed to record domain event:', event.type, error)
  }
}

/**
 * Record several facts from one operation. Emitted sequentially so ordering within a
 * single operation is preserved in the timeline.
 */
export async function emitDomainEvents(
  events: DomainEventInput[],
  client: DomainEventClient = prisma
): Promise<void> {
  for (const event of events) {
    await emitDomainEvent(event, client)
  }
}

/**
 * Read an entity's activity timeline, oldest first.
 */
export async function getEntityTimeline(
  entityType: DomainEventInput['entityType'],
  entityId: string,
  limit = 100
) {
  return prisma.domainEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}
