import { NextRequest, NextResponse } from 'next/server'
import type { PartnerApiKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashApiKey } from './api-key-utils'

type PartnerAuthSuccess = { partner: PartnerApiKey }
type PartnerAuthError = { error: NextResponse }

export async function requirePartner(
  request: NextRequest,
  scope: string,
): Promise<PartnerAuthSuccess | PartnerAuthError> {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    return { error: NextResponse.json({ error: 'Missing X-API-Key header' }, { status: 401 }) }
  }

  const keyHash = hashApiKey(apiKey)
  const partner = await prisma.partnerApiKey.findUnique({ where: { keyHash } })

  if (!partner || !partner.isActive) {
    return { error: NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 }) }
  }

  if (scope && partner.scopes.length > 0 && !partner.scopes.includes(scope)) {
    return { error: NextResponse.json({ error: 'Insufficient scope for this endpoint' }, { status: 403 }) }
  }

  await prisma.partnerApiKey.update({ where: { id: partner.id }, data: { lastUsedAt: new Date() } })

  return { partner }
}

export async function logPartnerApiCall(
  partner: PartnerApiKey,
  request: NextRequest,
  status: number,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: partner.userId,
        action: 'forms.api',
        entityType: 'PartnerApiKey',
        entityId: partner.id,
        changes: {
          path: request.nextUrl.pathname,
          method: request.method,
          status,
          ...metadata,
        },
      },
    })
  } catch (error) {
    console.warn('Failed to log partner API call', error)
  }
}
