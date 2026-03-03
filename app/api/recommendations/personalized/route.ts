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
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '8', 10), 1), 20)

    const recommendations = await getPersonalizedRecommendations(user.id, limit)

    return NextResponse.json({ data: recommendations })
  } catch (error) {
    console.error('Personalized recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch personalized recommendations' },
      { status: 500 }
    )
  }
}
