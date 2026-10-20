import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/refer/[code]/route'
import { REFERRAL_COOKIE } from '@/lib/referrals'

function visit(code: string) {
  return GET(new NextRequest(`http://localhost:3000/refer/${code}`), { params: Promise.resolve({ code }) })
}

describe('GET /refer/[code]', () => {
  it('remembers a valid code and sends the visitor to sign up', async () => {
    const response = await visit('abcd2345')

    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/auth/signup')
    const cookie = response.cookies.get(REFERRAL_COOKIE)
    expect(cookie?.value).toBe('ABCD2345')
    expect(cookie?.httpOnly).toBe(true)
  })

  it('still redirects but stores nothing for a malformed code', async () => {
    const response = await visit('not-a-code!')

    expect(response.status).toBe(307)
    expect(response.cookies.get(REFERRAL_COOKIE)).toBeUndefined()
  })
})
