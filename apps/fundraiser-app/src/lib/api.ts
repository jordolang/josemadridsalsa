import * as SecureStore from 'expo-secure-store'
import { API_URL } from './config'

const TOKEN_KEY = 'jms.fundraiser.deviceToken'

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
}

/** A failure the server explained. `code` says whether to send the seller to setup or the PIN pad. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: 'signed_out' | 'locked' | 'group_closed'
  ) {
    super(message)
  }
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; token?: string | null } = {}
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api/fundraiser-app${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError('No connection. Check your internet and try again.', 0)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(data.error ?? 'Something went wrong. Please try again.', response.status, data.code)
  }
  return data as T
}

// Shapes the server sends back (apps/storefront/lib/fundraiser-app).

export interface Group {
  id: string
  name: string
  organizationName: string
  logoUrl: string | null
  startDate: string
  endDate: string
}

export interface Me {
  seller: {
    id: string
    name: string
    firstName: string | null
    lastName: string | null
    referralCode: string
    isOrganizer: boolean
  }
  group: Group & { cardPayments: boolean }
  stats: { orders: number; sales: number }
}

export interface SignIn {
  token: string
  group: Group
  sellerId: string
}

export interface RosterEntry {
  id: string
  name: string
  hasPin: boolean
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  heatLevel: string
}

export interface OrderSummary {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  paid: boolean
  paymentMethod: string | null
  total: number
  customerName: string | null
  customerPhone: string | null
  items: { productName: string; quantity: number }[]
}

export interface GroupSeller {
  id: string
  name: string
  active: boolean
  hasPin: boolean
  lockedOut: boolean
  devices: number
  lastSeenAt: string | null
  isOrganizer: boolean
  orders: number
  sales: number
}

export const money = (value: number) => `$${value.toFixed(2)}`
