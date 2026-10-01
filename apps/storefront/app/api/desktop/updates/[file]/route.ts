import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * The desktop apps' update feed: a fixed address in front of wherever the
 * installers actually live.
 *
 * The repository is private, so its GitHub release assets answer 404 to an
 * app with no GitHub session, and the apps cannot update from there. The
 * Desktop Apps workflow uploads each build to the public Blob store under
 * `desktop/` instead, and both apps ask this URL for it — so the address baked
 * into every installed copy never has to change, even if the files move.
 *
 * Public on purpose: an installer is a window onto the admin sign-in page and
 * holds no data or secret. Only the files the workflow publishes are named
 * here; anything else is a 404 rather than an open redirect into the store.
 */

export const dynamic = 'force-dynamic'

const UPDATES_ORIGIN = 'https://can9pwc8drhj1bme.public.blob.vercel-storage.com/desktop'

const FileName = z
  .string()
  .regex(/^(latest\.yml|JoseMadridSalsaAdmin-[A-Za-z0-9.-]+\.(exe|exe\.blockmap|dmg))$/)

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const parsed = FileName.safeParse((await context.params).file)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.redirect(`${UPDATES_ORIGIN}/${parsed.data}`, {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  })
}
