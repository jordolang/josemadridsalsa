import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import * as blocks from '@/lib/email/blocks'

// GET - Fetch all available email blocks
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user || !(await hasAnyPermission(user, ['content:read']))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all exported blocks from the blocks module
    const allBlocks = {
      header: blocks.headerBlocks || [],
      hero: blocks.heroBlocks || [],
      content: blocks.contentBlocks || [],
      products: blocks.productBlocks || [],
      cta: blocks.ctaBlocks || [],
      socialFooter: blocks.socialFooterBlocks || [],
      special: blocks.specialBlocks || [],
    }

    // Count total blocks
    const totalBlocks = Object.values(allBlocks).reduce(
      (sum, category) => sum + category.length,
      0
    )

    return NextResponse.json({
      blocks: allBlocks,
      totalBlocks,
      categories: Object.keys(allBlocks),
    })
  } catch (error) {
    console.error('Error fetching email blocks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email blocks' },
      { status: 500 }
    )
  }
}
