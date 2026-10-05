/**
 * Whether a failed save may still have been recorded: no answer at all (no connection, status 0)
 * or a server error. A 4xx answer means the server refused it, so nothing was saved.
 * Kept free of imports so the storefront's test suite can cover it (the app has no test runner).
 */
export function mayHaveSaved(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status !== 'number' || status === 0 || status >= 500
}
