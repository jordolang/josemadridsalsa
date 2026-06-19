import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/rbac'
import { getPersonalizedRecommendations } from '@/lib/recommendations'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const rawLimit = parseInt(searchParams.get('limit') ?? '6', 10)
    const safeLimit = Number.isFinite(rawLimit) ? rawLimit : 6
    const limit = Math.min(Math.max(safeLimit, 1), 20)

    const recommendations = await getPersonalizedRecommendations(user.id, limit)

    return NextResponse.json({ data: recommendations })
  } catch (error) {
    console.error('Homepage recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch homepage recommendations' },
      { status: 500 }
    )
  }
}
