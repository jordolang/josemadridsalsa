/**
 * Product photos are stored as site paths (`/images/...`); the phone needs the full address.
 * Kept free of imports so the storefront's test suite can cover it (the app has no test runner).
 */
export function joinImageUrl(base: string, path: string | null | undefined): string | null {
  if (!path) return null
  return /^https?:\/\//.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`
}
