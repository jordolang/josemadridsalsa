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
  if (!request) {
    return { ipAddress: null, userAgent: null }
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    null

  const userAgent = request.headers.get('user-agent') || null

  return { ipAddress, userAgent }
}

/**
 * Helper to log with request metadata
 */
export async function logAuditWithRequest(
  params: Omit<AuditLogParams, 'ipAddress' | 'userAgent'>,
  request?: NextRequest | Request
) {
  const metadata = getRequestMetadata(request)
  return logAudit({ ...params, ...metadata })
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
