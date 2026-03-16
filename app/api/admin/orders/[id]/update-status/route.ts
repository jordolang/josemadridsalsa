import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const UpdateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  adminNote: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permitted = await hasPermission(session.user as any, 'orders:write')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, adminNote } = UpdateStatusSchema.parse(body)

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const previousStatus = order.status

    const updateData: any = { status }
    if (status === 'SHIPPED' && !order.shippedAt) updateData.shippedAt = new Date()
    if (status === 'DELIVERED' && !order.deliveredAt) updateData.deliveredAt = new Date()
    if (adminNote) updateData.adminNotes = adminNote

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      userId: (session.user as any).id,
      action: 'update',
      entityType: 'order',
      entityId: id,
      changes: { status: { from: previousStatus, to: status }, adminNote },
    })

    return NextResponse.json({ success: true, status: updated.status })
  } catch (error) {
    console.error('Update order status error:', error)
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }
}
