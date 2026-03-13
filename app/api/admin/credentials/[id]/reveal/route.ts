import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAuditWithRequest } from '@/lib/audit'
import { checkCredentialAccess, decryptCredentialPassword, verifyUserPassword } from '@/lib/credentials'
import { z } from 'zod'

const revealSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

// In-memory rate limiting: max 5 failed attempts per user per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const MAX_FAILED_ATTEMPTS = 5
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now >= entry.resetAt) {
    return true
  }

  return entry.count < MAX_FAILED_ATTEMPTS
}

function recordFailedAttempt(userId: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  } else {
    entry.count += 1
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requirePermission('credentials:read')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (!accessLevel) {
      return fail('Forbidden - no credential access grant', 403)
    }

    const { id } = params

    // Check rate limit before processing
    if (!checkRateLimit(currentUser.id)) {
      await logAuditWithRequest(
        {
          userId: currentUser.id,
          action: 'CREDENTIAL_REVEAL_RATE_LIMITED',
          entityType: 'ServiceCredential',
          entityId: id,
        },
        req
      )
      return fail('Too many failed attempts. Please try again later.', 429)
    }

    // Parse and validate request body
    const body = await req.json()
    const data = revealSchema.parse(body)

    // Find the credential
    const credential = await prisma.serviceCredential.findUnique({
      where: { id },
      select: {
        id: true,
        encValue: true,
        encIv: true,
      },
    })

    if (!credential) {
      return fail('Credential not found', 404)
    }

    // Verify user's password
    const passwordValid = await verifyUserPassword(currentUser.email, data.password)

    if (!passwordValid) {
      recordFailedAttempt(currentUser.id)

      await logAuditWithRequest(
        {
          userId: currentUser.id,
          action: 'CREDENTIAL_REVEAL_FAILED',
          entityType: 'ServiceCredential',
          entityId: id,
          changes: { reason: 'invalid_password' },
        },
        req
      )

      return fail('Invalid password', 401)
    }

    // Decrypt the credential
    let plaintext: string
    try {
      plaintext = decryptCredentialPassword(credential.encValue, credential.encIv)
    } catch (error) {
      if ((error as Error).message?.includes('MASTER_KEY')) {
        return fail('Server configuration error', 500)
      }
      return fail('Failed to decrypt credential', 500)
    }

    await logAuditWithRequest(
      {
        userId: currentUser.id,
        action: 'CREDENTIAL_REVEAL_SUCCESS',
        entityType: 'ServiceCredential',
        entityId: id,
      },
      req
    )

    return ok({ password: plaintext })
  } catch (error: any) {
    if (error.message?.includes('MASTER_KEY')) {
      return fail('Server configuration error', 500)
    }
    return fail(error.message, error.status || 400)
  }
}
