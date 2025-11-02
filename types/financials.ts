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

export type PayrollRun = {
  id: string
  period: string
  payDate: string
  grossPay: number
  netPay: number
  taxesWithheld: number
  status: 'draft' | 'approved' | 'paid'
}

export type PayrollEmployee = {
  id: string
  name: string
  role: string
  payType: 'hourly' | 'salary'
  rate: number
  hoursThisPeriod: number
  grossPay: number
  taxes: number
  netPay: number
}

export type ExpenseEntry = {
  id: string
  vendor: string
  category: string
  amount: number
  submittedBy: string
  status: 'submitted' | 'approved' | 'reimbursed'
  submittedAt: string
}

export type TaxTask = {
  id: string
  label: string
  dueDate: string
  status: 'open' | 'completed' | 'overdue'
  owner: string
  notes?: string
}
