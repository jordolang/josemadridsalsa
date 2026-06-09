import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAuditWithRequest } from '@/lib/audit'
import { checkCredentialAccess, decryptCredentialPassword } from '@/lib/credentials'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requirePermission('credentials:read')

    const accessLevel = await checkCredentialAccess(currentUser.email, currentUser.role)
    if (!accessLevel) {
      return fail('Forbidden - no credential access grant', 403)
    }

    const { id } = await params

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

    if (!credential.encValue) {
      return fail('No password set for this credential', 400)
    }

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
