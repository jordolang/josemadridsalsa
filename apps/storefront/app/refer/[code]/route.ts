import { NextResponse, type NextRequest } from 'next/server'

import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE, parseReferralCode } from '@/lib/referrals'

/**
 * A refer-a-friend link. Remembers the code for a month and sends the visitor to sign up; the
 * code is checked against a real customer only when the account is created.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const referralCode = parseReferralCode(code)

  const response = NextResponse.redirect(new URL('/auth/signup?referred=1', request.url), 307)
  if (referralCode) {
    response.cookies.set(REFERRAL_COOKIE, referralCode, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      path: '/',
    })
  }
  return response
}
