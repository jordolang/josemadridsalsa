import { describe, it, expect } from 'vitest'
import * as financialsConfig from '@/lib/financials/config'
import { financialIntegrations, mapIntegrationStatus } from '@/lib/financials/config'

describe('financials config', () => {
  it('does not export fabricated payroll, expense, or tax data', () => {
    // These consoles must be backed by a real source (QuickBooks / paid orders) or an
    // honest empty state — never hardcoded mock rows presented as real business data.
    expect(financialsConfig).not.toHaveProperty('payrollRuns')
    expect(financialsConfig).not.toHaveProperty('payrollEmployees')
    expect(financialsConfig).not.toHaveProperty('expenseQueue')
    expect(financialsConfig).not.toHaveProperty('taxPreparationTasks')
  })

  it('keeps the real integration config the admin panel drives', () => {
    expect(financialIntegrations.map((i) => i.serviceName)).toContain('quickbooks')
    expect(financialIntegrations.every((i) => i.docUrl.startsWith('http'))).toBe(true)
  })
})

describe('mapIntegrationStatus', () => {
  it('marks an integration connected from its active service record', () => {
    const lastUsed = new Date('2026-01-05T10:00:00Z')
    const [status] = mapIntegrationStatus([
      { serviceName: 'quickbooks', lastUsed, isActive: true },
    ]).filter((s) => s.label === 'QuickBooks Online')

    expect(status.isConnected).toBe(true)
    expect(status.lastSyncedAt).toBe(lastUsed.toISOString())
  })

  it('reports unconnected when there is no matching record', () => {
    const [status] = mapIntegrationStatus([]).filter((s) => s.label === 'QuickBooks Online')
    expect(status.isConnected).toBe(false)
    expect(status.lastSyncedAt).toBeNull()
  })

  it('ignores inactive service records', () => {
    const [status] = mapIntegrationStatus([
      { serviceName: 'quickbooks', lastUsed: new Date(), isActive: false },
    ]).filter((s) => s.label === 'QuickBooks Online')

    expect(status.isConnected).toBe(false)
    expect(status.lastSyncedAt).toBeNull()
  })
})

describe('merchandise config', () => {
  it('does not export a fabricated admin catalog or vendor credentials', async () => {
    const merchConfig = await import('@/lib/merchandise/config')
    expect(merchConfig).not.toHaveProperty('adminMerchProducts')
    expect(merchConfig).not.toHaveProperty('adminVendorCredentials')
  })
})
