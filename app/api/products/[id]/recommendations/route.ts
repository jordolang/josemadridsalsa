import { NextRequest, NextResponse } from 'next/server'
import { getFrequentlyBoughtTogether, getYouMayAlsoLike } from '@/lib/recommendations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'all'

    let frequentlyBoughtTogether: any[] = []
    let youMayAlsoLike: any[] = []

    if (type === 'all' || type === 'frequently-bought') {
      frequentlyBoughtTogether = await getFrequentlyBoughtTogether(id, 4)
    }

    if (type === 'all' || type === 'similar') {
      youMayAlsoLike = await getYouMayAlsoLike(id, 8)
    }

    return NextResponse.json({
      frequentlyBoughtTogether,
      youMayAlsoLike,
    })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    )
  }
}
