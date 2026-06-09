import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import {
  checkCredentialAccess,
  decryptCredentialPassword,
  checkPasswordBreach,
} from '@/lib/credentials'

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requirePermission('credentials:read')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (!accessLevel) {
      return fail('Forbidden - no credential access grant', 403)
    }

    const body = await req.json().catch(() => ({}))
    const credentialId = body.credentialId as string | undefined

    const where: any = {}
    if (credentialId) {
      where.id = credentialId
    }
    // Only check credentials that have a password set
    where.encValue = { not: '' }

    const credentials = await prisma.serviceCredential.findMany({
      where,
      select: {
        id: true,
        serviceName: true,
        label: true,
        username: true,
        encValue: true,
        encIv: true,
      },
    })

    if (credentials.length === 0) {
      return ok({ results: [], message: 'No credentials to check' })
    }

    const results: {
      id: string
      serviceName: string
      label: string
      username: string | null
      breached: boolean
      breachCount: number
      error?: string
    }[] = []

    // Process sequentially to respect HIBP rate limits (1 req/1.5s for free API)
    for (const cred of credentials) {
      try {
        const plaintext = decryptCredentialPassword(cred.encValue, cred.encIv)
        const breachCount = await checkPasswordBreach(plaintext)

        results.push({
          id: cred.id,
          serviceName: cred.serviceName,
          label: cred.label,
          username: cred.username,
          breached: breachCount > 0,
          breachCount,
        })

        // Rate limit: wait 1.6s between HIBP requests
        if (credentials.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1600))
        }
      } catch (err: any) {
        results.push({
          id: cred.id,
          serviceName: cred.serviceName,
          label: cred.label,
          username: cred.username,
          breached: false,
          breachCount: 0,
          error: err.message,
        })
      }
    }

    await logAudit({
      userId: currentUser.id,
      action: 'BREACH_CHECK',
      entityType: 'ServiceCredential',
      changes: {
        credentialId: credentialId || 'all',
        totalChecked: credentials.length,
        breachedCount: results.filter((r) => r.breached).length,
      },
    })

    return ok({ results })
  } catch (error: any) {
    return fail(error.message, error.status || 400)
  }
}
