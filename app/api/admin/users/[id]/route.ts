import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const userUpdateSchema = z.object({
  name: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(['CUSTOMER', 'WHOLESALE', 'STAFF', 'ADMIN', 'DEVELOPER']).optional(),
  isEmailVerified: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePermission('users:read')
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        isEmailVerified: true,
        dateOfBirth: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    })
    if (!user) return fail('User not found', 404)
    return ok({ user })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requirePermission('users:write')
    const body = await req.json()
    const data = userUpdateSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { id: params.id } })
    if (!existing) return fail('User not found', 404)

    // Hash password if provided
    const updateData: any = { ...data }
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    })

    await logAudit({
      userId: currentUser.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      changes: data,
    })

    // Don't return password
    const { password, ...userWithoutPassword } = user

    return ok({ user: userWithoutPassword })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requirePermission('users:write')

    const existing = await prisma.user.findUnique({ where: { id: params.id } })
    if (!existing) return fail('User not found', 404)

    // Prevent deleting yourself
    if (existing.id === currentUser.id) {
      return fail('Cannot delete your own account', 400)
    }

    await prisma.user.delete({ where: { id: params.id } })

    await logAudit({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'User',
      entityId: params.id,
      changes: { email: existing.email },
    })

    return ok({ message: 'User deleted' })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}
