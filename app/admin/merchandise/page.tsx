import Link from 'next/link'
import { ArrowRight, PlusCircle, RefreshCcw } from 'lucide-react'
import { adminMerchProducts, adminVendorCredentials, fulfillmentContact, merchCollections } from '@/lib/merchandise/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
      return 'bg-primary/10 text-primary border-border'
    case 'out-of-stock':
      return 'bg-muted text-muted-foreground border-border'
    case 'draft':
    default:
      return 'bg-muted text-foreground border-border'
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
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Merchandise</p>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Catalog & fulfillment</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
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

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Active</p>
          <p className="text-3xl font-semibold text-foreground">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Currently live in the storefront</p>
        </div>
        <Separator orientation="vertical" className="hidden sm:block" />
        <div>
          <p className="text-xs uppercase text-muted-foreground">Drafts</p>
          <p className="text-3xl font-semibold text-foreground">{draftCount}</p>
          <p className="text-xs text-muted-foreground">Awaiting mockups or pricing approval</p>
        </div>
        <Separator orientation="vertical" className="hidden sm:block" />
        <div>
          <p className="text-xs uppercase text-muted-foreground">Temporarily paused</p>
          <p className="text-3xl font-semibold text-foreground">{outOfStockCount}</p>
          <p className="text-xs text-muted-foreground">Out-of-stock or undergoing a production update</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground">Catalog sync</h2>
            <p className="text-sm text-muted-foreground">Review pricing, margin, and sync status for each merch item.</p>
          </div>
          <Button variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Sync now
          </Button>
        </header>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {tableHeaders.map((header) => (
                  <TableHead key={header} className="text-xs uppercase">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminMerchProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="text-foreground">
                    <div className="font-medium">{product.name}</div>
                    <p className="text-xs text-muted-foreground">
                      Margin target {Math.round((product.margin / product.retailPrice) * 100)}%
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                  <TableCell className="text-muted-foreground">{product.category}</TableCell>
                  <TableCell>
                    <Badge className={cn('capitalize', getStatusBadgeStyles(product.status))}>
                      {product.status.replace('-', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">{currencyFormatter.format(product.baseCost)}</TableCell>
                  <TableCell className="text-foreground">{currencyFormatter.format(product.retailPrice)}</TableCell>
                  <TableCell className="text-foreground">{currencyFormatter.format(product.margin)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatRelativeTimeFromNow(product.lastSyncedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-foreground">Vendor connections</h2>
          <p className="text-sm text-muted-foreground">
            Confirm the live integrations routing orders and inventory updates between the store and our printer.
          </p>
          <div className="space-y-3">
            {adminVendorCredentials.map((vendor) => (
              <div
                key={vendor.platform}
                className="flex flex-col gap-3 rounded-xl border border-border bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{vendor.platform}</p>
                  <p className="text-xs text-muted-foreground">
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
        <div className="space-y-4 rounded-2xl border border-border bg-muted/30 p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-foreground">Launch checklist</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {merchCollections.map((collection) => (
              <li key={collection.id} className="flex gap-3 rounded-xl border border-border bg-background p-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {collection.items.length}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{collection.title}</p>
                  <p className="text-xs text-muted-foreground">{collection.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <Button asChild className="w-full">
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
