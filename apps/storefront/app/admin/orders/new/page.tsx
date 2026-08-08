import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { ManualOrderForm } from '@/components/admin/ManualOrderForm'

/**
 * Record an order taken somewhere other than the website — over the phone, at a wholesale
 * table, at a festival stand. Prices, shipping and tax are entered rather than calculated,
 * because this records a deal that was already struck.
 */
export default async function NewOrderPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'orders:write'))) {
    redirect('/admin')
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, sku: true, price: true, inventory: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/orders">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Orders
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">New order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For sales taken by phone, at wholesale, or at an event. Stock comes out as soon as the
          order is saved, whether or not the money has arrived.
        </p>
      </div>

      <ManualOrderForm
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: Number(product.price),
          inventory: product.inventory,
        }))}
      />
    </div>
  )
}
