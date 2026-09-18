import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { ArrowLeft } from 'lucide-react'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { ReturnRequestForm } from '@/components/account/ReturnRequestForm'
import { isWithinReturnWindow, returnableQuantity, RETURN_WINDOW_DAYS } from '@/lib/orders/returns'

// User-specific order data: must never be statically cached.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Request a return | Jose Madrid Salsa' }

export default async function RequestReturnPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=/account/orders/${id}/return`)
  }

  // Scoped to the signed-in user, so another customer's order id is simply not found.
  const order = await prisma.order.findFirst({
    where: { id, userId: (session.user as { id: string }).id },
    select: {
      id: true,
      orderNumber: true,
      shippedAt: true,
      items: {
        select: {
          id: true,
          productName: true,
          productSku: true,
          quantity: true,
          quantityFulfilled: true,
          unitPrice: true,
          returnItems: {
            // A rejected or cancelled request releases its claim on those units.
            where: { returnRequest: { status: { notIn: ['REJECTED', 'CANCELLED'] } } },
            select: { quantity: true },
          },
        },
      },
    },
  })

  if (!order) notFound()

  const withinWindow = order.shippedAt ? isWithinReturnWindow(order.shippedAt) : false

  const returnable = order.items
    .map((item) => ({
      id: item.id,
      productName: item.productName,
      productSku: item.productSku,
      unitPrice: Number(item.unitPrice),
      returnable: returnableQuantity({
        id: item.id,
        quantity: item.quantity,
        quantityFulfilled: item.quantityFulfilled,
        unitPrice: Number(item.unitPrice),
        quantityReturned: item.returnItems.reduce((sum, r) => sum + r.quantity, 0),
      }),
    }))
    .filter((item) => item.returnable > 0)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href={`/account/orders/${order.id}`}>
          <ArrowLeft className="mr-1 size-4" />
          Order {order.orderNumber}
        </Link>
      </Button>

      <h1 className="text-2xl font-bold tracking-tight">Request a return</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Returns are accepted within {RETURN_WINDOW_DAYS} days of despatch. Tell us what
        you&apos;d like to send back and we&apos;ll take it from there.
      </p>

      <div className="mt-8">
        {!order.shippedAt ? (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            This order hasn&apos;t shipped yet, so there&apos;s nothing to return. If you need to
            change or cancel it, get in touch and we&apos;ll sort it out.
          </div>
        ) : !withinWindow ? (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            This order shipped more than {RETURN_WINDOW_DAYS} days ago, so it&apos;s outside our
            returns window. Contact us anyway — if something is wrong with your salsa we want to
            know.
          </div>
        ) : (
          <ReturnRequestForm
            orderId={order.id}
            orderNumber={order.orderNumber}
            items={returnable}
          />
        )}
      </div>
    </div>
  )
}
