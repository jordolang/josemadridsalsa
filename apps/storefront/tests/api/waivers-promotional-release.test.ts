import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}))

vi.mock('@/lib/rbac', () => ({
  getCurrentUser: vi.fn(),
  isStaff: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (pathname: string) => ({ pathname: `${pathname}-rand`, url: `https://blob.test/${pathname}` })),
}))

import { POST } from '@/app/api/waivers/promotional-release/route'
import { put } from '@vercel/blob'
import { getCurrentUser, isStaff } from '@/lib/rbac'

const staffUser = { id: 'u1', email: 'staff@example.com', name: 'Staff', role: 'ADMIN' as const }

function request(body: unknown) {
  return new NextRequest('http://localhost/api/waivers/promotional-release', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'iPad' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/waivers/promotional-release', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test'
    vi.mocked(getCurrentUser).mockResolvedValue(staffUser)
    vi.mocked(isStaff).mockReturnValue(true)
  })

  it('rejects requests without a staff session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(isStaff).mockReturnValue(false)
    const response = await POST(request({ fullName: 'Maria Lopez', decision: 'agree' }))
    expect(response.status).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })

  it('returns 422 for an invalid submission', async () => {
    const response = await POST(request({ fullName: 'Maria Lopez' }))
    expect(response.status).toBe(422)
    expect(put).not.toHaveBeenCalled()
  })

  it('returns 503 when Blob storage is not configured', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const response = await POST(request({ fullName: 'Maria Lopez', decision: 'agree' }))
    expect(response.status).toBe(503)
  })

  it('stores a PDF and a JSON record under waivers/promotional-release', async () => {
    const response = await POST(
      request({ fullName: 'Maria Lopez', decision: 'decline', event: 'Farmers Market' }),
    )
    expect(response.status).toBe(201)
    const data = (await response.json()) as { decision: string; pdfPathname: string }
    expect(data.decision).toBe('decline')

    expect(put).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(put).mock.calls
    const pdfCall = calls.find(([pathname]) => pathname.endsWith('.pdf'))
    const jsonCall = calls.find(([pathname]) => pathname.endsWith('.json'))
    expect(pdfCall?.[0]).toMatch(/^waivers\/promotional-release\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-decline-maria-lopez-[0-9a-f]{8}\.pdf$/)
    expect(pdfCall?.[2]).toMatchObject({ contentType: 'application/pdf', addRandomSuffix: true })

    const stored = JSON.parse(jsonCall?.[1] as string) as Record<string, unknown>
    expect(stored).toMatchObject({
      fullName: 'Maria Lopez',
      decision: 'decline',
      event: 'Farmers Market',
      collectedBy: 'staff@example.com',
      ipAddress: '203.0.113.7',
      userAgent: 'iPad',
    })
  })
})
