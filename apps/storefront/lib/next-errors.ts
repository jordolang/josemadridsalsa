/**
 * Next.js implements `redirect()` and `notFound()` by throwing a specially tagged error and
 * catching it higher up. A `try/catch` around a Server Component body will therefore
 * intercept them, and re-throwing a plain `new Error(...)` strips the tag — turning an
 * intended redirect into a render failure.
 *
 * Any catch-all in a Server Component must let these through untouched.
 */

const NEXT_CONTROL_FLOW_DIGESTS = ['NEXT_REDIRECT', 'NEXT_NOT_FOUND', 'NEXT_HTTP_ERROR_FALLBACK']

export function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  // Modern Next tags these on `digest`; older versions used the message.
  const digest = (error as { digest?: unknown }).digest
  if (typeof digest === 'string') {
    return NEXT_CONTROL_FLOW_DIGESTS.some((d) => digest.startsWith(d))
  }

  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && NEXT_CONTROL_FLOW_DIGESTS.includes(message)
}
