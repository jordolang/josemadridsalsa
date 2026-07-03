/**
 * Registry of third-party product feed destinations.
 *
 * Client-safe (plain data, no server imports) so the admin Feeds UI and the
 * /api/feeds/[platform] route share one source of truth. Each entry describes
 * where the feed goes and how the merchant wires it up on the destination.
 */

export type FeedPlatformId =
  | 'facebook'
  | 'google-shopping'
  | 'amazon'
  | 'microsoft-bing'
  | 'pinterest'

export type FeedFormat = 'csv' | 'tsv' | 'xml'

export type FeedPlatformInfo = {
  id: FeedPlatformId
  label: string
  description: string
  format: FeedFormat
  filename: string
  /** Relative URL of the feed endpoint. */
  path: string
  /** How the feed reaches the platform. */
  delivery: 'scheduled-url' | 'file-upload'
  /** Step-by-step wiring instructions shown in the admin UI. */
  setup: string[]
}

export const FEED_PLATFORMS: FeedPlatformInfo[] = [
  {
    id: 'facebook',
    label: 'Facebook & Instagram Shops',
    description:
      'Meta Commerce catalog feed powering Facebook Shop and Instagram Shopping. Also used for dynamic ads.',
    format: 'csv',
    filename: 'facebook-catalog-feed.csv',
    path: '/api/feeds/facebook',
    delivery: 'scheduled-url',
    setup: [
      'Open Meta Commerce Manager → Catalog → Data sources',
      'Choose "Data feed" → "Use a URL" (scheduled feed)',
      'Paste the feed URL and set an hourly or daily schedule',
      'Meta re-fetches automatically and keeps prices and inventory in sync',
    ],
  },
  {
    id: 'google-shopping',
    label: 'Google Shopping',
    description:
      'Google Merchant Center feed for free listings and Shopping ads. Add ?format=tsv for the tab-delimited variant.',
    format: 'xml',
    filename: 'google-shopping-feed.xml',
    path: '/api/feeds/google-shopping',
    delivery: 'scheduled-url',
    setup: [
      'Open Google Merchant Center → Products → Feeds → Add feed',
      'Choose "Scheduled fetch" and paste the feed URL',
      'Set the fetch frequency (daily is typical)',
      'Products appear in free listings once the account is verified',
    ],
  },
  {
    id: 'amazon',
    label: 'Amazon',
    description:
      'Amazon Inventory Loader flat file. Matches products to Amazon’s catalog by UPC and sets your price and quantity.',
    format: 'tsv',
    filename: 'amazon-inventory-loader.txt',
    path: '/api/feeds/amazon',
    delivery: 'file-upload',
    setup: [
      'Download the flat file below',
      'Open Seller Central → Catalog → Add Products via Upload',
      'Upload the file as an Inventory Loader feed',
      'Amazon matches rows to existing ASINs by UPC; products without a UPC only update SKUs already in your account',
      'Prefer push-style syncing? Use the Shops tab — with SP-API credentials configured, listings sync directly via the Selling Partner API',
    ],
  },
  {
    id: 'microsoft-bing',
    label: 'Microsoft (Bing) Shopping',
    description:
      'Microsoft Merchant Center accepts the Google-format feed as-is, so this endpoint serves the same catalog.',
    format: 'xml',
    filename: 'microsoft-shopping-feed.xml',
    path: '/api/feeds/microsoft-bing',
    delivery: 'scheduled-url',
    setup: [
      'Open Microsoft Merchant Center → Feeds → Create feed',
      'Choose "Download from URL" and paste the feed URL',
      'Set the download schedule',
    ],
  },
  {
    id: 'pinterest',
    label: 'Pinterest Catalogs',
    description:
      'Pinterest Catalogs also ingests the Google-format feed, turning products into shoppable Pins.',
    format: 'xml',
    filename: 'pinterest-catalog-feed.xml',
    path: '/api/feeds/pinterest',
    delivery: 'scheduled-url',
    setup: [
      'Open Pinterest Business Hub → Catalogs → Add data source',
      'Paste the feed URL and choose the update frequency',
      'Requires a claimed website on the Pinterest business account',
    ],
  },
]
