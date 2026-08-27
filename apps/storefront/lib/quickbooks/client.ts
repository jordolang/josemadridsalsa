import { getQuickBooksApiBaseUrl } from './config'
import { getValidAccessToken, markConnectionError } from './connection'

export class QuickBooksApiError extends Error {
  status: number
  detail: unknown
  /**
   * Intuit's per-request trace id. Their support team asks for this first when
   * troubleshooting, and it is only available on the response that failed — so
   * it is captured at the point of failure or lost for good.
   */
  intuitTid: string | null
  constructor(message: string, status: number, detail: unknown, intuitTid: string | null = null) {
    super(message)
    this.name = 'QuickBooksApiError'
    this.status = status
    this.detail = detail
    this.intuitTid = intuitTid
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  /** JSON body for writes (SalesReceipt, Customer, …). */
  body?: unknown
  /** Query params appended to the URL. */
  query?: Record<string, string>
}

/**
 * Authenticated request against the QuickBooks Online v3 API for the connected
 * company. Resolves a valid (auto-refreshed) access token, targets the right
 * realm + environment base URL, and surfaces QBO's structured errors.
 *
 * `path` is relative to the company resource, e.g. `companyinfo/{realmId}` or
 * `salesreceipt`. Do not include the `/v3/company/{realmId}` prefix.
 */
export async function quickBooksFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { accessToken, realmId, environment } = await getValidAccessToken()
  const base = getQuickBooksApiBaseUrl(environment)

  const url = new URL(`${base}/v3/company/${realmId}/${path.replace(/^\/+/, '')}`)
  // QBO requires minor version pinning to get stable response shapes.
  url.searchParams.set('minorversion', '75')
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await res.text()
  const data = text ? safeJsonParse(text) : null
  const intuitTid = res.headers.get('intuit_tid')

  if (!res.ok) {
    const message = extractErrorMessage(data) ?? `QuickBooks API error (${res.status})`
    if (res.status === 401) {
      await markConnectionError(realmId, message)
    }
    console.error('[quickbooks] request failed', {
      path,
      status: res.status,
      intuitTid,
      message,
    })
    throw new QuickBooksApiError(message, res.status, data ?? text, intuitTid)
  }

  return data as T
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const fault = (data as any).Fault ?? (data as any).fault
  const err = fault?.Error?.[0] ?? fault?.error?.[0]
  if (err) {
    return [err.Message ?? err.message, err.Detail ?? err.detail].filter(Boolean).join(' — ')
  }
  return null
}

export type QuickBooksCompanyInfo = {
  CompanyName: string
  LegalName?: string
  Country?: string
  Email?: { Address?: string }
}

/** Fetch the connected company's profile — the canonical "is it working" call. */
export async function getCompanyInfo(realmId: string): Promise<QuickBooksCompanyInfo> {
  const data = await quickBooksFetch<{ CompanyInfo: QuickBooksCompanyInfo }>(
    `companyinfo/${realmId}`,
  )
  return data.CompanyInfo
}

export type QuickBooksAccount = {
  Id: string
  Name: string
  /**
   * `Parent:Child` for a sub-account. QuickBooks lets several sub-accounts share a leaf `Name` —
   * this company has three separate accounts called "Refunds & discounts to customers" — so this
   * is the only field that tells them apart in a picker or an export.
   */
  FullyQualifiedName?: string
  AccountType: string
  AccountSubType?: string
}

export type QuickBooksItem = { Id: string; Name: string; Sku?: string }

/** Active accounts, for the chart-of-accounts mapping dropdowns. */
export async function listAccounts(): Promise<QuickBooksAccount[]> {
  const data = await quickBooksFetch<{ QueryResponse: { Account?: QuickBooksAccount[] } }>(
    'query',
    { query: { query: 'select * from Account where Active = true maxresults 500' } },
  )
  return data?.QueryResponse?.Account ?? []
}

/** Active items, for picking the shipping line item. */
export async function listItems(): Promise<QuickBooksItem[]> {
  const data = await quickBooksFetch<{ QueryResponse: { Item?: QuickBooksItem[] } }>('query', {
    query: { query: 'select * from Item where Active = true maxresults 500' },
  })
  return data?.QueryResponse?.Item ?? []
}
