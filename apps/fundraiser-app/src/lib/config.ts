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

/**
 * Light, Apple-style palette for the Liquid Glass look: dark text on frosted glass over a soft
 * ambient gradient, the system tint for actions, and green kept for money taken.
 */
export const colors = {
  accent: '#0A84FF',
  green: '#1E9E5A',
  text: '#1C1C1E',
  muted: '#6E6E73',
  border: 'rgba(60, 60, 67, 0.16)',
  background: '#F2F2F7',
  card: 'rgba(255, 255, 255, 0.72)',
  danger: '#E5484D',
  /** The ambient backdrop the glass refracts: warm at the top, cool at the bottom. */
  backdrop: ['#FFF3E6', '#F7EAF3', '#E7F0FC'] as const,
}
