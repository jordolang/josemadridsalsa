import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission, isOwner } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

const userUpdateSchema = z.object({
  name: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(['CUSTOMER', 'WHOLESALE', 'STAFF', 'ADMIN', 'DEVELOPER', 'OWNER']).optional(),
  isEmailVerified: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('users:read')
    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { id },
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requirePermission('users:write')
    const body = await req.json()
    const data = userUpdateSchema.parse(body)
    const { id } = await params

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return fail('User not found', 404)

    // OWNER protection: cannot change an OWNER's role unless you are the OWNER
    if (existing.role === UserRole.OWNER && !isOwner(currentUser)) {
      return fail('Only the OWNER can modify the OWNER account', 403)
    }

    // Prevent assigning OWNER role unless current user is OWNER
    if (data.role === 'OWNER' && !isOwner(currentUser)) {
      return fail('Only the OWNER can assign the OWNER role', 403)
    }

    // If transferring OWNER role to someone else, ensure only one OWNER
    if (data.role === 'OWNER' && existing.role !== UserRole.OWNER) {
      const existingOwner = await prisma.user.findFirst({
        where: { role: UserRole.OWNER, id: { not: id } },
      })
      if (existingOwner) {
        return fail(
          'An OWNER account already exists. Only one OWNER is allowed.',
          409
        )
      }
    }

    // Hash password if provided
    const updateData: any = { ...data }
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }

    const user = await prisma.user.update({
      where: { id },
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requirePermission('users:write')
    const { id } = await params

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return fail('User not found', 404)

    // Prevent deleting yourself
    if (existing.id === currentUser.id) {
      return fail('Cannot delete your own account', 400)
    }

    // OWNER protection: cannot delete the OWNER account unless you are the OWNER
    if (existing.role === UserRole.OWNER && !isOwner(currentUser)) {
      return fail('Only the OWNER can delete the OWNER account', 403)
    }

    await prisma.user.delete({ where: { id } })

    await logAudit({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'User',
      entityId: id,
      changes: { email: existing.email },
    })

    return ok({ message: 'User deleted' })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}
