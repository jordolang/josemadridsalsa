import { describe, it, expect } from 'vitest'

import { developerApiErrorResponse } from '@/lib/developer/api-errors'
import { BlobUploadError } from '@/lib/blob-storage'
import { SalsadocsError } from '@/lib/developer/salsadocs'

describe('developerApiErrorResponse', () => {
  it('maps SalsadocsError to its HTTP status', () => {
    const res = developerApiErrorResponse(new SalsadocsError('not configured', 503))
    expect(res?.status).toBe(503)
  })

  it('maps BlobUploadError to its HTTP status', () => {
    const res = developerApiErrorResponse(new BlobUploadError('too large', 413))
    expect(res?.status).toBe(413)
  })

  it('maps RBAC unauthorized errors to 401', () => {
    const res = developerApiErrorResponse(new Error('Unauthorized - not authenticated'))
    expect(res?.status).toBe(401)
  })

  it('maps RBAC forbidden errors to 403', () => {
    const res = developerApiErrorResponse(new Error('Forbidden - requires permission: developer:blob'))
    expect(res?.status).toBe(403)
  })

  it('returns null for unrecognized errors', () => {
    expect(developerApiErrorResponse(new Error('boom'))).toBeNull()
    expect(developerApiErrorResponse('boom')).toBeNull()
  })
})
