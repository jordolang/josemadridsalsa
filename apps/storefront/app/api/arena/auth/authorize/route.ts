import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createGameSession, ensurePlayer } from '@/lib/arena-game/players'
import { StateSchema, isAllowedReturnUrl, returnUrlWithToken } from '@/lib/arena-game/rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/arena/auth/authorize — the "Play as …" button on /battle-arena/connect.
 *
 * Gives the game a sign-in token for the signed-in account and sends the browser back to the
 * game with it in the URL fragment (never the query, so it stays out of server logs). Only a
 * form on this site can trigger it: the session cookie is SameSite=Lax, and the Origin header
 * must be this site's own.
 *
 * The way back is a small page of our own, not a redirect: the site's CSP has
 * `form-action 'self'`, and browsers apply that to where a form's redirect lands, so a 303 to
 * the game's origin was silently blocked and the button seemed to do nothing.
 */
export async function POST(request: Request) {
  const here = new URL(request.url)
  const origin = request.headers.get('origin')
  if (origin && origin !== here.origin) return new NextResponse('Forbidden', { status: 403 })

  const form = await request.formData().catch(() => null)
  const returnTo = String(form?.get('return_to') ?? '')
  const state = StateSchema.safeParse(String(form?.get('state') ?? ''))
  if (!isAllowedReturnUrl(returnTo) || !state.success) {
    return NextResponse.redirect(new URL('/battle-arena/connect?error=invalid', here), 303)
  }

  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; name?: string | null } | undefined
  if (!user?.id) {
    const connect = `/battle-arena/connect?${new URLSearchParams({ return_to: returnTo, state: state.data })}`
    return NextResponse.redirect(new URL(`/auth/signin?${new URLSearchParams({ callbackUrl: connect })}`, here), 303)
  }

  const player = await ensurePlayer({ id: user.id, name: user.name })
  const token = await createGameSession(player.id, request.headers.get('user-agent'))
  return continueToGame(returnUrlWithToken(returnTo, token, state.data))
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A page on this site that moves on to the game at once, with a link in case it does not. */
function continueToGame(url: string) {
  const href = escapeHtml(url)
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="refresh" content="0;url=${href}">
<title>Back to Battle Arena - Jose Madrid Salsa</title>
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:4rem 1rem">
<p>Signed in. Taking you back to the Battle Arena…</p>
<p><a href="${href}">Continue to the game</a></p>
</body>
</html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
