import { Package, Palette, Shirt, Truck } from 'lucide-react'
import type {
  MerchCollection,
  MerchHighlight,
  MerchProduct,
  MerchSetupStep,
  MerchVendorCredential,
} from '@/types/merchandise'

const printerContactEmail =
  process.env.NEXT_PUBLIC_FULFILLMENT_EMAIL ?? 'partner-support@josemadridsalsa.com'
const printerName =
  process.env.NEXT_PUBLIC_FULFILLMENT_PARTNER ?? 'SpiceLine Fulfillment'
const printerPortalUrl =
  process.env.NEXT_PUBLIC_FULFILLMENT_PORTAL_URL ?? 'https://portal.spicelinefulfillment.com'

export const merchCollections: MerchCollection[] = [
  {
    id: 'signature-apparel',
    title: 'Signature Apparel',
    description:
      'Soft-touch tees, embroidered aprons, and premium outerwear that put Jose Madrid front and center.',
    items: ['Vintage Logo Tee', 'Heat Index Crewneck', 'Embroidered Kitchen Apron'],
    accent: 'from-salsa-600/10 via-white to-white',
  },
  {
    id: 'event-gear',
    title: 'Event Gear',
    description:
      'Table displays, tasting kits, and signage sized for farmers markets, grocery demos, and fundraising booths.',
    items: ['Branded Tasting Flight', 'Collapsible Table Runner', 'Weatherproof Banner Stand'],
    accent: 'from-chile-600/10 via-white to-white',
  },
  {
    id: 'fan-accessories',
    title: 'Fan Accessories',
    description:
      'Drinkware, tote bags, and cooler packs that keep salsa lovers stocked between market visits.',
    items: ['Insulated Growler', 'Market Tote', 'Soft Cooler Pack'],
    accent: 'from-amber-500/10 via-white to-white',
  },
]

export const merchHighlights: MerchHighlight[] = [
  {
    id: 'ship-direct',
    title: 'Direct-to-customer shipping',
    description: `Orders route straight from ${printerName} to your supporters with live tracking links.`,
    icon: 'truck',
  },
  {
    id: 'inventory-sync',
    title: 'Automatic inventory sync',
    description: `${printerName} handles stock levels and variants so the storefront always reflects what is printable.`,
    icon: 'package',
  },
  {
    id: 'color-accurate',
    title: 'Color accurate proofs',
    description: 'Approve every design with hi-res proofs to keep the Jose Madrid palette consistent.',
    icon: 'palette',
  },
  {
    id: 'sample-program',
    title: 'Sample program ready',
    description: 'Request samples for retailers and fundraising hosts without leaving the portal.',
    icon: 'shirt',
  },
]

export const merchSetupSteps: MerchSetupStep[] = [
  {
    id: 'brand-kit',
    label: 'Upload brand kit files (logos, color palette, typography) for proofing.',
  },
  {
    id: 'collection-selection',
    label: 'Select the starter collections to launch (apparel, event gear, accessories).',
  },
  {
    id: 'portal-connection',
    label: `Connect your admin account to ${printerName} for catalog sync and sample ordering.`,
  },
  {
    id: 'go-live',
    label: 'Review pricing, margins, and shipping methods before publishing the catalog live.',
  },
]

export const adminMerchProducts: MerchProduct[] = [
  {
    id: 'prod-vintage-tee',
    sku: 'JM-TEE-VIN-RED',
    name: 'Vintage Logo Tee',
    category: 'Signature Apparel',
    status: 'active',
    baseCost: 14.5,
    retailPrice: 28,
    margin: 13.5,
    lastSyncedAt: '2025-01-06T09:15:00Z',
  },
  {
    id: 'prod-apron-embroidered',
    sku: 'JM-APR-EMB-BLK',
    name: 'Embroidered Kitchen Apron',
    category: 'Signature Apparel',
    status: 'active',
    baseCost: 18,
    retailPrice: 36,
    margin: 18,
    lastSyncedAt: '2025-01-06T09:15:00Z',
  },
  {
    id: 'prod-table-runner',
    sku: 'JM-TABLE-STD',
    name: 'Collapsible Table Runner',
    category: 'Event Gear',
    status: 'out-of-stock',
    baseCost: 29,
    retailPrice: 59,
    margin: 30,
    lastSyncedAt: '2025-01-05T21:42:00Z',
  },
  {
    id: 'prod-market-tote',
    sku: 'JM-TOTE-CANVAS',
    name: 'Market Tote',
    category: 'Fan Accessories',
    status: 'draft',
    baseCost: 11,
    retailPrice: 24,
    margin: 13,
    lastSyncedAt: '2025-01-04T16:10:00Z',
  },
]

export const adminVendorCredentials: MerchVendorCredential[] = [
  {
    platform: printerName,
    status: 'connected',
    lastChecked: '2025-01-06T09:20:00Z',
    actionLabel: 'Open portal',
    actionHref: printerPortalUrl,
  },
  {
    platform: 'SFTP Feed',
    status: 'pending',
    actionLabel: 'View instructions',
    actionHref: '/docs/merch-sftp-setup',
  },
]

export const fulfillmentContact = {
  email: printerContactEmail,
  partnerName: printerName,
  portalUrl: printerPortalUrl,
}

export const merchMediaShowcase = [
  {
    id: 'event-booth',
    title: 'Event booth kit',
    description: 'Table runner, tasting flight, and banner ready for fundraising nights or store demos.',
    image: '/images/products/cherry-mild.jpg',
  },
  {
    id: 'apparel-drop',
    title: 'Seasonal apparel drop',
    description: 'Garment-dyed tees with the 1982 Jose Madrid wordmark for superfans and team members.',
    image: '/images/salsa-bowl.jpg',
  },
  {
    id: 'retail-display',
    title: 'Retail display set',
    description: 'Shelf talkers, coasters, and hang tags to merchandise jars and swag together.',
    image: '/images/salsa-bowl.png',
  },
]

export const merchHighlightIconMap = {
  truck: Truck,
  package: Package,
  shirt: Shirt,
  palette: Palette,
} satisfies Record<MerchHighlight['icon'], typeof Truck>
