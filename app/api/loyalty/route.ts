import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/rbac'
import { getOrCreateLoyaltyAccount } from '@/lib/loyalty'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const account = await getOrCreateLoyaltyAccount(user.id)

    return NextResponse.json({ data: account })
  } catch (error) {
    console.error('Get loyalty account error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch loyalty account' },
      { status: 500 }
    )
  }
}
