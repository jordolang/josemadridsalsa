import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getMerchCatalog } from '@/lib/merchandise/catalog'
import { formatPrice, formatPriceRange } from '@/lib/merchandise/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const STATUS_LABELS = {
  AWAITING_PAYMENT: 'Awaiting payment',
  SUBMITTING: 'Sending to Printify',
  SUBMITTED: 'Sent to Printify',
  FAILED: 'Printify refused',
  EXPIRED: 'Never paid',
} as const

export default async function AdminMerchandisePage() {
  const [catalog, orders] = await Promise.all([
    getMerchCatalog(),
    prisma.merchOrder.findMany({
      where: { status: { not: 'EXPIRED' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Merchandise</p>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Printify merch</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Products, prices and photos come from the Printify shop. Edit them in Printify and the site picks up
            the change within five minutes. Paid orders are sent to Printify to print and ship.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="https://printify.com/app/store/products" target="_blank" rel="noopener noreferrer">
              Open Printify
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/merchandise" target="_blank">
              View merch page
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        {catalog.status === 'ok' ? (
          <>
            <Badge className="bg-green-100 text-green-800">Connected</Badge>
            <h2 className="font-serif text-xl font-semibold text-foreground">
              {catalog.products.length} {catalog.products.length === 1 ? 'product' : 'products'} for sale
            </h2>
            <ul className="divide-y divide-border">
              {catalog.products.map((product) => (
                <li key={product.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/merchandise/${product.id}`} className="font-medium hover:underline" target="_blank">
                    {product.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {product.variants.length} options · {formatPriceRange(product)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : catalog.status === 'not-configured' ? (
          <>
            <Badge className="bg-muted text-muted-foreground">Not connected</Badge>
            <h2 className="font-serif text-xl font-semibold text-foreground">Printify is not connected</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Add <code>PRINTIFY_API_TOKEN</code> (and optionally <code>PRINTIFY_SHOP_ID</code>) to the storefront&apos;s
              Vercel environment variables, then redeploy. Until then the merch page shows a coming-soon message.
            </p>
          </>
        ) : (
          <>
            <Badge className="bg-red-100 text-red-800">Error</Badge>
            <h2 className="font-serif text-xl font-semibold text-foreground">Printify could not be reached</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Check that the API token is still valid in Printify. The server log has the exact error.
            </p>
          </>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-foreground">Recent merch orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No merch orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Placed</th>
                  <th className="py-2 pr-4 font-medium">Customer</th>
                  <th className="py-2 pr-4 font-medium">Items</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const items = order.items as { title: string; variantTitle: string; quantity: number }[]
                  return (
                    <tr key={order.id} className="align-top">
                      <td className="py-2 pr-4 whitespace-nowrap">{order.createdAt.toLocaleString('en-US')}</td>
                      <td className="py-2 pr-4">
                        {order.customerName ?? '—'}
                        {order.customerEmail ? (
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4">
                        {items.map((item) => `${item.quantity} × ${item.title} (${item.variantTitle})`).join(', ')}
                      </td>
                      <td className="py-2 pr-4">{formatPrice(order.totalCents)}</td>
                      <td className="py-2 pr-4">
                        {STATUS_LABELS[order.status]}
                        {order.status === 'FAILED' && order.lastError ? (
                          <div className="max-w-xs text-xs text-red-600">{order.lastError}</div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
