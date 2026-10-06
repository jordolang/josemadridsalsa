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
  return NextResponse.redirect(returnUrlWithToken(returnTo, token, state.data), 303)
}
