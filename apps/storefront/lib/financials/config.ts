import type {
  FinancialIntegration,
  FinancialIntegrationStatus,
  PayrollEmployee,
  PayrollRun,
  ExpenseEntry,
  TaxTask,
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

export const payrollRuns: PayrollRun[] = [
  {
    id: 'run-jan-15',
    period: 'Jan 1 – Jan 15',
    payDate: '2025-01-18',
    grossPay: 12450,
    netPay: 10120,
    taxesWithheld: 2330,
    status: 'approved',
  },
  {
    id: 'run-dec-31',
    period: 'Dec 16 – Dec 31',
    payDate: '2024-12-31',
    grossPay: 11890,
    netPay: 9650,
    taxesWithheld: 2240,
    status: 'paid',
  },
]

export const payrollEmployees: PayrollEmployee[] = [
  {
    id: 'emp-jose',
    name: 'Jose Madrid',
    role: 'Founder',
    payType: 'salary',
    rate: 2600,
    hoursThisPeriod: 80,
    grossPay: 2600,
    taxes: 520,
    netPay: 2080,
  },
  {
    id: 'emp-sarah',
    name: 'Sarah Thompson',
    role: 'Operations Manager',
    payType: 'salary',
    rate: 1950,
    hoursThisPeriod: 80,
    grossPay: 1950,
    taxes: 390,
    netPay: 1560,
  },
  {
    id: 'emp-daniel',
    name: 'Daniel Wu',
    role: 'Production Lead',
    payType: 'hourly',
    rate: 24,
    hoursThisPeriod: 78,
    grossPay: 1872,
    taxes: 375,
    netPay: 1497,
  },
  {
    id: 'emp-maria',
    name: 'Maria Gomez',
    role: 'Market Manager',
    payType: 'hourly',
    rate: 21,
    hoursThisPeriod: 72,
    grossPay: 1512,
    taxes: 295,
    netPay: 1217,
  },
]

export const expenseQueue: ExpenseEntry[] = [
  {
    id: 'exp-0001',
    vendor: 'Columbus Print Co.',
    category: 'Marketing',
    amount: 482.5,
    submittedBy: 'Maria Gomez',
    status: 'submitted',
    submittedAt: '2025-01-05T14:30:00Z',
  },
  {
    id: 'exp-0002',
    vendor: 'Midwest Produce Distributors',
    category: 'Ingredients',
    amount: 1375.2,
    submittedBy: 'Daniel Wu',
    status: 'approved',
    submittedAt: '2025-01-07T10:05:00Z',
  },
  {
    id: 'exp-0003',
    vendor: 'FedEx Freight',
    category: 'Logistics',
    amount: 298.4,
    submittedBy: 'Sarah Thompson',
    status: 'reimbursed',
    submittedAt: '2024-12-28T09:15:00Z',
  },
]

export const taxPreparationTasks: TaxTask[] = [
  {
    id: 'tax-quarterly',
    label: 'File Q4 Ohio sales tax',
    dueDate: '2025-01-23',
    status: 'open',
    owner: 'Sarah Thompson',
    notes: 'Need sales tax summary from Shopify + wholesale invoices.',
  },
  {
    id: 'tax-941',
    label: 'Submit IRS Form 941',
    dueDate: '2025-01-31',
    status: 'open',
    owner: 'Jose Madrid',
    notes: 'ADP export ready for review.',
  },
  {
    id: 'tax-w2',
    label: 'Distribute W-2 to employees',
    dueDate: '2025-01-31',
    status: 'completed',
    owner: 'Sarah Thompson',
  },
  {
    id: 'tax-ohio-cat',
    label: 'Ohio Commercial Activity Tax payment',
    dueDate: '2025-02-10',
    status: 'overdue',
    owner: 'Finance Team',
    notes: 'Waiting on final review from accountant.',
  },
]

export const supportedUploadFormats = ['.csv', '.pdf', '.xlsx', '.xls', '.qif', '.ofx']
