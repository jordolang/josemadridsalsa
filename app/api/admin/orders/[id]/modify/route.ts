import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { modifyOrder } from '@/lib/orders/modify'
import { z } from 'zod'

const ModifyOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
  })).optional(),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().optional(),
  }).optional(),
  status: z.string().optional(),
  shippingCost: z.number().optional(),
  notes: z.string().optional(),
})

export async function PATCH(
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

    const body = await request.json()
    const validated = ModifyOrderSchema.parse(body)

    // Await params in Next.js 15+
    const { id } = await params

    const result = await modifyOrder({
      orderId: id,
      userId: (session.user as any).id,
      updates: validated,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Order modification error:', error)
    return NextResponse.json(
      { error: 'Failed to modify order' },
      { status: 500 }
    )
  }
}
