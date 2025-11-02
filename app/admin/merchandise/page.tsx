import Link from 'next/link'
import { ArrowRight, PlusCircle, RefreshCcw } from 'lucide-react'
import { adminMerchProducts, adminVendorCredentials, fulfillmentContact, merchCollections } from '@/lib/merchandise/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const tableHeaders = ['Product', 'SKU', 'Category', 'Status', 'Base cost', 'Retail price', 'Margin', 'Last sync']

function formatRelativeTimeFromNow(isoDate: string) {
  const date = new Date(isoDate)
  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (absMs < minuteMs) {
    return 'Just now'
  }
  if (absMs < hourMs) {
    const minutes = Math.round(diffMs / minuteMs)
    return relativeTimeFormatter.format(minutes, 'minute')
  }
  if (absMs < dayMs) {
    const hours = Math.round(diffMs / hourMs)
    return relativeTimeFormatter.format(hours, 'hour')
  }
  const days = Math.round(diffMs / dayMs)
  return relativeTimeFormatter.format(days, 'day')
}

function getStatusBadgeStyles(status: 'draft' | 'active' | 'out-of-stock') {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'out-of-stock':
      return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export default function AdminMerchandisePage() {
  const activeCount = adminMerchProducts.filter((product) => product.status === 'active').length
  const draftCount = adminMerchProducts.filter((product) => product.status === 'draft').length
  const outOfStockCount = adminMerchProducts.filter((product) => product.status === 'out-of-stock').length

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-salsa-500">Merchandise</p>
          <h1 className="text-3xl font-serif font-semibold text-gray-900">Catalog & fulfillment</h1>
          <p className="text-sm text-gray-600 max-w-2xl">
            Monitor catalog sync, connect directly to {fulfillmentContact.partnerName}, and stage the next product drop
            without leaving the Jose Madrid Salsa admin.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={fulfillmentContact.portalUrl} target="_blank" rel="noopener noreferrer">
              Open fulfillment portal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="default">
            <PlusCircle className="mr-2 h-4 w-4" />
            New merch item
          </Button>
        </div>
      </header>

      <section className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-gray-500">Active</p>
          <p className="text-3xl font-semibold text-gray-900">{activeCount}</p>
          <p className="text-xs text-gray-500">Currently live in the storefront</p>
        </div>
        <Separator orientation="vertical" className="hidden sm:block" />
        <div>
          <p className="text-xs uppercase text-gray-500">Drafts</p>
          <p className="text-3xl font-semibold text-gray-900">{draftCount}</p>
          <p className="text-xs text-gray-500">Awaiting mockups or pricing approval</p>
        </div>
        <Separator orientation="vertical" className="hidden sm:block" />
        <div>
          <p className="text-xs uppercase text-gray-500">Temporarily paused</p>
          <p className="text-3xl font-semibold text-gray-900">{outOfStockCount}</p>
          <p className="text-xs text-gray-500">Out-of-stock or undergoing a production update</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-gray-900">Catalog sync</h2>
            <p className="text-sm text-gray-600">Review pricing, margin, and sync status for each merch item.</p>
          </div>
          <Button variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Sync now
          </Button>
        </header>
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                {tableHeaders.map((header) => (
                  <th key={header} scope="col" className="px-4 py-3 font-semibold tracking-wide">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {adminMerchProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">{product.name}</div>
                    <p className="text-xs text-gray-500">
                      Margin target {Math.round((product.margin / product.retailPrice) * 100)}%
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{product.sku}</td>
                  <td className="px-4 py-3 text-gray-600">{product.category}</td>
                  <td className="px-4 py-3">
                    <Badge className={cn('capitalize', getStatusBadgeStyles(product.status))}>
                      {product.status.replace('-', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{currencyFormatter.format(product.baseCost)}</td>
                  <td className="px-4 py-3 text-gray-900">{currencyFormatter.format(product.retailPrice)}</td>
                  <td className="px-4 py-3 text-gray-900">{currencyFormatter.format(product.margin)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatRelativeTimeFromNow(product.lastSyncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-gray-900">Vendor connections</h2>
          <p className="text-sm text-gray-600">
            Confirm the live integrations routing orders and inventory updates between the store and our printer.
          </p>
          <div className="space-y-3">
            {adminVendorCredentials.map((vendor) => (
              <div
                key={vendor.platform}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{vendor.platform}</p>
                  <p className="text-xs text-gray-500">
                    Status: <span className="capitalize">{vendor.status.replace('-', ' ')}</span>
                    {vendor.lastChecked ? ` • Checked ${formatRelativeTimeFromNow(vendor.lastChecked)}` : null}
                  </p>
                </div>
                <Button asChild variant={vendor.status === 'connected' ? 'outline' : 'default'} size="sm">
                  <Link href={vendor.actionHref}>{vendor.actionLabel}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-salsa-100 bg-gradient-to-br from-salsa-50 via-white to-chile-50 p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-salsa-700">Launch checklist</h2>
          <ul className="space-y-3 text-sm text-salsa-700">
            {merchCollections.map((collection) => (
              <li key={collection.id} className="flex gap-3 rounded-xl border border-salsa-100 bg-white/70 p-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-salsa-500 text-xs font-semibold text-white">
                  {collection.items.length}
                </div>
                <div>
                  <p className="font-semibold text-salsa-700">{collection.title}</p>
                  <p className="text-xs text-salsa-600">{collection.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <Button asChild className="w-full bg-salsa-600 hover:bg-salsa-700">
            <Link href={`mailto:${fulfillmentContact.email}?subject=Jose%20Madrid%20Merch%20Launch`}>
              Send updated catalog brief
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
