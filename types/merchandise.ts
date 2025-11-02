export type MerchCollection = {
  id: string
  title: string
  description: string
  items: string[]
  accent?: string
}

export type MerchHighlight = {
  id: string
  title: string
  description: string
  icon: 'truck' | 'package' | 'shirt' | 'palette'
}

export type MerchSetupStep = {
  id: string
  label: string
}

export type MerchProduct = {
  id: string
  sku: string
  name: string
  category: string
  status: 'draft' | 'active' | 'out-of-stock'
  baseCost: number
  retailPrice: number
  margin: number
  lastSyncedAt: string
}

export type MerchVendorCredential = {
  platform: string
  status: 'connected' | 'pending' | 'not-connected'
  lastChecked?: string
  actionLabel: string
  actionHref: string
}
