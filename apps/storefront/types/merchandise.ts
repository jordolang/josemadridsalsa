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
