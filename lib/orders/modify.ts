import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { logAudit } from '@/lib/audit'

export interface OrderModification {
  orderId: string
  userId: string
  updates: {
    items?: Array<{
      productId: string
      quantity: number
      unitPrice: number
    }>
    shippingAddress?: {
      street: string
      city: string
      state: string
      zipCode: string
      country?: string
    }
    status?: string
    shippingCost?: number
    notes?: string
  }
}

export async function modifyOrder(modification: OrderModification) {
  const { orderId, userId, updates } = modification

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shippingAddress: true,
    },
  })

  if (!order) {
    throw new Error('Order not found')
  }

  const changes: any = {
    before: {},
    after: {},
  }

  let subtotal = new Decimal(0)
  
  if (updates.items) {
    changes.before.items = order.items
    
    await prisma.orderItem.deleteMany({
      where: { orderId },
    })

    for (const item of updates.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      const itemTotal = new Decimal(item.unitPrice).mul(item.quantity)
      subtotal = subtotal.add(itemTotal)

      await prisma.orderItem.create({
        data: {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: itemTotal.toNumber(),
          productName: product?.name || 'Unknown',
          productSku: product?.sku || '',
          productImage: product?.featuredImage,
        },
      })
    }

    changes.after.items = updates.items
  } else {
    subtotal = order.subtotal as Decimal
  }

  const shippingCost = new Decimal(updates.shippingCost ?? order.shippingCost)
  const tax = order.tax as Decimal
  const discountAmount = order.discountAmount as Decimal
  const total = subtotal.add(shippingCost).add(tax).sub(discountAmount)

  const modificationHistory = (order.modificationHistory as any[]) || []
  modificationHistory.push({
    timestamp: new Date().toISOString(),
    userId,
    changes,
  })

  await prisma.order.update({
    where: { id: orderId },
    data: {
      subtotal: subtotal.toNumber(),
      shippingCost: shippingCost.toNumber(),
      total: total.toNumber(),
      modificationHistory: modificationHistory as any,
      adminNotes: updates.notes,
      ...(updates.status && { status: updates.status as any }),
    },
  })

  await logAudit({
    userId,
    action: 'order.modify',
    entityType: 'Order',
    entityId: orderId,
    changes,
  })

  return { success: true, orderId }
}
