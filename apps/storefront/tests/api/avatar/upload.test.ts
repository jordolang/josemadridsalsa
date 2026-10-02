import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getCurrentUser = vi.fn()
const put = vi.fn()

vi.mock('@/lib/rbac', () => ({ getCurrentUser }))
vi.mock('@vercel/blob', () => ({ put }))

const { POST } = await import('@/app/api/avatar/upload/route')

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const upload = (body: Uint8Array, query = '') =>
  new NextRequest(`http://localhost/api/avatar/upload${query}`, { method: 'POST', body })

describe('POST /api/avatar/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token')
    getCurrentUser.mockResolvedValue({ id: 'user-1' })
    put.mockResolvedValue({ url: 'https://blob.example/avatars/user-1-abc.png' })
  })

  it('requires sign-in', async () => {
    getCurrentUser.mockResolvedValue(null)
    expect((await POST(upload(PNG))).status).toBe(401)
    expect(put).not.toHaveBeenCalled()
  })

  it('ignores a caller-chosen filename and stores under the user id', async () => {
    const res = await POST(upload(PNG, '?filename=../../index.html'))
    expect(res.status).toBe(200)
    const [path, , options] = put.mock.calls[0]
    expect(path).toBe('avatars/user-1.png')
    expect(options).toMatchObject({ contentType: 'image/png', addRandomSuffix: true, access: 'public' })
    expect(await res.json()).toEqual({ url: 'https://blob.example/avatars/user-1-abc.png' })
  })

  it('refuses a non-image body', async () => {
    const res = await POST(upload(new TextEncoder().encode('<script>alert(1)</script>')))
    expect(res.status).toBe(415)
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses an oversized image', async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1)
    big.set(PNG)
    expect((await POST(upload(big))).status).toBe(413)
  })
})
