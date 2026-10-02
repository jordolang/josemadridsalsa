import Constants from 'expo-constants'

/**
 * The Jose Madrid site the app talks to. Production by default; set EXPO_PUBLIC_API_URL to point
 * a development build at a local storefront (e.g. http://192.168.1.20:3000).
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'https://www.josemadrid.net'

/** Product photos are stored as site paths (`/images/...`); the phone needs the full address. */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

/** How long the app may sit in the background (say, while the seller dials a customer) before it asks for the PIN again. */
export const RELOCK_AFTER_MS = 2 * 60 * 1000

export const colors = {
  brand: '#B91C1C',
  brandDark: '#7F1D1D',
  green: '#15803D',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  background: '#F9FAFB',
  card: '#FFFFFF',
  danger: '#DC2626',
}
