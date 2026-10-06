import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'impersonate'
  | 'export'
  | 'publish'
  | 'refund'
  | 'approve'
  | 'reject'

export interface AuditLogParams {
  userId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  changes?: Record<string, any> | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Log an audit event
 */
export async function logAudit(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        changes: params.changes ? JSON.parse(JSON.stringify(params.changes)) : null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    })
  } catch (e) {
    console.warn('Audit log failed:', e)
  }
}

/**
 * Extract IP and user agent from request
 */
export function getRequestMetadata(request?: NextRequest | Request) {
  // Defensive rather than trusting the shape: this runs on the way to writing an audit
  // entry for an operation that has already happened. A request object without usable
  // headers must cost us the IP, not the whole operation — see logAuditWithRequest.
  try {
    const headers = request?.headers
    if (!headers?.get) {
      return { ipAddress: null, userAgent: null }
    }

    const ipAddress =
      headers.get('x-forwarded-for')?.split(',')[0] || headers.get('x-real-ip') || null

    const userAgent = headers.get('user-agent') || null

    return { ipAddress, userAgent }
  } catch {
    return { ipAddress: null, userAgent: null }
  }
}

/**
 * Helper to log with request metadata.
 *
 * Like `logAudit`, this never throws. Audit logging records something that already
 * happened — a refund that has moved money, a rotated credential — so a failure here must
 * not turn a completed operation into a 500 for the caller.
 */
export async function logAuditWithRequest(
  params: Omit<AuditLogParams, 'ipAddress' | 'userAgent'>,
  request?: NextRequest | Request
) {
  try {
    const metadata = getRequestMetadata(request)
    return await logAudit({ ...params, ...metadata })
  } catch (e) {
    console.warn('Audit log failed:', e)
  }
}

/**
 * Create a snapshot of changes (before/after)
 */
export function createChangeSnapshot(
  before: Record<string, any> | null,
  after: Record<string, any>
): Record<string, any> {
  if (!before) {
    return { type: 'create', after }
  }

  const changes: Record<string, any> = {}
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      changes[key] = { from: before[key], to: after[key] }
    }
  }

  return { type: 'update', changes }
}
