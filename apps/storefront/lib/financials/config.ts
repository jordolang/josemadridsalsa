import type {
  FinancialIntegration,
  FinancialIntegrationStatus,
} from '@/types/financials'

export const financialIntegrations: FinancialIntegration[] = [
  {
    id: 'quickbooks',
    serviceName: 'quickbooks',
    label: 'QuickBooks Online',
    description: 'Sync invoices, expenses, and payroll entries directly to QuickBooks.',
    docUrl: 'https://quickbooks.intuit.com/app/apps/appdetails/jose-madrid-salsa',
    features: ['Two-way invoice sync', 'Expense categorization', 'Payroll journal export'],
    supportEmail: 'mike@josemadridsalsa.com',
  },
  {
    id: 'quicken',
    serviceName: 'quicken',
    label: 'Quicken',
    description: 'Export CSV and QIF files for Quicken desktop bookkeeping.',
    docUrl: 'https://www.quicken.com/support',
    features: ['Bank-style CSV downloads', 'Category mapping templates', 'Automatic daily exports'],
  },
  {
    id: 'xero',
    serviceName: 'xero',
    label: 'Xero',
    description: 'Push invoices, payments, and expense reimbursements into Xero in real time.',
    docUrl: 'https://www.xero.com/appstore/app/jose-madrid-salsa',
    features: ['Real-time invoice sync', 'Expense claims', 'GST/VAT tax mapping'],
  },
  {
    id: 'adp',
    serviceName: 'adp',
    label: 'ADP Workforce Now',
    description: 'Send approved payroll runs to ADP with taxed earnings and benefit deductions.',
    docUrl: 'https://www.adp.com/resources/support.aspx',
    features: ['Payroll export', 'Employee roster sync', 'Tax filing confirmations'],
  },
]

export function mapIntegrationStatus(
  connections: Array<{ serviceName: string; lastUsed: Date | null; isActive: boolean }>,
): FinancialIntegrationStatus[] {
  return financialIntegrations.map((integration) => {
    const record = connections.find((item) => item.serviceName === integration.serviceName && item.isActive)
    return {
      id: integration.id,
      label: integration.label,
      isConnected: Boolean(record),
      lastSyncedAt: record?.lastUsed ? record.lastUsed.toISOString() : null,
      features: integration.features,
      docUrl: integration.docUrl,
    }
  })
}

export const supportedUploadFormats = ['.csv', '.pdf', '.xlsx', '.xls', '.qif', '.ofx']
