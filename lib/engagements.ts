import type { EngagementStatus, EngagementType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface LogEngagementOptions {
  type: EngagementType
  email?: string | null
  name?: string | null
  source?: string | null
  metadata?: Record<string, any> | null
  status?: EngagementStatus
}

export async function logEngagementRequest({
  type,
  email,
  name,
  source,
  metadata,
  status,
}: LogEngagementOptions) {
  try {
    return await prisma.engagementRequest.create({
      data: {
        type,
        email: email ?? null,
        name: name ?? null,
        source: source ?? null,
        metadata: metadata ?? undefined,
        status: status ?? 'PENDING',
      },
    })
  } catch (error) {
    console.error('[Engagements] Failed to log engagement request', { type, email, source, error })
    return null
  }
}
