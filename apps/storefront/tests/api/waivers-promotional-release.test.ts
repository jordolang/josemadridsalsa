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
  list: vi.fn(),
}))

import { GET } from '@/app/api/waivers/promotional-release/log/route'
import { POST } from '@/app/api/waivers/promotional-release/route'
import { list, put } from '@vercel/blob'
import { getCurrentUser, isStaff } from '@/lib/rbac'

const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const GPS = { latitude: 39.94, longitude: -82.01, accuracyMeters: 12, capturedAt: '2026-09-24T16:29:55.000Z' }

const staffUser = { id: 'u1', email: 'staff@example.com', name: 'Staff', role: 'ADMIN' as const }

function request(body: unknown) {
  return new NextRequest('http://localhost/api/waivers/promotional-release', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      'user-agent': 'iPad',
      'x-vercel-ip-city': 'Zanesville',
      'x-vercel-ip-country-region': 'OH',
      'x-vercel-ip-country': 'US',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test'
  vi.mocked(getCurrentUser).mockResolvedValue(staffUser)
  vi.mocked(isStaff).mockReturnValue(true)
})

describe('POST /api/waivers/promotional-release', () => {
  it('rejects requests without a staff session', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(isStaff).mockReturnValue(false)
    const response = await POST(request({ decision: 'agree', signature: SIGNATURE }))
    expect(response.status).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })

  it('returns 422 for an agreement without a signature', async () => {
    const response = await POST(request({ decision: 'agree' }))
    expect(response.status).toBe(422)
    expect(put).not.toHaveBeenCalled()
  })

  it('returns 503 when Blob storage is not configured', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const response = await POST(request({ decision: 'agree', signature: SIGNATURE }))
    expect(response.status).toBe(503)
  })

  it('stores the PDF, then a JSON log entry that points at it', async () => {
    const response = await POST(
      request({
        fullName: 'Maria Lopez',
        decision: 'agree',
        signature: SIGNATURE,
        event: 'Farmers Market',
        clientSubmittedAt: '2026-09-24T16:30:11.480Z',
        location: GPS,
      }),
    )
    expect(response.status).toBe(201)
    const data = (await response.json()) as { decision: string; code: string; submittedAt: string }
    expect(data.decision).toBe('agree')
    expect(data.code).toMatch(/^JM-[0-9A-F]{6}$/)
    expect(Number.isNaN(Date.parse(data.submittedAt))).toBe(false)

    const calls = vi.mocked(put).mock.calls
    expect(calls).toHaveLength(2)
    const [pdfCall, jsonCall] = calls
    expect(pdfCall?.[0]).toMatch(
      /^waivers\/promotional-release\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-\d{6}-agree-maria-lopez-jm-[0-9a-f]{6}\.pdf$/,
    )
    expect(pdfCall?.[2]).toMatchObject({ contentType: 'application/pdf', addRandomSuffix: true })
    expect(jsonCall?.[0]).toBe(String(pdfCall?.[0]).replace(/\.pdf$/, '.json'))

    const stored = JSON.parse(jsonCall?.[1] as string) as Record<string, unknown>
    expect(stored).toMatchObject({
      code: data.code,
      fullName: 'Maria Lopez',
      decision: 'agree',
      signed: true,
      event: 'Farmers Market',
      clientSubmittedAt: '2026-09-24T16:30:11.480Z',
      location: GPS,
      networkLocation: { city: 'Zanesville', region: 'OH', country: 'US' },
      collectedBy: 'staff@example.com',
      ipAddress: '203.0.113.7',
      pdfUrl: `https://blob.test/${String(pdfCall?.[0])}`,
    })
    // The drawn signature is kept in the PDF only.
    expect(stored).not.toHaveProperty('signature')
  })

  it('saves an anonymous decline', async () => {
    const response = await POST(request({ decision: 'decline' }))
    expect(response.status).toBe(201)
    const pdfCall = vi.mocked(put).mock.calls.find(([pathname]) => pathname.endsWith('.pdf'))
    expect(pdfCall?.[0]).toMatch(/-decline-anonymous-jm-[0-9a-f]{6}\.pdf$/)
  })
})

describe('GET /api/waivers/promotional-release/log', () => {
  const entry = (overrides: Record<string, unknown>) => ({
    id: 'x',
    code: 'JM-000000',
    decision: 'agree',
    signed: true,
    submittedAt: '2026-09-24T16:30:12.000Z',
    collectedBy: 'staff@example.com',
    signingForMinor: false,
    networkLocation: null,
    pdfUrl: null,
    ...overrides,
  })

  function logRequest(query: string) {
    return new NextRequest(`http://localhost/api/waivers/promotional-release/log?${query}`)
  }

  it('requires staff', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(isStaff).mockReturnValue(false)
    expect((await GET(logRequest('date=2026-09-24'))).status).toBe(401)
  })

  it("lists the day's JSON records and returns them as a sorted, filterable CSV", async () => {
    vi.mocked(list).mockResolvedValue({
      blobs: [
        { pathname: 'waivers/promotional-release/2026/09/2026-09-24-133000-decline-anonymous-jm-bbbbbb-r.json', url: 'https://blob.test/b.json' },
        { pathname: 'waivers/promotional-release/2026/09/2026-09-24-133000-decline-anonymous-jm-bbbbbb-r.pdf', url: 'https://blob.test/b.pdf' },
        { pathname: 'waivers/promotional-release/2026/09/2026-09-24-123012-agree-anonymous-jm-aaaaaa-r.json', url: 'https://blob.test/a.json' },
        { pathname: 'waivers/promotional-release/2026/09/2026-09-24-140000-agree-anonymous-jm-cccccc-r.json', url: 'https://blob.test/c.json' },
      ],
      hasMore: false,
    } as unknown as Awaited<ReturnType<typeof list>>)
    const bodies: Record<string, unknown> = {
      'https://blob.test/a.json': entry({ id: 'a', code: 'JM-AAAAAA', event: 'Market' }),
      'https://blob.test/b.json': entry({
        id: 'b',
        code: 'JM-BBBBBB',
        decision: 'decline',
        signed: false,
        submittedAt: '2026-09-24T17:30:00.000Z',
        event: 'Market',
      }),
      'https://blob.test/c.json': entry({ id: 'c', code: 'JM-CCCCCC', submittedAt: '2026-09-24T18:00:00.000Z', event: 'Other' }),
    }
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(bodies[url])))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(logRequest('date=2026-09-24&event=Market'))
    vi.unstubAllGlobals()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('waiver-log-2026-09-24-market.csv')
    expect(vi.mocked(list).mock.calls[0]?.[0]).toMatchObject({
      prefix: 'waivers/promotional-release/2026/09/2026-09-24-',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const rows = (await response.text()).trim().split('\r\n')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toContain('JM-AAAAAA,agree')
    expect(rows[2]).toContain('JM-BBBBBB,decline')
  })
})
