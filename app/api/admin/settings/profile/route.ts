import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
})

export async function GET() {
  try {
    const sessionUser = await getCurrentUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await getCurrentUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = UpdateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, phone, currentPassword, newPassword } = parsed.data

    // If changing password, verify current password first
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set a new password.', field: 'currentPassword' },
          { status: 400 }
        )
      }
      const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { password: true },
      })
      if (!user?.password) {
        return NextResponse.json(
          { error: 'Account does not have a password set. Use OAuth sign-in.' },
          { status: 400 }
        )
      }
      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) {
        return NextResponse.json(
          { error: 'Current password is incorrect.', field: 'currentPassword' },
          { status: 400 }
        )
      }
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (newPassword) data.password = await bcrypt.hash(newPassword, 12)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: true })
    }

    await prisma.user.update({
      where: { id: sessionUser.id },
      data,
    })

    await logAudit({
      userId: sessionUser.id,
      action: 'profile.update',
      entityType: 'User',
      entityId: sessionUser.id,
      changes: {
        fields: Object.keys(data).filter((k) => k !== 'password'),
        changedPassword: !!newPassword,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
