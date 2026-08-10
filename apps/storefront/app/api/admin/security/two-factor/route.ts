import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import {
  confirmTwoFactorEnrolment,
  countUnusedRecoveryCodes,
  disableTwoFactor,
  isTwoFactorEnabled,
  startTwoFactorEnrolment,
} from '@/lib/auth/two-factor'

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('confirm'), token: z.string().min(6).max(10) }),
  // Disabling is a security downgrade, so it re-checks the password rather than trusting
  // the existing session alone.
  z.object({ action: z.literal('disable'), password: z.string().min(1) }),
])

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [enabled, recoveryCodesRemaining] = await Promise.all([
    isTwoFactorEnabled(user.id),
    countUnusedRecoveryCodes(user.id),
  ])

  return NextResponse.json({ enabled, recoveryCodesRemaining })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = ActionSchema.parse(await request.json())

    if (body.action === 'start') {
      // The secret is returned once, here, so the user can add it to their app. After
      // confirmation it is never exposed again.
      const { secret, otpauthUri } = await startTwoFactorEnrolment(user.id, user.email)
      return NextResponse.json({ secret, otpauthUri })
    }

    if (body.action === 'confirm') {
      const result = await confirmTwoFactorEnrolment(user.id, body.token)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

      await logAuditWithRequest(
        { userId: user.id, action: 'update', entityType: 'user', entityId: user.id,
          changes: { twoFactor: { from: 'disabled', to: 'enabled' } } },
        request
      )

      // Shown exactly once — only hashes are stored.
      return NextResponse.json({ enabled: true, recoveryCodes: result.recoveryCodes })
    }

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    })
    if (!record?.password || !(await bcrypt.compare(body.password, record.password))) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 403 })
    }

    await disableTwoFactor(user.id)
    await logAuditWithRequest(
      { userId: user.id, action: 'update', entityType: 'user', entityId: user.id,
        changes: { twoFactor: { from: 'enabled', to: 'disabled' } } },
      request
    )

    return NextResponse.json({ enabled: false })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Two-factor error:', error)
    return NextResponse.json({ error: 'Failed to update two-factor settings' }, { status: 500 })
  }
}
