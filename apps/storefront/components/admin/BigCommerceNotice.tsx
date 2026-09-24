import { ExternalLink, Store } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { findBigCommerceStore } from '@/lib/bigcommerce/config'
import { isBigCommerceStorefrontEnabled } from '@/lib/bigcommerce/storefront'

/**
 * Tells staff which half of a record lives in BigCommerce once the storefront
 * sells through it, so nobody edits a price here and wonders why the site did
 * not change. Renders nothing until the storefront is switched over.
 */

export type BigCommerceNoticeArea = 'products' | 'inventory' | 'orders' | 'customers' | 'gift-certificates'

const NOTICES: Record<BigCommerceNoticeArea, { body: string; path: string; linkLabel: string }> = {
  products: {
    body: 'Prices, stock, sale prices, bundle options and which products are for sale are managed in BigCommerce. Photos, heat level, nutrition, ingredients and descriptions are still edited here.',
    path: 'products',
    linkLabel: 'Open products in BigCommerce',
  },
  inventory: {
    body: 'Stock for everything sold online is managed in BigCommerce, which updates it as orders come in. Counts here only cover products BigCommerce does not sell.',
    path: 'products',
    linkLabel: 'Open products in BigCommerce',
  },
  orders: {
    body: 'Retail orders are placed, paid and fulfilled in BigCommerce. This list shows fundraiser orders and anything taken on this site’s own checkout.',
    path: 'orders',
    linkLabel: 'Open orders in BigCommerce',
  },
  customers: {
    body: 'Retail customer accounts, addresses and order history live in BigCommerce. This list covers contacts collected by this site.',
    path: 'customers',
    linkLabel: 'Open customers in BigCommerce',
  },
  'gift-certificates': {
    body: 'Gift certificates redeemed at checkout are the ones issued in BigCommerce. Certificates listed here only work on this site’s own checkout.',
    path: 'marketing',
    linkLabel: 'Open marketing in BigCommerce',
  },
}

export function bigCommerceAdminUrl(storeHash: string, path: string): string {
  return `https://store-${storeHash}.mybigcommerce.com/manage/${path}`
}

export function BigCommerceNotice({ area }: { area: BigCommerceNoticeArea }) {
  const store = findBigCommerceStore('main')
  if (!store || !isBigCommerceStorefrontEnabled()) return null
  const notice = NOTICES[area]

  return (
    <Alert>
      <Store className="h-4 w-4" />
      <AlertTitle>Managed in BigCommerce</AlertTitle>
      <AlertDescription>
        <p>{notice.body}</p>
        <a
          href={bigCommerceAdminUrl(store.storeHash, notice.path)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          {notice.linkLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </AlertDescription>
    </Alert>
  )
}
