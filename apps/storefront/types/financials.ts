export type FinancialIntegration = {
  id: string
  serviceName: string
  label: string
  description: string
  docUrl: string
  features: string[]
  supportEmail?: string
}

export type FinancialIntegrationStatus = {
  id: string
  label: string
  isConnected: boolean
  lastSyncedAt?: string | null
  features: string[]
  docUrl: string
}
