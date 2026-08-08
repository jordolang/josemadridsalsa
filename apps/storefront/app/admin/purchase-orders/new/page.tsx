import Link from 'next/link'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { isNextControlFlowError } from '@/lib/next-errors'
import { PurchaseOrderForm } from '@/components/admin/PurchaseOrderForm'

export const metadata = { title: 'New purchase order | Jose Madrid Salsa Admin' }

export default async function NewPurchaseOrderPage() {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'products:write'))) {
      redirect('/admin')
    }

    const [suppliers, products] = await Promise.all([
      prisma.supplier.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        // Lowest stock first: the thing you are most likely to be reordering should be the
        // easiest to find in the list.
        orderBy: [{ inventory: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
          lowStockThreshold: true,
          costPrice: true,
        },
      }),
    ])

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/purchase-orders"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Purchase orders
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">New purchase order</h1>
          <p className="text-sm text-muted-foreground">
            Record what you are ordering. Stock only moves when you receive it.
          </p>
        </div>

        <PurchaseOrderForm
          suppliers={suppliers}
          products={products.map((product) => ({
            ...product,
            costPrice: product.costPrice ? Number(product.costPrice) : null,
          }))}
        />
      </div>
    )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error('New purchase order page error:', error)
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Could not load the purchase order form.</p>
      </div>
    )
  }
}
