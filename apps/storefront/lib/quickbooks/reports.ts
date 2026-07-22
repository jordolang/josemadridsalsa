import { quickBooksFetch } from './client'

/**
 * Reading financial reports back out of QuickBooks.
 *
 * QBO is the source of truth for expenses, bills and the P&L — the mirror image
 * of the sales sync, which pushes the other way. The parsing here is kept pure
 * and separate from the fetch so the report shape, which is deeply nested and
 * easy to get wrong, can be tested against fixtures.
 */

export interface ProfitAndLossLine {
  name: string
  /** QBO account id, when the row carries one. */
  accountId: string | null
  amount: number
}

export interface ProfitAndLossSection {
  /** QBO's group key: Income, COGS, GrossProfit, Expenses, NetIncome, … */
  group: string
  title: string
  lines: ProfitAndLossLine[]
  total: number
}

export interface ProfitAndLoss {
  startDate: string
  endDate: string
  currency: string
  sections: ProfitAndLossSection[]
  /** Section group -> summary total, for headline figures. */
  totals: Record<string, number>
}

/**
 * QBO report money arrives as a string, blank for "no value". A blank is zero,
 * but an unparseable value is not — that would quietly turn a real figure into
 * nothing, so it also lands as 0 only after failing an explicit numeric check.
 */
export function parseReportAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const trimmed = value.trim().replace(/[$,]/g, '')
  if (!trimmed) return 0
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : 0
}

interface RawColData {
  value?: string
  id?: string
}

interface RawRow {
  type?: string
  group?: string
  Header?: { ColData?: RawColData[] }
  Summary?: { ColData?: RawColData[] }
  Rows?: { Row?: RawRow[] }
  ColData?: RawColData[]
}

/** Depth-first collection of the leaf data rows beneath a section. */
function collectLines(rows: RawRow[] | undefined): ProfitAndLossLine[] {
  if (!Array.isArray(rows)) return []

  const lines: ProfitAndLossLine[] = []
  for (const row of rows) {
    if (Array.isArray(row.ColData) && row.ColData.length > 0) {
      const [label, ...rest] = row.ColData
      const name = label?.value?.trim()
      if (name) {
        lines.push({
          name,
          accountId: label?.id ?? null,
          // The last column holds the total; single-period reports have one.
          amount: parseReportAmount(rest[rest.length - 1]?.value),
        })
      }
    }

    // Nested subsections (e.g. expense categories with children) flatten in.
    if (row.Rows?.Row) {
      lines.push(...collectLines(row.Rows.Row))
    }
  }
  return lines
}

function sectionTitle(row: RawRow, fallback: string): string {
  return row.Header?.ColData?.[0]?.value?.trim() || fallback
}

function sectionTotal(row: RawRow): number {
  const summary = row.Summary?.ColData
  if (!Array.isArray(summary) || summary.length === 0) return 0
  return parseReportAmount(summary[summary.length - 1]?.value)
}

/**
 * Flatten a QBO ProfitAndLoss report into sections plus headline totals.
 *
 * Tolerant by design: an unfamiliar or reordered report still yields whatever
 * sections it does contain rather than throwing, because a partial P&L is more
 * useful than an error page.
 */
export function parseProfitAndLoss(report: unknown): ProfitAndLoss {
  const raw = (report ?? {}) as {
    Header?: { StartPeriod?: string; EndPeriod?: string; Currency?: string }
    Rows?: { Row?: RawRow[] }
  }

  const sections: ProfitAndLossSection[] = []
  const totals: Record<string, number> = {}

  for (const row of raw.Rows?.Row ?? []) {
    const group = row.group
    if (!group) continue

    const total = sectionTotal(row)
    totals[group] = total

    // Rows like GrossProfit and NetIncome are summary-only: a total with no
    // detail beneath it. They belong in `totals`, not as empty sections.
    const lines = collectLines(row.Rows?.Row)
    if (lines.length > 0) {
      sections.push({ group, title: sectionTitle(row, group), lines, total })
    }
  }

  return {
    startDate: raw.Header?.StartPeriod ?? '',
    endDate: raw.Header?.EndPeriod ?? '',
    currency: raw.Header?.Currency ?? 'USD',
    sections,
    totals,
  }
}

/** `YYYY-MM-DD` in local time, which is what the report endpoints expect. */
export function toReportDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Fetch and flatten the P&L for a date range. */
export async function getProfitAndLoss(start: Date, end: Date): Promise<ProfitAndLoss> {
  const report = await quickBooksFetch('reports/ProfitAndLoss', {
    query: {
      start_date: toReportDate(start),
      end_date: toReportDate(end),
      accounting_method: 'Accrual',
    },
  })
  return parseProfitAndLoss(report)
}

export interface QuickBooksExpense {
  id: string
  date: string
  vendor: string | null
  account: string | null
  total: number
  paymentType: string | null
}

interface RawPurchase {
  Id: string
  TxnDate?: string
  TotalAmt?: number | string
  PaymentType?: string
  EntityRef?: { name?: string }
  AccountRef?: { name?: string }
}

/**
 * Recent expenses (QBO Purchase records). Expenses are QBO's to own — including
 * anything captured through its native receipt capture — so this only reads.
 */
export async function listRecentExpenses(limit = 25): Promise<QuickBooksExpense[]> {
  const data = await quickBooksFetch<{ QueryResponse?: { Purchase?: RawPurchase[] } }>('query', {
    query: {
      query: `select * from Purchase orderby TxnDate desc maxresults ${Math.min(limit, 100)}`,
    },
  })

  return (data?.QueryResponse?.Purchase ?? []).map((purchase) => ({
    id: purchase.Id,
    date: purchase.TxnDate ?? '',
    vendor: purchase.EntityRef?.name ?? null,
    account: purchase.AccountRef?.name ?? null,
    total: parseReportAmount(purchase.TotalAmt),
    paymentType: purchase.PaymentType ?? null,
  }))
}
