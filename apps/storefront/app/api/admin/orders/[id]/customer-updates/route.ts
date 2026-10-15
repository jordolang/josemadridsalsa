import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { hasPermission, type UserRole } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

const CustomerUpdateSchema = z.object({
  kind: z.enum(['NOTE', 'DELAY']),
  message: z.string().trim().min(1, 'Write a message.').max(1000, 'Keep it under 1,000 characters.'),
})

/** Post a note or delay that the customer sees on their order-tracking page. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const permitted = await hasPermission(session.user as unknown as { role: UserRole }, 'orders:write')
  if (!permitted) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CustomerUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update' }, { status: 400 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const userId = (session.user as { id: string }).id
  const update = await prisma.orderCustomerUpdate.create({
    data: { orderId: id, kind: parsed.data.kind, message: parsed.data.message, createdById: userId },
  })

  await logAudit({
    userId,
    action: 'create',
    entityType: 'order_customer_update',
    entityId: update.id,
    changes: { orderId: id, kind: parsed.data.kind },
  })

  return NextResponse.json({ update }, { status: 201 })
}
