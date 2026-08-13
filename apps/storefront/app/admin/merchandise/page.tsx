import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { fulfillmentContact, merchCollections } from '@/lib/merchandise/config'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function AdminMerchandisePage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Merchandise</p>
          <h1 className="text-3xl font-serif font-semibold text-foreground">Catalog &amp; fulfillment</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Connect {fulfillmentContact.partnerName} to sync the merch catalog, margins, and
            fulfillment status into the Jose Madrid Salsa admin.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={fulfillmentContact.portalUrl} target="_blank" rel="noopener noreferrer">
              Open fulfillment portal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Badge className="bg-muted text-muted-foreground">Not connected</Badge>
        <h2 className="font-serif text-xl font-semibold text-foreground">
          The merch catalog is not connected yet
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Products, pricing, margins, and sync status are read from the fulfillment partner — none
          are entered or stored here. Once {fulfillmentContact.partnerName} is connected, the live
          catalog and vendor status will appear in this workspace.
        </p>
        <div>
          <Button asChild variant="default">
            <Link href={`mailto:${fulfillmentContact.email}?subject=Jose%20Madrid%20Merch%20Fulfillment%20Setup`}>
              Start fulfillment setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-muted/30 p-6 shadow-sm">
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">Planned collections</h2>
          <p className="text-sm text-muted-foreground">
            The collections staged for launch once the catalog is connected.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {merchCollections.map((collection) => (
            <li key={collection.id} className="rounded-xl border border-border bg-background p-4">
              <p className="font-semibold text-foreground">{collection.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{collection.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
