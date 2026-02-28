import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requireGrantAdmin } from '@/lib/credentials-access'
import { ok, fail, forbidden, serverError } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const grantSchema = z.object({
  email: z.string().email(),
})

/**
 * List all credential access grants.
 * Only jordolang@gmail.com can call this.
 */
export async function GET() {
  try {
    const user = await requireGrantAdmin()
    if (!user) return forbidden('Not Permitted')

    const grants = await prisma.credentialAccessGrant.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return ok({ grants })
  } catch (error: any) {
    console.error('[Credentials Access API] GET error:', error)
    return serverError('Failed to load access grants')
  }
}

/**
 * Grant access to a user email.
 * Only jordolang@gmail.com can call this.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireGrantAdmin()
    if (!user) return forbidden('Not Permitted')

    const body = await req.json()
    const { email } = grantSchema.parse(body)
    const normalizedEmail = email.toLowerCase().trim()

    // Check if grant already exists
    const existing = await prisma.credentialAccessGrant.findUnique({
      where: { email: normalizedEmail },
    })

    if (existing && !existing.revokedAt) {
      return fail('Access already granted to this email', 409)
    }

    if (existing && existing.revokedAt) {
      // Re-activate the revoked grant
      const grant = await prisma.credentialAccessGrant.update({
        where: { email: normalizedEmail },
        data: { revokedAt: null },
      })

      await logAudit({
        userId: user.id,
        action: 'REACTIVATE',
        entityType: 'CredentialAccessGrant',
        entityId: grant.id,
        changes: { email: normalizedEmail },
      })

      return ok({ grant }, 200)
    }

    const grant = await prisma.credentialAccessGrant.create({
      data: {
        email: normalizedEmail,
        grantedByEmail: user.email,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'CredentialAccessGrant',
      entityId: grant.id,
      changes: { email: normalizedEmail },
    })

    return ok({ grant }, 201)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail('Invalid email address', 400)
    }
    console.error('[Credentials Access API] POST error:', error)
    return serverError('Failed to grant access')
  }
}

/**
 * Revoke access for a user email.
 * Only jordolang@gmail.com can call this.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireGrantAdmin()
    if (!user) return forbidden('Not Permitted')

    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')?.toLowerCase().trim()

    if (!email) return fail('Email parameter is required', 400)

    const grant = await prisma.credentialAccessGrant.findUnique({
      where: { email },
    })

    if (!grant) return fail('No access grant found for this email', 404)

    await prisma.credentialAccessGrant.update({
      where: { email },
      data: { revokedAt: new Date() },
    })

    await logAudit({
      userId: user.id,
      action: 'REVOKE',
      entityType: 'CredentialAccessGrant',
      entityId: grant.id,
      changes: { email },
    })

    return ok({ success: true })
  } catch (error: any) {
    console.error('[Credentials Access API] DELETE error:', error)
    return serverError('Failed to revoke access')
  }
}
