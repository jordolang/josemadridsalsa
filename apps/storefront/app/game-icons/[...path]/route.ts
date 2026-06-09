import { NextRequest, NextResponse } from 'next/server'

const REMOTE_ASSET_BASE_URL = 'https://raw.githubusercontent.com/game-icons/icons/master/'
const ALLOWED_PATH = /^[a-zA-Z0-9/%_+\-.]+$/

type RouteContext = {
  params: Promise<{ path: string[] }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  const relativePath = path.map(decodeURIComponent).join('/')

  if (!relativePath || !ALLOWED_PATH.test(relativePath)) {
    return NextResponse.json({ error: 'Invalid game icon path' }, { status: 400 })
  }

  const response = await fetch(`${REMOTE_ASSET_BASE_URL}${relativePath}`, {
    next: { revalidate: 604800 },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Game icon not found' }, { status: 404 })
  }

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    },
  })
}
