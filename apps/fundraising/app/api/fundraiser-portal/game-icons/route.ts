import { NextRequest, NextResponse } from 'next/server'
import { requireFundraiserAccess } from '@/lib/rbac'
import gameIconManifest from '@/public/game-icons-manifest.json'

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 200

type GameIcon = {
  name: string
  path: string
  tags: string[]
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
}

export async function GET(request: NextRequest) {
  try {
    await requireFundraiserAccess()

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1
    )
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(request.nextUrl.searchParams.get('pageSize') ?? '', 10) ||
          DEFAULT_PAGE_SIZE
      )
    )
    const query = request.nextUrl.searchParams.get('query')?.trim().toLowerCase() ?? ''
    const similarTo = request.nextUrl.searchParams.get('similarTo')?.trim() ?? ''
    const similarTokens = new Set(tokenize(similarTo))
    let icons = gameIconManifest as GameIcon[]

    if (query) {
      const queryTokens = tokenize(query)
      icons = icons.filter((icon) =>
        queryTokens.every((token) => icon.path.toLowerCase().includes(token))
      )
    }

    if (similarTokens.size > 0) {
      icons = icons
        .map((icon) => ({
          icon,
          score: icon.tags.reduce(
            (total, tag) => total + (similarTokens.has(tag) ? 1 : 0),
            0
          ),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.icon.path.localeCompare(b.icon.path))
        .map(({ icon }) => icon)
    }

    const total = icons.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const normalizedPage = Math.min(page, totalPages)
    const start = (normalizedPage - 1) * pageSize

    return NextResponse.json({
      icons: icons.slice(start, start + pageSize),
      page: normalizedPage,
      pageSize,
      total,
      totalPages,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized')
      ? 401
      : message.includes('Forbidden')
        ? 403
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
