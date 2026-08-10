import { prisma } from '@/lib/prisma'
import { NotificationType, Order } from '@prisma/client'
import { sendEmail } from '@/lib/email'

/**
 * The order-scoped notification types this helper knows how to render. Narrower than
 * NotificationType, which also carries inventory, payment and integration categories that
 * are dispatched through lib/notifications/dispatch.ts instead.
 */
export type OrderNotificationType = Extract<
  NotificationType,
  'ORDER_NEW' | 'ORDER_STATUS_CHANGE' | 'ORDER_HIGH_VALUE' | 'ORDER_MODIFIED' | 'SYSTEM'
>

export async function createOrderNotification(
  userId: string,
  type: OrderNotificationType,
  order: Order
): Promise<void> {
  const settings = await prisma.orderNotificationSetting.findUnique({
    where: { userId },
  })

  if (!settings) return

  const shouldNotify = {
    ORDER_NEW: settings.newOrderInApp,
    ORDER_STATUS_CHANGE: settings.orderStatusInApp,
    ORDER_HIGH_VALUE: settings.highValueInApp && order.total.toNumber() >= settings.highValueThreshold.toNumber(),
    ORDER_MODIFIED: true,
    SYSTEM: true,
  }[type]

  if (!shouldNotify) return

  const messages = {
    ORDER_NEW: {
      title: 'New Order Received',
      message: `Order #${order.orderNumber} - $${order.total}`,
    },
    ORDER_STATUS_CHANGE: {
      title: 'Order Status Updated',
      message: `Order #${order.orderNumber} is now ${order.status}`,
    },
    ORDER_HIGH_VALUE: {
      title: 'High Value Order',
      message: `Order #${order.orderNumber} - $${order.total} (Above threshold)`,
    },
    ORDER_MODIFIED: {
      title: 'Order Modified',
      message: `Order #${order.orderNumber} has been updated`,
    },
    SYSTEM: {
      title: 'System Notification',
      message: `Regarding order #${order.orderNumber}`,
    },
  }

  const { title, message } = messages[type]

  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      entityType: 'Order',
      entityId: order.id,
    },
  })

  const shouldEmail = {
    ORDER_NEW: settings.newOrderEmail,
    ORDER_STATUS_CHANGE: settings.orderStatusEmail,
    ORDER_HIGH_VALUE: settings.highValueEmail,
    ORDER_MODIFIED: false,
    SYSTEM: false,
  }[type]

  if (shouldEmail) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: title,
        html: `<p>${message}</p><p><a href="${process.env.NEXTAUTH_URL}/admin/orders/${order.id}">View Order</a></p>`,
      })
    }
  }
}

export async function notifyAdminsOfNewOrder(order: Order): Promise<void> {
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'ADMIN' },
        { role: 'DEVELOPER' },
      ],
    },
  })

  for (const admin of admins) {
    await createOrderNotification(admin.id, 'ORDER_NEW', order)

    if (order.total.toNumber() >= 100) {
      await createOrderNotification(admin.id, 'ORDER_HIGH_VALUE', order)
    }
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })
}
