import { fail } from '@/lib/api'
import { BlobUploadError } from '@/lib/blob-storage'
import { SalsadocsError } from '@/lib/developer/salsadocs'

/**
 * Translate errors thrown by developer console handlers into HTTP responses.
 * Returns null for unrecognized errors so callers can fall back to a
 * route-specific server error.
 */
export function developerApiErrorResponse(error: unknown) {
  if (error instanceof SalsadocsError || error instanceof BlobUploadError) {
    return fail(error.message, error.status)
  }
  if (error instanceof Error && error.message.includes('Unauthorized')) {
    return fail('Unauthorized', 401)
  }
  if (error instanceof Error && error.message.includes('Forbidden')) {
    return fail('Forbidden', 403)
  }
  return null
}
