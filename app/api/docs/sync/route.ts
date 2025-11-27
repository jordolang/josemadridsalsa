import { NextResponse } from 'next/server'
import { syncDocumentationEntries } from '@/lib/docs/service'

export async function POST() {
  try {
    const result = await syncDocumentationEntries()
    
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Error syncing documentation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync documentation' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return POST()
}
